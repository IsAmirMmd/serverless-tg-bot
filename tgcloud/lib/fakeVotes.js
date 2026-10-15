// Fake votes on a channel post — the owner's "liked …" command and the panel
// form both use this. A post is named by its link, which carries the channel:
//   https://t.me/<username>/<post>   (public channel)
//   https://t.me/c/<internal id>/<post>   (private channel)
// or, as before, by its number (+ channel id when several channels have it).

import { db, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { MAX_FAKE_LIKES } from './config.js';
import { upsertLikes, refreshButtons, countLikes } from './likes.js';

export class FakeVoteError extends Error {}

const chatIdOf = (id) => (String(id).startsWith('-100') ? String(id) : `-100${String(id).replace(/^-/, '')}`);

// "https://t.me/chosi_chnl/1339", "t.me/c/1797602120/1339", "@chosi_chnl/1339" → { username | chatId, musicId }
export function parsePostLink(text) {
  const s = String(text ?? '').trim();
  let m = /(?:t\.me|telegram\.me)\/c\/(\d+)\/(\d+)/i.exec(s);
  if (m) return { chatId: `-100${m[1]}`, musicId: Number(m[2]) };
  m = /(?:(?:https?:\/\/)?(?:t\.me|telegram\.me)\/|@)([A-Za-z][A-Za-z0-9_]{3,})\/(\d+)/i.exec(s);
  if (m) return { username: m[1], musicId: Number(m[2]) };
  return null;
}

// → { channel, musicId } for a link, or a number (+ optional channel id). Throws FakeVoteError.
export async function resolvePost({ link, musicId, channelId }) {
  if (link) {
    const parsed = parsePostLink(link);
    if (!parsed) throw new FakeVoteError('لینک پست نامعتبر است. نمونه: https://t.me/channel/123');
    const channel = parsed.chatId
      ? await db.get(sql`SELECT * FROM channels WHERE chat_id = ${parsed.chatId}`)
      : await db.get(sql`SELECT * FROM channels WHERE lower(username) = lower(${parsed.username})`);
    if (!channel) throw new FakeVoteError('این کانال در ربات ثبت نشده است.');
    return { channel, musicId: parsed.musicId };
  }

  const id = Number(musicId);
  if (!Number.isSafeInteger(id) || id <= 0) throw new FakeVoteError('شماره پست نامعتبر است.');
  if (channelId) {
    const channel = await db.get(sql`SELECT * FROM channels WHERE chat_id = ${chatIdOf(channelId)}`);
    if (!channel) throw new FakeVoteError('این کانال در ربات ثبت نشده است.');
    return { channel, musicId: id };
  }
  // Only a number: fine while exactly one channel has votes on that post.
  const rows = await db.all(sql`
    SELECT c.* FROM channels c
    WHERE c.chat_id IN (SELECT DISTINCT channel_id FROM likes WHERE music_id = ${id})`);
  if (!rows.length) throw new FakeVoteError(`پست ${id} در هیچ کانالی رأی ندارد؛ لینک پست را بفرستید.`);
  if (rows.length > 1) {
    throw new FakeVoteError(`پست ${id} در چند کانال هست (${rows.map((c) => c.title ?? c.chat_id).join('، ')}). لینک پست را بفرستید.`);
  }
  return { channel: rows[0], musicId: id };
}

// Adds `count` made-up voters to the post and redraws its buttons.
// → { channel, musicId, added, liked, disliked } (counts after the change).
export async function addFakeVotes({ channel, musicId, liked, count }) {
  const n = Math.trunc(Number(count));
  if (!Number.isFinite(n) || n < 1) throw new FakeVoteError('تعداد باید حداقل ۱ باشد.');
  if (n > MAX_FAKE_LIKES) throw new FakeVoteError(`حداکثر ${MAX_FAKE_LIKES} رأی در هر بار.`);

  // Votes are only useful on a post whose buttons the bot can redraw: check
  // that first (redrawing with unchanged counts is a no-op), save nothing otherwise.
  try {
    await refreshButtons(channel.chat_id, musicId);
  } catch (e) {
    if (e instanceof BotApiError && e.code === 400) {
      throw new FakeVoteError(`پست ${musicId} پیدا نشد یا دکمه‌هایش مال ربات نیست (شاید پاک شده). لینک را چک کنید.`);
    }
    throw e;
  }

  const known = await db.get(sql`
    SELECT max(music_name) AS music_name FROM likes WHERE channel_id = ${channel.chat_id} AND music_id = ${musicId}`);
  const rows = [];
  for (let i = 0; i < n; i++) {
    rows.push({
      user_id: -(Math.floor(Math.random() * 900000000) + 100000000),
      liked: Boolean(liked),
      music_id: musicId,
      user_name: `testuser${Math.floor(Math.random() * 900000) + 100000}`,
      channel_id: channel.chat_id,
      music_name: known?.music_name ?? '',
    });
  }
  await upsertLikes(rows);
  await refreshButtons(channel.chat_id, musicId);
  return { channel, musicId, added: n, ...(await countLikes(channel.chat_id, musicId)) };
}
