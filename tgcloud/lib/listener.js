// What a channel's listeners get in the bot, always for that one channel —
// another customer's channel is never suggested:
//   /start m<cid>          their liked songs + "you might also like" (co-likes)
//   /start s<cid>_<post>   a song a friend shared, with a button to join the channel
//   g:ref:<cid>            their own invite link and the month's top inviters
//   g:req:<cid>            ask for a song; the next text they send is the request
//   g:mine:<cid>           back to their songs
//   /stop                  no more owner messages (broadcast.js)

import { api, db, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { getChannel, isLive, postBase } from './channels.js';
import { DAY, now, isReal, songName, ensureLink, topReferrers } from './growth.js';
import { chatIdOf, shortId, shareUrl } from './postButtons.js';
import { esc, link, fa, clip, userLabel } from './html.js';

const LIST_MAX = 25;
const RECS = 5;
const REQUEST_WINDOW = 15 * 60;   // seconds the bot waits for the request text
const REQUESTS_PER_DAY = 5;       // per listener and channel

const quiet = { parse_mode: 'HTML', link_preview_options: { is_disabled: true } };
const say = (chatId, text, extra = {}) => api.sendMessage({ chat_id: chatId, text, ...quiet, ...extra });

// A channel listeners may use: known and live. → channel | null
async function liveChannel(short) {
  const channel = await getChannel(chatIdOf(short));
  return isLive(channel) ? channel : null;
}

const notLive = (chatId) => say(chatId, 'این کانال فعلاً از ربات استفاده نمی‌کنه 🙂');

// Where the "go to the channel" button points: an invite link of `kind`, so
// joins from the bot are counted; the public link if the bot may not make one.
async function channelUrl(channel, kind) {
  try {
    return (await ensureLink(channel.chat_id, kind, kind)).url;
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    return channel.username ? `https://t.me/${channel.username}` : null;
  }
}

function listenerButtons(channel, entryUrl, { mine = false } = {}) {
  const s = shortId(channel.chat_id);
  const rows = [];
  if (entryUrl) rows.push([{ text: `📢 رفتن به «${clip(channel.title ?? 'کانال', 30)}»`, url: entryUrl }]);
  rows.push([
    { text: '🎁 دوستاتو دعوت کن', callback_data: `g:ref:${s}`, style: 'success' },
    { text: '🎶 درخواست آهنگ', callback_data: `g:req:${s}`, style: 'primary' },
  ]);
  if (mine) rows.push([{ text: '🎧 آهنگ‌های من', callback_data: `g:mine:${s}` }]);
  return { inline_keyboard: rows };
}

// ---------- my songs ----------

async function likedSongs(cid, userId) {
  return db.all(sql`
    SELECT l.channel_id, l.music_id, ${songName('l')} AS name, max(coalesce(l.updated_at, l.created_at)) AS at
    FROM likes l WHERE l.channel_id = ${cid} AND l.user_id = ${userId} AND l.liked = 1
    GROUP BY l.channel_id, l.music_id
    ORDER BY at DESC`);
}

// Songs liked by real listeners who share likes with this user, which this user
// hasn't voted on; then the channel's most liked songs to fill up.
export async function recommendations(cid, userId, limit = RECS) {
  const recs = await db.all(sql`
    SELECT b.channel_id, b.music_id, ${songName('b')} AS name, count(DISTINCT b.user_id) AS score
    FROM likes a
    JOIN likes b ON b.channel_id = a.channel_id AND b.user_id = a.user_id AND b.music_id != a.music_id
    WHERE a.channel_id = ${cid} AND a.liked = 1 AND b.liked = 1 AND a.user_id != ${userId} AND ${isReal('a')}
      AND a.music_id IN (SELECT music_id FROM likes WHERE channel_id = ${cid} AND user_id = ${userId} AND liked = 1)
      AND b.music_id NOT IN (SELECT music_id FROM likes WHERE channel_id = ${cid} AND user_id = ${userId})
    GROUP BY b.channel_id, b.music_id
    ORDER BY score DESC, max(b.created_at) DESC
    LIMIT ${limit}`);
  if (recs.length >= limit) return recs;
  const skip = recs.map((r) => r.music_id);
  const popular = await db.all(sql`
    SELECT l.channel_id, l.music_id, ${songName('l')} AS name, count(*) AS score
    FROM likes l
    WHERE l.channel_id = ${cid} AND l.liked = 1 AND ${isReal('l')}
      AND l.music_id NOT IN (SELECT music_id FROM likes WHERE channel_id = ${cid} AND user_id = ${userId})
    GROUP BY l.channel_id, l.music_id
    ORDER BY score DESC, max(l.created_at) DESC
    LIMIT ${limit + skip.length}`);
  return [...recs, ...popular.filter((p) => !skip.includes(p.music_id))].slice(0, limit);
}

const songLine = (base, s, prefix) => `${prefix} ${link(base ? base + s.music_id : null, clip(s.name || `آهنگ #${s.music_id}`))}`;

export async function sendMine(chatId, user, channel) {
  const cid = String(channel.chat_id);
  const base = postBase(channel);
  const title = esc(channel.title ?? 'کانال');
  const [liked, recs] = await Promise.all([likedSongs(cid, user.id), recommendations(cid, user.id)]);

  const out = [];
  if (liked.length) {
    out.push(`🎧 <b>آهنگ‌هایی که توی «${title}» لایک کردی</b> (${fa(liked.length)} تا)`, '');
    liked.slice(0, LIST_MAX).forEach((s, i) => out.push(songLine(base, s, `${fa(i + 1)}.`)));
    if (liked.length > LIST_MAX) out.push(`… و ${fa(liked.length - LIST_MAX)} تای دیگه`);
  } else {
    out.push(`هنوز آهنگی توی «${title}» لایک نکردی 🙂`, 'زیر آهنگای کانال ❤️ بزن تا اینجا برات جمع بشن.');
  }
  if (recs.length) {
    out.push('', liked.length ? '✨ <b>شاید اینا رو هم دوست داشته باشی</b>' : '🔥 <b>محبوب‌ترین‌های کانال</b>');
    recs.forEach((s) => out.push(songLine(base, s, '•')));
  }
  await say(chatId, out.join('\n'), { reply_markup: listenerButtons(channel, await channelUrl(channel, 'bot')) });
}

// ---------- a shared song ----------

export async function sendSong(chatId, channel, musicId) {
  let copied = true;
  try {
    await api.copyMessage({ chat_id: chatId, from_chat_id: channel.chat_id, message_id: musicId });
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    copied = false;
  }
  const likes = Number((await db.get(sql`
    SELECT count(*) AS n FROM likes l
    WHERE l.channel_id = ${String(channel.chat_id)} AND l.music_id = ${musicId} AND l.liked = 1 AND ${isReal('l')}`))?.n ?? 0);
  const title = esc(channel.title ?? 'کانال');
  const text = copied
    ? `🎧 این آهنگ از کانال «${title}» برات فرستاده شده${likes ? ` و ${fa(likes)} نفر دوستش داشتن ❤️` : ''}.\n` +
      'آهنگای بیشتر و رأی دادن به‌شون توی کانال 👇'
    : `این پست دیگه توی «${title}» نیست 😕 ولی آهنگای دیگه‌ش منتظرتن 👇`;
  await say(chatId, text, { reply_markup: listenerButtons(channel, await channelUrl(channel, 'share'), { mine: true }) });
}

// /start m<cid> or /start s<cid>_<post>; true when `param` was one of them.
export async function handleListenerStart(message, param) {
  const mine = /^m(\d{5,})$/.exec(param ?? '');
  const song = /^s(\d{5,})_(\d+)$/.exec(param ?? '');
  if (!mine && !song) return false;
  const channel = await liveChannel((mine ?? song)[1]);
  if (!channel) {
    await notLive(message.chat.id);
    return true;
  }
  if (mine) await sendMine(message.chat.id, message.from, channel);
  else await sendSong(message.chat.id, channel, Number(song[2]));
  return true;
}

// ---------- invites and requests ----------

async function sendReferral(chatId, user, channel) {
  const title = esc(channel.title ?? 'کانال');
  let ref;
  try {
    ref = await ensureLink(channel.chat_id, 'ref', `ref:${user.id}`, user.id);
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
    return say(chatId, `دعوت با لینک اختصاصی برای «${title}» فعلاً فعال نیست 🙏`);
  }
  const mine = await db.get(sql`
    SELECT count(*) AS joins,
           coalesce(sum(NOT EXISTS (
             SELECT 1 FROM member_events x
             WHERE x.channel_id = e.channel_id AND x.user_id = e.user_id AND x.event = 'leave' AND x.at >= e.at)), 0) AS stayed
    FROM member_events e WHERE e.link_id = ${ref.id} AND e.event = 'join'`);
  const leaders = await topReferrers(String(channel.chat_id), now() - 30 * DAY);
  const out = [
    `🎁 <b>لینک دعوت اختصاصی تو برای «${title}»</b>`,
    '',
    esc(ref.url),
    '',
    'هر کی با این لینک عضو کانال بشه به اسم تو ثبت میشه.',
    `تا الان ${fa(mine?.joins)} نفر با لینکت عضو شدن${Number(mine?.joins) ? ` (${fa(mine?.stayed)} نفر هنوز عضون)` : ''} 🎉`,
  ];
  if (leaders.length) {
    out.push('', '🏆 <b>بهترین دعوت‌کننده‌های این ماه</b>');
    leaders.forEach((r, i) => out.push(`${fa(i + 1)}. ${esc(userLabel(r))} — ${fa(r.stayed)} نفر`));
  }
  return say(chatId, out.join('\n'), { reply_markup: { inline_keyboard: [
    [{ text: '📤 بفرست برای دوستات', url: shareUrl(ref.url, `🎧 بیا عضو «${channel.title ?? 'این کانال'}» شو`), style: 'success' }],
    [{ text: '🎧 آهنگ‌های من', callback_data: `g:mine:${shortId(channel.chat_id)}` }],
  ] } });
}

async function askRequest(chatId, user, channel) {
  await db.run(sql`
    INSERT INTO bot_users (user_id, username, first_name, pending_action, pending_at)
    VALUES (${user.id}, ${user.username ?? null}, ${user.first_name ?? null}, ${`req:${channel.chat_id}`}, ${now()})
    ON CONFLICT (user_id) DO UPDATE SET pending_action = excluded.pending_action, pending_at = excluded.pending_at`);
  await say(chatId, `🎶 اسم آهنگ و خواننده‌ای که دوست داری توی «${esc(channel.title ?? 'کانال')}» پست بشه رو بفرست:`);
}

// A private text right after "request a song": saved as the request. → true when consumed.
export async function takeSongRequest(message) {
  const text = (message.text ?? '').trim();
  if (message.chat?.type !== 'private' || !text || text.startsWith('/')) return false;
  const u = await db.get(sql`SELECT pending_action, pending_at FROM bot_users WHERE user_id = ${message.from.id}`);
  const m = /^req:(-?\d+)$/.exec(u?.pending_action ?? '');
  if (!m) return false;
  await db.run(sql`UPDATE bot_users SET pending_action = NULL, pending_at = NULL WHERE user_id = ${message.from.id}`);
  if (!(u.pending_at > now() - REQUEST_WINDOW)) return false;

  const channel = await getChannel(m[1]);
  if (!isLive(channel)) {
    await notLive(message.chat.id);
    return true;
  }
  const today = Number((await db.get(sql`
    SELECT count(*) AS n FROM song_requests
    WHERE channel_id = ${channel.chat_id} AND user_id = ${message.from.id} AND created_at > ${now() - DAY}`))?.n ?? 0);
  if (today >= REQUESTS_PER_DAY) {
    await say(message.chat.id, `امروز ${fa(REQUESTS_PER_DAY)} تا درخواست دادی 🙂 فردا دوباره امتحان کن.`);
    return true;
  }
  await db.run(sql`
    INSERT INTO song_requests (channel_id, user_id, user_name, text)
    VALUES (${channel.chat_id}, ${message.from.id}, ${message.from.username ?? message.from.first_name ?? null}, ${text.slice(0, 200)})`);
  await say(message.chat.id, `✅ درخواستت برای «${esc(channel.title ?? 'کانال')}» ثبت شد. ممنون! 🙏`, {
    reply_markup: { inline_keyboard: [[{ text: '🎧 آهنگ‌های من', callback_data: `g:mine:${shortId(channel.chat_id)}` }]] },
  });
  return true;
}

// g:… buttons; true when `query` was one of them.
export async function handleListenerCallback(query) {
  const m = /^g:(ref|req|mine):(\d{5,})$/.exec(query.data ?? '');
  if (!m) return false;
  try {
    await api.answerCallbackQuery({ callback_query_id: query.id });
  } catch (e) {
    console.error(e);
  }
  const chatId = query.message?.chat?.id ?? query.from.id;
  const channel = await liveChannel(m[2]);
  if (!channel) {
    await notLive(chatId);
    return true;
  }
  if (m[1] === 'ref') await sendReferral(chatId, query.from, channel);
  else if (m[1] === 'req') await askRequest(chatId, query.from, channel);
  else await sendMine(chatId, query.from, channel);
  return true;
}
