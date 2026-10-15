import { db, api } from 'sdk';
import { eq, asc, sql } from 'sdk/db';
import { likes } from '../schema.js';

const COLUMNS = ['user_id', 'liked', 'music_id', 'user_name', 'channel_id', 'music_name'];
const CHUNK = 50;

// Saves votes. A row for an existing (music_id, user_id) replaces that user's
// vote — the n8n "Upsert row(s)" node, matched on user_id + music_id — or,
// with keepExisting, is skipped.
export async function upsertLikes(rows, { keepExisting = false } = {}) {
  const onConflict = keepExisting
    ? 'DO NOTHING'
    : `DO UPDATE SET
         liked = excluded.liked,
         user_name = excluded.user_name,
         channel_id = excluded.channel_id,
         music_name = excluded.music_name,
         updated_at = unixepoch()`;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const params = {};
    const values = rows.slice(i, i + CHUNK).map((row, r) => {
      const names = COLUMNS.map((col) => {
        const name = `:r${r}_${col}`;
        params[name] = col === 'liked' ? (row.liked ? 1 : 0) : (row[col] ?? null);
        return name;
      });
      return `(${names.join(', ')})`;
    });
    await db.run(
      `INSERT INTO likes (${COLUMNS.join(', ')}) VALUES ${values.join(', ')}
       ON CONFLICT (music_id, user_id) ${onConflict}`,
      params,
    );
  }
}

export async function countAllLikes() {
  return db.$count(likes);
}

export async function allLikes() {
  return db.select().from(likes).orderBy(asc(likes.id)).all();
}

// A row of a music, to find out its channel and name. Prefers a row that
// knows the channel: imported rows may not.
export async function findMusic(musicId) {
  const rows = await db.select().from(likes).where(eq(likes.music_id, musicId)).all();
  return rows.find((r) => r.channel_id) ?? rows[0] ?? null;
}

export async function countLikes(musicId) {
  const row = await db.get(sql`
    SELECT coalesce(sum(liked = 1), 0) AS liked, coalesce(sum(liked = 0), 0) AS disliked
    FROM likes WHERE music_id = ${musicId}`);
  return { liked: Number(row?.liked ?? 0), disliked: Number(row?.disliked ?? 0) };
}

export function likeKeyboard(liked = 0, disliked = 0) {
  return {
    inline_keyboard: [[
      { text: `❤️ (${liked})`, callback_data: '0_liked' },
      { text: `🥀 (${disliked})`, callback_data: '0_disliked' },
    ]],
  };
}

// Redraws the buttons under a channel post with the current counts.
export async function refreshButtons(chatId, musicId) {
  const { liked, disliked } = await countLikes(musicId);
  try {
    await api.editMessageReplyMarkup({
      chat_id: chatId,
      message_id: musicId,
      reply_markup: likeKeyboard(liked, disliked),
    });
  } catch (e) {
    // Same counts as already shown, e.g. a user pressing the same button twice.
    if (!(e.code === 400 && /not modified/i.test(e.description ?? ''))) throw e;
  }
}
