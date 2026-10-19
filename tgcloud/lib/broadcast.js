// Owner messages to a segment of the people who started the bot. Sent from the
// panel in batches (the endpoint returns progress; the panel calls again until
// done), so no single run takes long. Every message ends with how to opt out
// (/stop); someone who blocked the bot is marked and skipped from then on.
//
// Segment: { channelId: 'all' | chat id, activity: 'all' | 'active30' |
// 'inactive30' | 'new7', artist: text in the name of a song they liked }.

import { api, db, BotApiError, EndpointError } from 'sdk';
import { sql } from 'sdk/db';
import { getChannel } from './channels.js';
import { DAY, now } from './growth.js';
import { shortId } from './postButtons.js';

export const BATCH = 60;
const TEXT_MAX = 3500;
const ACTIVITIES = ['all', 'active30', 'inactive30', 'new7'];
const FOOTER = '\n\n—\n🔕 برای اینکه دیگه از این پیام‌ها نگیری: /stop';

const bad = (msg) => new EndpointError(msg, { code: 'BAD_INPUT' });

// Validated segment from client input. Throws EndpointError.
export async function parseSegment(input = {}) {
  const activity = ACTIVITIES.includes(input.activity) ? input.activity : 'all';
  const artist = typeof input.artist === 'string' ? input.artist.trim().slice(0, 60) : '';
  let channelId = 'all';
  if (input.channelId && input.channelId !== 'all') {
    const channel = await getChannel(String(input.channelId));
    if (!channel) throw bad('کانال پیدا نشد');
    channelId = channel.chat_id;
  }
  return { channelId, activity, artist };
}

function audienceWhere(seg, after = 0) {
  const t = now();
  const conds = [
    sql`u.user_id > ${after}`,
    sql`u.start_count > 0 AND coalesce(u.blocked, 0) = 0 AND coalesce(u.unsubscribed, 0) = 0`,
  ];
  if (seg.channelId !== 'all') {
    const s = shortId(seg.channelId);
    // Voted in the channel, or came to the bot from one of its posts.
    conds.push(sql`(u.user_id IN (SELECT user_id FROM likes WHERE channel_id = ${seg.channelId})
      OR u.start_param = ${`m${s}`} OR u.start_param LIKE ${`s${s}\\_%`} ESCAPE '\\')`);
  }
  if (seg.artist) {
    conds.push(sql`EXISTS (SELECT 1 FROM likes l WHERE l.user_id = u.user_id AND l.liked = 1
      AND l.music_name LIKE ${`%${seg.artist}%`}
      ${seg.channelId !== 'all' ? sql`AND l.channel_id = ${seg.channelId}` : sql``})`);
  }
  if (seg.activity === 'active30') conds.push(sql`u.last_vote_at > ${t - 30 * DAY}`);
  if (seg.activity === 'inactive30') conds.push(sql`(u.last_vote_at IS NULL OR u.last_vote_at <= ${t - 30 * DAY})`);
  if (seg.activity === 'new7') conds.push(sql`u.first_seen_at > ${t - 7 * DAY}`);
  return sql`WHERE ${conds.reduce((a, b) => sql`${a} AND ${b}`)}`;
}

export async function audienceCount(seg) {
  return Number((await db.get(sql`SELECT count(*) AS n FROM bot_users u ${audienceWhere(seg)}`))?.n ?? 0);
}

export async function recentBroadcasts(limit = 5) {
  return db.all(sql`SELECT * FROM broadcasts ORDER BY id DESC LIMIT ${limit}`);
}

export async function createBroadcast(createdBy, seg, text) {
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) throw bad('متن پیام خالی است');
  if (body.length > TEXT_MAX) throw bad(`متن پیام حداکثر ${TEXT_MAX} کاراکتر است`);
  const total = await audienceCount(seg);
  if (!total) throw bad('هیچ کاربری با این شرایط پیدا نشد');
  const r = await db.run(sql`
    INSERT INTO broadcasts (created_by, segment, text, total)
    VALUES (${createdBy}, ${JSON.stringify(seg)}, ${body}, ${total})`);
  return Number(r.lastInsertRowid);
}

// Sends the next batch of a broadcast. → the broadcast row after it.
export async function sendBatch(id) {
  const b = await db.get(sql`SELECT * FROM broadcasts WHERE id = ${id}`);
  if (!b) throw new EndpointError('این ارسال پیدا نشد', { code: 'NOT_FOUND' });
  if (b.status === 'done') return b;

  const seg = JSON.parse(b.segment);
  const users = await db.all(sql`
    SELECT u.user_id FROM bot_users u ${audienceWhere(seg, b.cursor)} ORDER BY u.user_id LIMIT ${BATCH}`);
  let sent = 0;
  let failed = 0;
  let cursor = b.cursor;
  let paused = false;
  for (const { user_id: userId } of users) {
    try {
      await api.sendMessage({ chat_id: userId, text: b.text + FOOTER, link_preview_options: { is_disabled: true } });
      sent += 1;
    } catch (e) {
      if (!(e instanceof BotApiError)) throw e;
      if (e.code === 429) {
        paused = true;   // too fast: stop here, the next call continues from this user
        break;
      }
      failed += 1;
      // Blocked the bot, deleted their account, or never really started it.
      if (e.code === 403 || /chat not found|deactivated/i.test(e.description ?? '')) {
        await db.run(sql`UPDATE bot_users SET blocked = 1 WHERE user_id = ${userId}`);
      }
    }
    cursor = userId;
  }
  const done = !paused && users.length < BATCH;
  await db.run(sql`
    UPDATE broadcasts SET sent = sent + ${sent}, failed = failed + ${failed}, cursor = ${cursor},
      status = ${done ? 'done' : 'sending'}, finished_at = ${done ? now() : null}
    WHERE id = ${id}`);
  return db.get(sql`SELECT * FROM broadcasts WHERE id = ${id}`);
}

// /stop in a private chat.
export async function unsubscribe(message) {
  await db.run(sql`UPDATE bot_users SET unsubscribed = 1 WHERE user_id = ${message.from.id}`);
  await api.sendMessage({
    chat_id: message.chat.id,
    text: '🔕 باشه، دیگه پیامی از طرف ما برات نمیاد.\nهر وقت خواستی برگردی، /start رو بزن.',
  });
}
