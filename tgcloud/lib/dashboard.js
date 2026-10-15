// Data for the admin Mini App (index.html + src/): paginated likes and the
// per-user / per-music reports. Endpoints in endpoints/admin*.js call these.

import { db, EndpointError } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID } from './config.js';

// Endpoints are reachable by any Telegram user who opens the Mini App;
// ctx.initData is verified by the platform, so its user id can be trusted.
export function requireAdmin(ctx) {
  if (ctx.initData?.user?.id !== ADMIN_ID) {
    throw new EndpointError('دسترسی فقط برای ادمین است', { code: 'FORBIDDEN' });
  }
}

const toInt = (v, fallback) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

// { page, size } from the client → clamped values plus the SQL offset.
export function pageParams(input = {}) {
  const size = Math.min(100, Math.max(5, toInt(input.size, 20)));
  const page = Math.max(1, toInt(input.page, 1));
  return { page, size, offset: (page - 1) * size };
}

const pageResult = (rows, total, { page, size }) =>
  ({ rows, page, size, total, pages: Math.max(1, Math.ceil(total / size)) });

// The search box: text matches names; a number also matches the ids.
function searchCondition(q, { names, ids }) {
  const text = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  if (!text) return null;
  const pattern = `%${text}%`;
  const parts = names.map((col) => sql`${sql.raw(col)} LIKE ${pattern}`);
  if (/^-?\d+$/.test(text)) parts.push(...ids.map((col) => sql`${sql.raw(col)} = ${Number(text)}`));
  return sql`(${parts.reduce((a, b) => sql`${a} OR ${b}`)})`;
}

const whereOf = (conds) => {
  const list = conds.filter(Boolean);
  return list.length ? sql`WHERE ${list.reduce((a, b) => sql`${a} AND ${b}`)}` : sql``;
};

// Totals for the stat tiles.
export async function summary() {
  const row = await db.get(sql`
    SELECT count(*) AS votes,
           coalesce(sum(liked = 1), 0) AS likes,
           coalesce(sum(liked = 0), 0) AS dislikes,
           count(DISTINCT user_id) AS users,
           count(DISTINCT music_id) AS musics
    FROM likes`);
  return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v ?? 0)]));
}

// Raw votes, newest first. filter: 'all' | 'liked' | 'disliked'.
export async function listLikes(input = {}) {
  const p = pageParams(input);
  const where = whereOf([
    input.filter === 'liked' ? sql`liked = 1` : input.filter === 'disliked' ? sql`liked = 0` : null,
    searchCondition(input.q, { names: ['user_name', 'music_name'], ids: ['music_id', 'user_id'] }),
  ]);
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM likes ${where}`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT id, user_id, user_name, music_id, music_name, liked, channel_id, created_at, updated_at
    FROM likes ${where}
    ORDER BY coalesce(updated_at, created_at) DESC, id DESC
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return pageResult(rows.map((r) => ({ ...r, liked: r.liked === 1 })), total, p);
}

// One row per user, most active first.
export async function userReport(input = {}) {
  const p = pageParams(input);
  const having = searchCondition(input.q, { names: ['user_name'], ids: ['user_id'] });
  const grouped = sql`
    SELECT user_id,
           max(user_name) AS user_name,
           coalesce(sum(liked = 1), 0) AS total_liked,
           coalesce(sum(liked = 0), 0) AS total_disliked,
           count(*) AS total_votes,
           group_concat(CASE WHEN liked = 1 THEN music_id END, '، ') AS liked_musics,
           group_concat(CASE WHEN liked = 0 THEN music_id END, '، ') AS disliked_musics,
           max(coalesce(updated_at, created_at)) AS last_vote_at
    FROM likes GROUP BY user_id`;
  const filtered = having ? sql`SELECT * FROM (${grouped}) WHERE ${having}` : grouped;
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM (${filtered})`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT * FROM (${filtered})
    ORDER BY total_votes DESC, user_id
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return pageResult(rows, total, p);
}

// One row per music (channel post), most liked first.
export async function musicReport(input = {}) {
  const p = pageParams(input);
  const having = searchCondition(input.q, { names: ['music_name'], ids: ['music_id'] });
  const grouped = sql`
    SELECT music_id,
           max(music_name) AS music_name,
           coalesce(sum(liked = 1), 0) AS total_likes,
           coalesce(sum(liked = 0), 0) AS total_dislikes,
           group_concat(CASE WHEN liked = 1 THEN coalesce(user_name, user_id) END, '، ') AS liked_by,
           group_concat(CASE WHEN liked = 0 THEN coalesce(user_name, user_id) END, '، ') AS disliked_by,
           max(coalesce(updated_at, created_at)) AS last_vote_at
    FROM likes GROUP BY music_id`;
  const filtered = having ? sql`SELECT * FROM (${grouped}) WHERE ${having}` : grouped;
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM (${filtered})`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT * FROM (${filtered})
    ORDER BY total_likes DESC, total_dislikes ASC, music_id DESC
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return pageResult(rows, total, p);
}
