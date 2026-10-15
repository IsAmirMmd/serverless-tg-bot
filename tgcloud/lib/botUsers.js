// The bot_users table: who has started the bot. Written on every /start,
// listed in the owner's "اعضای ربات" panel tab.

import { db } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID } from './config.js';
import { pageParams, searchCondition, whereOf } from './dashboard.js';

// Records a /start: a new row the first time, then refreshes the name and
// bumps the counter. Never throws — tracking must not break /start.
export async function trackStart(message) {
  const u = message.from;
  if (!u || u.is_bot) return;
  const param = /^\/start\s+(\S+)/.exec(message.text ?? '')?.[1]?.slice(0, 64) ?? null;
  try {
    await db.run(sql`
      INSERT INTO bot_users (user_id, username, first_name, last_name, language_code, is_premium, start_param)
      VALUES (${u.id}, ${u.username ?? null}, ${u.first_name ?? null}, ${u.last_name ?? null},
              ${u.language_code ?? null}, ${u.is_premium ? 1 : 0}, ${param})
      ON CONFLICT (user_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        language_code = excluded.language_code,
        is_premium = excluded.is_premium,
        start_count = bot_users.start_count + 1,
        last_seen_at = unixepoch()`);
  } catch (e) {
    console.error(e);
  }
}

// Owner list: newest first, with whether each user has panel access or paid.
export async function listBotUsers(input = {}) {
  const p = pageParams(input);
  const where = whereOf([
    searchCondition(input.q, { names: ['u.username', 'u.first_name', 'u.last_name'], ids: ['u.user_id'] }),
  ]);
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM bot_users u ${where}`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT u.*,
           (SELECT count(*) FROM channel_members m WHERE m.user_id = u.user_id) AS channels,
           (SELECT coalesce(sum(stars), 0) FROM payments p WHERE p.user_id = u.user_id) AS stars
    FROM bot_users u ${where}
    ORDER BY u.first_seen_at DESC, u.user_id DESC
    LIMIT ${p.size} OFFSET ${p.offset}`);
  const sums = await db.get(sql`
    SELECT count(*) AS users,
           coalesce(sum(first_seen_at > unixepoch() - 86400), 0) AS new_1d,
           coalesce(sum(first_seen_at > unixepoch() - 7 * 86400), 0) AS new_7d,
           coalesce(sum(is_premium = 1), 0) AS premium
    FROM bot_users`);
  return {
    rows: rows.map((r) => ({
      ...r,
      is_premium: r.is_premium === 1,
      is_owner: r.user_id === ADMIN_ID,
      channels: Number(r.channels),
      stars: Number(r.stars),
    })),
    page: p.page, size: p.size, total, pages: Math.max(1, Math.ceil(total / p.size)),
    summary: Object.fromEntries(Object.entries(sums ?? {}).map(([k, v]) => [k, Number(v ?? 0)])),
  };
}
