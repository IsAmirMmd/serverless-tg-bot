// The weekly report: for every live channel, a digest of the past 7 days goes to
// its managers (or to the owner, for channels with no one else), followed by a
// ready "top songs of the week" post they can publish with one button. The
// owner also gets one line per channel. Run by /weekly from
// .github/workflows/weekly.yml. Counts are real votes only (see growth.js).

import { api, db } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID } from './config.js';
import { getChannel, isLive, isManager, notify, panelKeyboard, postBase } from './channels.js';
import { channelContacts, faDay } from './billing.js';
import {
  DAY, now, memberCount, memberMoves, realVotes, engagement, bestHours, topSongs, topReferrers, sourceStats,
} from './growth.js';
import { getSetting, setSetting, deleteSetting } from './settings.js';
import { esc, link, fa, faPercent, faChange, userLabel, clip } from './html.js';
import { shortId, chatIdOf } from './postButtons.js';

const SOURCE_LABEL = {
  direct: 'مستقیم',
  folder: 'پوشه',
  primary: 'لینک اصلی کانال',
  other: 'لینک‌های دیگر',
  share: 'اشتراک آهنگ',
  bot: 'از داخل ربات',
  ref: 'دعوت شنونده‌ها',
  unknown: 'نامشخص',
};
const sourceLabel = (r) => (r.source === 'campaign' || r.source.startsWith('link:') ? r.name : SOURCE_LABEL[r.source] ?? r.source);

const MEDALS = ['🥇', '🥈', '🥉'];
const quiet = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
const draftKey = (channel) => `weekly_draft:${channel.chat_id}`;
const round1 = (x) => Math.round(x * 10) / 10;

// The "top songs of the week" post for the channel itself.
function draftPost(top, base) {
  const lines = top.map((s, i) => {
    const name = link(base ? base + s.music_id : null, clip(s.name || `آهنگ #${s.music_id}`));
    return `${MEDALS[i] ?? `${fa(i + 1)}.`} ${name} — ❤️ ${fa(s.likes)}`;
  });
  return `🏆 <b>برترین‌های هفته</b>\n\n${lines.join('\n')}\n\n✨ این جدول رو رأی‌های شما می‌سازه؛ زیر آهنگایی که دوست دارید ❤️ بزنید!`;
}

// → { text, draft, line }: the digest, the top-songs post (null without likes),
// and the owner's one-line summary.
export async function weeklyDigest(channel, t = now()) {
  const cid = String(channel.chat_id);
  const from = t - 7 * DAY;
  const [members, moves, votes, prev, eng, hours, top, refs, sources, req, tracked] = await Promise.all([
    memberCount(cid),
    memberMoves(cid, from, t + 1),
    realVotes(cid, from, t + 1),
    realVotes(cid, from - 7 * DAY, from),
    engagement(cid, from),
    bestHours(cid, t - 56 * DAY),
    topSongs(cid, from, t + 1),
    topReferrers(cid, t - 30 * DAY, 3),
    sourceStats(cid, from),
    db.get(sql`
      SELECT count(*) AS n,
             (SELECT min(text) FROM song_requests WHERE channel_id = ${cid} AND created_at >= ${from}
              GROUP BY lower(trim(text)) ORDER BY count(*) DESC LIMIT 1) AS top_text,
             (SELECT count(*) FROM song_requests WHERE channel_id = ${cid} AND created_at >= ${from}
              GROUP BY lower(trim(text)) ORDER BY count(*) DESC LIMIT 1) AS top_n
      FROM song_requests WHERE channel_id = ${cid} AND created_at >= ${from}`),
    db.get(sql`SELECT 1 AS x FROM member_events WHERE channel_id = ${cid} LIMIT 1`),
  ]);
  const base = postBase(channel);
  const title = channel.title ?? channel.username ?? cid;
  const net = moves.joins - moves.leaves;
  const change = faChange(votes.votes, prev.votes);

  const out = [`📊 <b>گزارش هفتگی «${esc(title)}»</b>`, `${faDay(from)} تا ${faDay(t)}`, ''];

  const membersText = members != null ? `${fa(members)} نفر` : '—';
  out.push(tracked
    ? `👥 <b>اعضا:</b> ${membersText}؛ ${fa(moves.joins)} ورود، ${fa(moves.leaves)} خروج (خالص ${net >= 0 ? '+' : '−'}${fa(Math.abs(net))})`
    : `👥 <b>اعضا:</b> ${membersText} (ورود و خروج از الان به بعد ثبت می‌شود)`);
  const joined = sources.filter((s) => s.joins > 0).slice(0, 3);
  if (joined.length) out.push(`   ورودی‌ها از: ${joined.map((s) => `${esc(sourceLabel(s))} ${fa(s.joins)}`).join('، ')}`);

  out.push(`❤️ <b>رأی‌های واقعی:</b> ${fa(votes.votes)} رأی از ${fa(votes.voters)} نفر${change ? ` (${change})` : ''}`);
  if (eng.posts) {
    out.push(`🎵 <b>پست‌ها:</b> ${fa(eng.posts)} آهنگ، میانگین ${fa(round1(eng.avg_voters))} رأی برای هر پست`);
    if (eng.rate != null) out.push(`📈 <b>نرخ تعامل:</b> ${faPercent(eng.rate)} از اعضا برای هر پست رأی دادن`);
  }
  if (hours.length) {
    out.push(`⏰ <b>بهترین ساعت پست:</b> ساعت ${fa(hours[0].hour)} (میانگین ${fa(round1(hours[0].avg_voters))} رأی، ۸ هفته اخیر)`);
  }

  if (top.length) {
    out.push('', '🏆 <b>محبوب‌ترین‌های هفته</b>');
    top.forEach((s, i) => out.push(`${fa(i + 1)}. ${link(base ? base + s.music_id : null, clip(s.name || `آهنگ #${s.music_id}`))} — ❤️ ${fa(s.likes)}`));
  }
  if (refs.length) {
    out.push('', `🎁 <b>بهترین دعوت‌کننده‌ها (۳۰ روز):</b> ${refs.map((r) => `${esc(userLabel(r))} (${fa(r.stayed)})`).join('، ')}`);
  }
  if (Number(req?.n)) {
    out.push(`🎶 <b>درخواست‌ها:</b> ${fa(req.n)} درخواست${req.top_text ? `، بیشترین: «${esc(clip(req.top_text, 40))}» (${fa(req.top_n)} بار)` : ''}`);
  }
  out.push('', '<i>رأی‌های فیک و رأی‌های تیم کانال در این آمار حساب نشده‌اند.</i>');

  const line = `• «${esc(title)}»: 👥 ${tracked ? `+${fa(moves.joins)}/−${fa(moves.leaves)}` : '—'} | ❤️ ${fa(votes.votes)}${change ? ` (${change})` : ''} | 🎵 ${fa(eng.posts)}`;
  return { text: out.join('\n'), draft: top.length ? draftPost(top, base) : null, line };
}

const publishKeyboard = (channel) => ({
  inline_keyboard: [[
    { text: '📢 انتشار در کانال', callback_data: `wk:pub:${shortId(channel.chat_id)}`, style: 'success' },
    { text: '✖️ نه، ممنون', callback_data: `wk:no:${shortId(channel.chat_id)}` },
  ]],
});

// /weekly → { channels } (how many reports went out).
export async function weeklyReports() {
  const channels = (await db.all(sql`SELECT * FROM channels ORDER BY created_at`)).filter(isLive);
  const lines = [];
  let ownerSawAll = true;
  for (const channel of channels) {
    const d = await weeklyDigest(channel);
    lines.push(d.line);
    const contacts = await channelContacts(channel);
    if (contacts.length) ownerSawAll = false;
    if (d.draft) await setSetting(draftKey(channel), d.draft);
    else await deleteSetting(draftKey(channel));
    for (const userId of contacts.length ? contacts : [ADMIN_ID]) {
      await notify(userId, d.text, { ...quiet, reply_markup: panelKeyboard() });
      if (d.draft) {
        await notify(userId, `👇 پیش‌نمایش پست «برترین‌های هفته» برای کانال؛ با دکمه زیر منتشر میشه.\n\n${d.draft}`,
          { ...quiet, reply_markup: publishKeyboard(channel) });
      }
    }
  }
  if (channels.length && !ownerSawAll) {
    await notify(ADMIN_ID, `📊 <b>خلاصه هفتگی کانال‌ها</b>\n\n${lines.join('\n')}`, quiet);
  }
  return { channels: channels.length };
}

async function answer(query, text, alert = false) {
  try {
    await api.answerCallbackQuery({ callback_query_id: query.id, text, show_alert: alert });
  } catch (e) {
    console.error(e);
  }
}

async function dropButtons(query) {
  if (!query.message) return;
  try {
    await api.editMessageReplyMarkup({
      chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] },
    });
  } catch (e) {
    console.error(e);
  }
}

// wk:pub:<cid> / wk:no:<cid> under the draft; true when `query` was one of them.
export async function handleWeeklyCallback(query) {
  const m = /^wk:(pub|no):(\d+)$/.exec(query.data ?? '');
  if (!m) return false;
  const channel = await getChannel(chatIdOf(m[2]));
  if (!(await isManager(query.from.id, channel))) {
    await answer(query, 'فقط مدیر کانال می‌تونه منتشر کنه', true);
    return true;
  }
  if (m[1] === 'no') {
    await answer(query, 'باشه، منتشر نمیشه');
    await dropButtons(query);
    return true;
  }
  if (!isLive(channel)) {
    await answer(query, 'این کانال فعلاً فعال نیست', true);
    return true;
  }
  const key = draftKey(channel);
  const draft = await getSetting(key);
  if (!draft) {
    await answer(query, 'این پست قبلاً منتشر شده یا دیگه معتبر نیست', true);
    await dropButtons(query);
    return true;
  }
  // Taken first, so a second press (or a second manager) can't post it twice.
  await deleteSetting(key);
  try {
    await api.sendMessage({ chat_id: channel.chat_id, text: draft, ...quiet });
  } catch (e) {
    await setSetting(key, draft);
    throw e;
  }
  await answer(query, 'توی کانال منتشر شد ✅');
  await dropButtons(query);
  return true;
}
