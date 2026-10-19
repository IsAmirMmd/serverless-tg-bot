// Marketing data for one channel: the posts the bot published, invite links
// (where members come from), joins and leaves, and stats that count real votes
// only (voteClass.js: real / team / fake) unless they say otherwise.

import { db, api } from 'sdk';
import { sql } from 'sdk/db';
import { UTC_OFFSET_MINUTES } from './config.js';
import { orderBy, pageParams } from './dashboard.js';
import { postBase } from './channels.js';
import { isFake, isTeam, isReal, songName } from './voteClass.js';

export const DAY = 86400;
export const now = () => Math.floor(Date.now() / 1000);
const num = (v) => Number(v ?? 0);

export { isFake, isTeam, isReal, songName };

// ---------- posts ----------

// Records a post the bot just published. Tracking must never break posting,
// so failures are only logged.
export async function recordPost(channelId, sent, meta) {
  try {
    let members = null;
    try {
      members = await api.getChatMemberCount({ chat_id: String(channelId) });
    } catch (e) {
      console.error(e);
    }
    const audio = sent?.audio ?? {};
    await db.run(sql`
      INSERT INTO posts (channel_id, music_id, title, performer, file_id, duration, members)
      VALUES (${String(channelId)}, ${sent.message_id}, ${meta?.title ?? null}, ${meta?.performer ?? null},
              ${audio.file_id ?? null}, ${audio.duration ?? null}, ${members})
      ON CONFLICT (channel_id, music_id) DO NOTHING`);
  } catch (e) {
    console.error(e);
  }
}

// ---------- invite links ----------

export const LINK_NAME_MAX = 32;
const telegramLinkName = (kind, name) => (kind === 'campaign' ? name : kind === 'ref' ? name.replace(':', ' ') : `LikeTune ${kind}`)
  .slice(0, LINK_NAME_MAX);

// The channel's invite link of this kind and name, created on first use.
// Throws BotApiError when the bot may not invite users to the channel.
export async function ensureLink(channelId, kind, name, ownerId = null) {
  const cid = String(channelId);
  const find = () => db.get(sql`
    SELECT * FROM invite_links WHERE channel_id = ${cid} AND kind = ${kind} AND name = ${name}`);
  const found = await find();
  if (found) return found;
  const link = await api.createChatInviteLink({ chat_id: cid, name: telegramLinkName(kind, name) });
  // Two requests at once: the second insert is skipped and both read the first link.
  await db.run(sql`
    INSERT INTO invite_links (channel_id, kind, name, url, owner_id)
    VALUES (${cid}, ${kind}, ${name}, ${link.invite_link}, ${ownerId})
    ON CONFLICT DO NOTHING`);
  return find();
}

// ---------- joins and leaves (chat_member updates) ----------

const isIn = (m) => ['creator', 'administrator', 'member'].includes(m?.status)
  || (m?.status === 'restricted' && Boolean(m.is_member));

async function joinSource(update) {
  if (update.via_chat_folder_invite_link) return { source: 'folder', linkId: null };
  const link = update.invite_link;
  if (!link) return { source: 'direct', linkId: null };
  const known = await db.get(sql`SELECT id, kind FROM invite_links WHERE url = ${link.invite_link}`);
  if (known) return { source: known.kind, linkId: known.id };
  if (link.is_primary) return { source: 'primary', linkId: null };
  // A link another admin made: its URL is shown cut short, the name is all there is.
  return { source: link.name ? `link:${String(link.name).slice(0, LINK_NAME_MAX)}` : 'other', linkId: null };
}

// A ChatMemberUpdated → 'join' | 'leave' | null (no membership change: promotions etc.).
export async function recordMemberUpdate(update) {
  const user = update.new_chat_member?.user;
  if (!user || user.is_bot) return null;
  const was = isIn(update.old_chat_member);
  const is = isIn(update.new_chat_member);
  if (was === is) return null;
  const cid = String(update.chat.id);
  const at = update.date ?? now();

  if (is) {
    const { source, linkId } = await joinSource(update);
    await db.run(sql`
      INSERT INTO member_events (channel_id, user_id, event, source, link_id, at)
      VALUES (${cid}, ${user.id}, 'join', ${source}, ${linkId}, ${at})`);
    return 'join';
  }
  // A leave keeps the source of the join before it, for retention per source.
  const join = await db.get(sql`
    SELECT source, link_id FROM member_events
    WHERE channel_id = ${cid} AND user_id = ${user.id} AND event = 'join'
    ORDER BY at DESC, id DESC LIMIT 1`);
  await db.run(sql`
    INSERT INTO member_events (channel_id, user_id, event, source, link_id, at)
    VALUES (${cid}, ${user.id}, 'leave', ${join?.source ?? 'unknown'}, ${join?.link_id ?? null}, ${at})`);
  return 'leave';
}

// ---------- stats ----------

export async function memberCount(channelId) {
  try {
    return await api.getChatMemberCount({ chat_id: String(channelId) });
  } catch (e) {
    console.error(e);
    return null;
  }
}

// Joins and leaves in [from, to).
export async function memberMoves(cid, from, to) {
  const r = await db.get(sql`
    SELECT coalesce(sum(event = 'join'), 0) AS joins, coalesce(sum(event = 'leave'), 0) AS leaves
    FROM member_events WHERE channel_id = ${cid} AND at >= ${from} AND at < ${to}`);
  return { joins: num(r?.joins), leaves: num(r?.leaves) };
}

// Real votes cast (first vote on a post) in [from, to), and how many people cast them.
export async function realVotes(cid, from, to) {
  const r = await db.get(sql`
    SELECT count(*) AS votes, count(DISTINCT l.user_id) AS voters, coalesce(sum(l.liked = 1), 0) AS likes
    FROM likes l
    WHERE l.channel_id = ${cid} AND l.created_at >= ${from} AND l.created_at < ${to} AND ${isReal('l')}`);
  return { votes: num(r?.votes), voters: num(r?.voters), likes: num(r?.likes) };
}

// All-time votes by class.
export async function voteQuality(cid) {
  const r = await db.get(sql`
    SELECT coalesce(sum(${isReal('l')}), 0) AS real_votes,
           coalesce(sum(${isTeam('l')} AND l.user_id > 0), 0) AS team_votes,
           coalesce(sum(${isFake('l')}), 0) AS fake_votes,
           count(DISTINCT CASE WHEN ${isReal('l')} THEN l.user_id END) AS real_users
    FROM likes l WHERE l.channel_id = ${cid}`);
  return {
    real_votes: num(r?.real_votes), team_votes: num(r?.team_votes),
    fake_votes: num(r?.fake_votes), real_users: num(r?.real_users),
  };
}

// Posts published since `from`, each with its real voters and the share of
// members who voted.
async function postEngagement(cid, from) {
  const rows = await db.all(sql`
    SELECT p.music_id, p.posted_at, p.members,
           (SELECT count(*) FROM likes l
             WHERE l.channel_id = p.channel_id AND l.music_id = p.music_id AND ${isReal('l')}) AS voters
    FROM posts p WHERE p.channel_id = ${cid} AND p.posted_at >= ${from}`);
  return rows.map((r) => ({ ...r, voters: num(r.voters), members: r.members == null ? null : num(r.members) }));
}

// Average real voters per post and average engagement (voters / members) since `from`.
export async function engagement(cid, from) {
  const posts = await postEngagement(cid, from);
  const withMembers = posts.filter((p) => p.members > 0);
  return {
    posts: posts.length,
    avg_voters: posts.length ? posts.reduce((s, p) => s + p.voters, 0) / posts.length : null,
    rate: withMembers.length ? withMembers.reduce((s, p) => s + p.voters / p.members, 0) / withMembers.length : null,
  };
}

// Hour of day (bot timezone) whose posts got the most real voters on average;
// hours with fewer than `minPosts` posts are left out. → [{ hour, posts, avg_voters }] best first.
export async function bestHours(cid, from, minPosts = 2) {
  const posts = await postEngagement(cid, from);
  const byHour = new Map();
  for (const p of posts) {
    const hour = Math.floor(((p.posted_at + UTC_OFFSET_MINUTES * 60) % DAY) / 3600);
    const h = byHour.get(hour) ?? { hour, posts: 0, voters: 0 };
    h.posts += 1;
    h.voters += p.voters;
    byHour.set(hour, h);
  }
  return [...byHour.values()]
    .filter((h) => h.posts >= minPosts)
    .map((h) => ({ hour: h.hour, posts: h.posts, avg_voters: h.voters / h.posts }))
    .sort((a, b) => b.avg_voters - a.avg_voters || b.posts - a.posts);
}

// Songs with the most real likes cast in [from, to).
export async function topSongs(cid, from, to, limit = 5) {
  const rows = await db.all(sql`
    SELECT l.channel_id, l.music_id, ${songName('l')} AS name, count(*) AS likes
    FROM likes l
    WHERE l.channel_id = ${cid} AND l.liked = 1 AND l.created_at >= ${from} AND l.created_at < ${to} AND ${isReal('l')}
    GROUP BY l.channel_id, l.music_id
    ORDER BY likes DESC, max(l.created_at) DESC
    LIMIT ${limit}`);
  return rows.map((r) => ({ ...r, likes: num(r.likes) }));
}

// Listeners whose personal invite links brought the most members since `from`
// (who are still in the channel).
export async function topReferrers(cid, from, limit = 5) {
  const rows = await db.all(sql`
    SELECT il.owner_id AS user_id, u.username, u.first_name, count(*) AS joins,
           coalesce(sum(NOT EXISTS (
             SELECT 1 FROM member_events x
             WHERE x.channel_id = e.channel_id AND x.user_id = e.user_id AND x.event = 'leave' AND x.at >= e.at)), 0) AS stayed
    FROM member_events e
    JOIN invite_links il ON il.id = e.link_id AND il.kind = 'ref'
    LEFT JOIN bot_users u ON u.user_id = il.owner_id
    WHERE e.channel_id = ${cid} AND e.event = 'join' AND e.at >= ${from}
    GROUP BY il.owner_id
    ORDER BY stayed DESC, joins DESC
    LIMIT ${limit}`);
  return rows.map((r) => ({ ...r, joins: num(r.joins), stayed: num(r.stayed) }));
}

// Joins since `from` per source, with how many left (at all, and within 7 days).
// Campaign links are listed even without joins, so managers see what they made.
// Every listener link is folded into one 'ref' row.
export async function sourceStats(cid, from = 0) {
  const rows = await db.all(sql`
    SELECT j.source, j.link_id, count(*) AS joins,
           coalesce(sum(EXISTS (
             SELECT 1 FROM member_events x
             WHERE x.channel_id = j.channel_id AND x.user_id = j.user_id AND x.event = 'leave' AND x.at >= j.at)), 0) AS left_total,
           coalesce(sum(EXISTS (
             SELECT 1 FROM member_events x
             WHERE x.channel_id = j.channel_id AND x.user_id = j.user_id AND x.event = 'leave'
               AND x.at >= j.at AND x.at < j.at + ${7 * DAY})), 0) AS left_7d
    FROM member_events j
    WHERE j.channel_id = ${cid} AND j.event = 'join' AND j.at >= ${from}
    GROUP BY j.source, j.link_id`);
  const links = new Map((await db.all(sql`
    SELECT * FROM invite_links WHERE channel_id = ${cid} AND kind = 'campaign'`)).map((l) => [l.id, l]));

  const out = new Map();
  const add = (key, base, r) => {
    const row = out.get(key) ?? { key, ...base, joins: 0, left_total: 0, left_7d: 0 };
    row.joins += num(r?.joins);
    row.left_total += num(r?.left_total);
    row.left_7d += num(r?.left_7d);
    out.set(key, row);
  };
  for (const l of links.values()) add(`campaign:${l.id}`, { source: 'campaign', name: l.name, url: l.url, created_at: l.created_at }, null);
  for (const r of rows) {
    if (r.source === 'campaign' && links.has(r.link_id)) {
      const l = links.get(r.link_id);
      add(`campaign:${l.id}`, { source: 'campaign', name: l.name, url: l.url, created_at: l.created_at }, r);
    } else {
      add(r.source, { source: r.source, name: r.source.startsWith('link:') ? r.source.slice(5) : null, url: null }, r);
    }
  }
  return [...out.values()]
    .map((r) => ({ ...r, stayed: r.joins - r.left_total }))
    .sort((a, b) => b.joins - a.joins || (b.created_at ?? 0) - (a.created_at ?? 0));
}

// ---------- the panel's posts table ----------

const POSTS_SORT = {
  date: 'coalesce(posted_at, first_vote_at)',
  likes: 'real_likes',
  voters: 'real_likes + real_dislikes',
  rate: 'CAST(real_likes + real_dislikes AS REAL) / members',
  fake: 'fake_votes',
};

// One row per post: real ❤️ / 🥀, team and fake votes, members when posted and
// the share of them who voted. Covers posts published since tracking began and
// older ones that only have votes.
export async function postReport(channel, input = {}) {
  const cid = String(channel.chat_id);
  const p = pageParams(input);
  const votes = sql`
    SELECT l.music_id,
           nullif(max(l.music_name), '') AS vote_name,
           coalesce(sum(l.liked = 1 AND ${isReal('l')}), 0) AS real_likes,
           coalesce(sum(l.liked = 0 AND ${isReal('l')}), 0) AS real_dislikes,
           coalesce(sum(${isTeam('l')} AND l.user_id > 0), 0) AS team_votes,
           coalesce(sum(${isFake('l')}), 0) AS fake_votes,
           min(l.created_at) AS first_vote_at
    FROM likes l WHERE l.channel_id = ${cid} GROUP BY l.music_id`;
  const all = sql`
    SELECT p.music_id, p.title || coalesce(' - ' || p.performer, '') AS name, p.posted_at, p.members,
           coalesce(v.real_likes, 0) AS real_likes, coalesce(v.real_dislikes, 0) AS real_dislikes,
           coalesce(v.team_votes, 0) AS team_votes, coalesce(v.fake_votes, 0) AS fake_votes, v.first_vote_at
    FROM posts p LEFT JOIN (${votes}) v ON v.music_id = p.music_id
    WHERE p.channel_id = ${cid}
    UNION ALL
    SELECT v.music_id, v.vote_name, NULL, NULL, v.real_likes, v.real_dislikes, v.team_votes, v.fake_votes, v.first_vote_at
    FROM (${votes}) v
    WHERE v.music_id NOT IN (SELECT music_id FROM posts WHERE channel_id = ${cid})`;
  const total = num((await db.get(sql`SELECT count(*) AS n FROM (${all})`))?.n);
  const rows = await db.all(sql`
    SELECT * FROM (${all})
    ${orderBy(input, POSTS_SORT, 'date', 'music_id DESC')}
    LIMIT ${p.size} OFFSET ${p.offset}`);
  const base = postBase(channel);
  return {
    rows: rows.map((r) => {
      const voters = num(r.real_likes) + num(r.real_dislikes);
      return {
        ...r,
        real_likes: num(r.real_likes), real_dislikes: num(r.real_dislikes),
        team_votes: num(r.team_votes), fake_votes: num(r.fake_votes),
        members: r.members == null ? null : num(r.members),
        rate: r.members > 0 ? voters / num(r.members) : null,
        music_url: base ? base + r.music_id : null,
      };
    }),
    page: p.page, size: p.size, total, pages: Math.max(1, Math.ceil(total / p.size)),
  };
}

// Song requests, the same text grouped (case and spaces ignored), most asked first.
export async function requestReport(channel, input = {}) {
  const cid = String(channel.chat_id);
  const p = pageParams(input);
  const grouped = sql`
    SELECT lower(trim(text)) AS k, min(text) AS text, count(*) AS requests,
           count(DISTINCT user_id) AS users, max(created_at) AS last_at,
           group_concat(DISTINCT coalesce(user_name, user_id)) AS who
    FROM song_requests WHERE channel_id = ${cid}
    GROUP BY lower(trim(text))`;
  const total = num((await db.get(sql`SELECT count(*) AS n FROM (${grouped})`))?.n);
  const rows = await db.all(sql`
    SELECT * FROM (${grouped}) ORDER BY requests DESC, last_at DESC LIMIT ${p.size} OFFSET ${p.offset}`);
  return {
    rows: rows.map((r) => ({ ...r, requests: num(r.requests), users: num(r.users) })),
    page: p.page, size: p.size, total, pages: Math.max(1, Math.ceil(total / p.size)),
  };
}

// The panel's growth tab, top part.
export async function growthOverview(channel) {
  const cid = String(channel.chat_id);
  const t = now();
  const [members, week, prevWeek, votes, prevVotes, quality, eng, hours, referrers, since] = await Promise.all([
    memberCount(cid),
    memberMoves(cid, t - 7 * DAY, t + 1),
    memberMoves(cid, t - 14 * DAY, t - 7 * DAY),
    realVotes(cid, t - 7 * DAY, t + 1),
    realVotes(cid, t - 14 * DAY, t - 7 * DAY),
    voteQuality(cid),
    engagement(cid, t - 30 * DAY),
    bestHours(cid, t - 60 * DAY),
    topReferrers(cid, t - 30 * DAY),
    db.get(sql`SELECT min(at) AS at FROM member_events WHERE channel_id = ${cid}`),
  ]);
  return {
    members,
    week, prevWeek, votes, prevVotes, quality,
    engagement: eng,
    bestHours: hours.slice(0, 3),
    referrers,
    trackingSince: since?.at ?? null,
    growthButtons: channel.growth_buttons !== 0 && channel.growth_buttons !== false,
  };
}

// ---------- manager actions (panel) ----------

export class GrowthError extends Error {}

// A named invite link for a campaign (Instagram, an ad, a partner channel…).
// The same name again returns the link made before.
export async function createCampaignLink(channel, name, createdBy) {
  const clean = typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').slice(0, LINK_NAME_MAX) : '';
  if (!clean) throw new GrowthError('یک اسم برای لینک بنویسید (مثلاً اینستاگرام)');
  try {
    return await ensureLink(channel.chat_id, 'campaign', clean, createdBy);
  } catch (e) {
    if (e?.code === 400 || e?.code === 403) {
      throw new GrowthError('ربات اجازه ساخت لینک دعوت ندارد؛ در تنظیمات ادمین کانال، دسترسی «افزودن مشترک / دعوت با لینک» را به ربات بدهید.');
    }
    throw e;
  }
}

// A native poll in the channel (e.g. which song to post next).
export async function sendPoll(channel, question, options) {
  const q = typeof question === 'string' ? question.trim().slice(0, 300) : '';
  const opts = (Array.isArray(options) ? options : [])
    .map((o) => (typeof o === 'string' ? o.trim().slice(0, 100) : ''))
    .filter(Boolean);
  if (!q) throw new GrowthError('سؤال نظرسنجی را بنویسید');
  if (opts.length < 2 || opts.length > 10) throw new GrowthError('نظرسنجی باید بین ۲ تا ۱۰ گزینه داشته باشد');
  try {
    const sent = await api.sendPoll({ chat_id: channel.chat_id, question: q, options: opts.map((text) => ({ text })) });
    return { message_id: sent?.message_id ?? null };
  } catch (e) {
    if (e?.code === 400 || e?.code === 403) throw new GrowthError(`تلگرام نظرسنجی را نپذیرفت: ${e.description ?? e.message}`);
    throw e;
  }
}

export async function setGrowthButtons(channel, on) {
  await db.run(sql`
    UPDATE channels SET growth_buttons = ${on ? 1 : 0}, updated_at = unixepoch() WHERE chat_id = ${String(channel.chat_id)}`);
}
