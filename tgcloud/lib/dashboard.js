// Data for the panel Mini App (index.html + src/): stats, paginated votes and
// the per-user / per-music reports, always limited to a channel scope —
// null (every channel, owner only) or a list of chat ids (lib/access.js).

import { db } from 'sdk';
import { sql } from 'sdk/db';
import { postBase } from './channels.js';

const toInt = (v, fallback) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

// { page, size } from the client → clamped values plus the SQL offset.
export function pageParams(input = {}) {
  const size = Math.min(100, Math.max(5, toInt(input.size, 20)));
  const page = Math.max(1, toInt(input.page, 1));
  return { page, size, offset: (page - 1) * size };
}

// `channel_id IN (…)` for a scope, or null for every channel.
export function scopeCondition(scope, column = 'channel_id') {
  if (!scope) return null;
  if (!scope.length) return sql`0`;
  const list = scope.map((id) => sql`${String(id)}`).reduce((a, b) => sql`${a}, ${b}`);
  return sql`${sql.raw(column)} IN (${list})`;
}

// The search box: text matches names; a number also matches the ids.
export function searchCondition(q, { names, ids }) {
  const text = typeof q === 'string' ? q.trim().slice(0, 100) : '';
  if (!text) return null;
  const pattern = `%${text}%`;
  const parts = names.map((col) => sql`${sql.raw(col)} LIKE ${pattern}`);
  if (/^-?\d+$/.test(text)) parts.push(...ids.map((col) => sql`${sql.raw(col)} = ${Number(text)}`));
  return sql`(${parts.reduce((a, b) => sql`${a} OR ${b}`)})`;
}

// ORDER BY from the client's { sort, dir }. `columns` maps each allowed sort
// key to a SQL expression written here — the client's value is only ever a
// lookup key, never SQL. Empty values sort last either way; `tiebreak` keeps
// pages stable. → sql`ORDER BY …`
export function orderBy(input, columns, fallback, tiebreak) {
  const key = Object.prototype.hasOwnProperty.call(columns, input?.sort ?? '') ? input.sort : fallback;
  const dir = input?.dir === 'asc' ? sql.raw('ASC') : sql.raw('DESC');
  const expr = sql.raw(columns[key]);
  return sql`ORDER BY (${expr}) IS NULL, ${expr} ${dir}, ${sql.raw(tiebreak)}`;
}

export const whereOf = (conds) => {
  const list = conds.filter(Boolean);
  return list.length ? sql`WHERE ${list.reduce((a, b) => sql`${a} AND ${b}`)}` : sql``;
};

// Adds channel_title, post_base (link prefix for a music id of that channel)
// and music_url to rows that carry channel_id.
async function withLinks(rows) {
  const channels = new Map((await db.all(sql`SELECT * FROM channels`)).map((c) => [c.chat_id, c]));
  return rows.map((r) => {
    if (r.channel_id == null) return r;
    const channel = channels.get(String(r.channel_id)) ?? { chat_id: String(r.channel_id) };
    const base = postBase(channel);
    return {
      ...r,
      channel_title: channel.title ?? channel.username ?? String(r.channel_id),
      post_base: base,
      ...(r.music_id != null ? { music_url: base ? base + r.music_id : null } : {}),
    };
  });
}

// { rows, page, size, total, pages }
async function pageResult(rows, total, { page, size }) {
  return { rows: await withLinks(rows), page, size, total, pages: Math.max(1, Math.ceil(total / size)) };
}

// Sort keys the panel may ask for (src/views.jsx lists the same keys).
const LIKES_SORT = {
  date: 'coalesce(updated_at, created_at)',
  user: 'lower(user_name)',
  music: 'lower(music_name)',
  vote: 'liked',
};
const USERS_SORT = {
  votes: 'total_votes',
  likes: 'total_liked',
  dislikes: 'total_disliked',
  last: 'last_vote_at',
  name: 'lower(user_name)',
};
const MUSICS_SORT = {
  likes: 'total_likes',
  dislikes: 'total_dislikes',
  votes: 'total_likes + total_dislikes',
  ratio: 'CAST(total_likes AS REAL) / (total_likes + total_dislikes)',
  post: 'music_id',
  last: 'last_vote_at',
  name: 'lower(music_name)',
};

// Totals for the stat tiles.
export async function summary(scope) {
  const row = await db.get(sql`
    SELECT count(*) AS votes,
           coalesce(sum(liked = 1), 0) AS likes,
           coalesce(sum(liked = 0), 0) AS dislikes,
           count(DISTINCT user_id) AS users,
           count(DISTINCT channel_id || ':' || music_id) AS musics
    FROM likes ${whereOf([scopeCondition(scope)])}`);
  return Object.fromEntries(Object.entries(row ?? {}).map(([k, v]) => [k, Number(v ?? 0)]));
}

// Raw votes, newest first. filter: 'all' | 'liked' | 'disliked'.
export async function listLikes(scope, input = {}) {
  const p = pageParams(input);
  const where = whereOf([
    scopeCondition(scope),
    input.filter === 'liked' ? sql`liked = 1` : input.filter === 'disliked' ? sql`liked = 0` : null,
    searchCondition(input.q, { names: ['user_name', 'music_name'], ids: ['music_id', 'user_id'] }),
  ]);
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM likes ${where}`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT id, user_id, user_name, music_id, music_name, liked, channel_id, created_at, updated_at
    FROM likes ${where}
    ${orderBy(input, LIKES_SORT, 'date', 'id DESC')}
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return pageResult(rows.map((r) => ({ ...r, liked: r.liked === 1 })), total, p);
}

// One row per (channel, user), most active first.
export async function userReport(scope, input = {}) {
  const p = pageParams(input);
  const having = searchCondition(input.q, { names: ['user_name'], ids: ['user_id'] });
  const grouped = sql`
    SELECT channel_id, user_id,
           max(user_name) AS user_name,
           coalesce(sum(liked = 1), 0) AS total_liked,
           coalesce(sum(liked = 0), 0) AS total_disliked,
           count(*) AS total_votes,
           group_concat(CASE WHEN liked = 1 THEN music_id END, '، ') AS liked_musics,
           group_concat(CASE WHEN liked = 0 THEN music_id END, '، ') AS disliked_musics,
           max(coalesce(updated_at, created_at)) AS last_vote_at
    FROM likes ${whereOf([scopeCondition(scope)])}
    GROUP BY channel_id, user_id`;
  const filtered = having ? sql`SELECT * FROM (${grouped}) WHERE ${having}` : grouped;
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM (${filtered})`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT * FROM (${filtered})
    ${orderBy(input, USERS_SORT, 'votes', 'user_id')}
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return pageResult(rows, total, p);
}

// One row per music (channel post), most liked first.
export async function musicReport(scope, input = {}) {
  const p = pageParams(input);
  const having = searchCondition(input.q, { names: ['music_name'], ids: ['music_id'] });
  const grouped = sql`
    SELECT channel_id, music_id,
           max(music_name) AS music_name,
           coalesce(sum(liked = 1), 0) AS total_likes,
           coalesce(sum(liked = 0), 0) AS total_dislikes,
           group_concat(CASE WHEN liked = 1 THEN coalesce(user_name, user_id) END, '، ') AS liked_by,
           group_concat(CASE WHEN liked = 0 THEN coalesce(user_name, user_id) END, '، ') AS disliked_by,
           max(coalesce(updated_at, created_at)) AS last_vote_at
    FROM likes ${whereOf([scopeCondition(scope)])}
    GROUP BY channel_id, music_id`;
  const filtered = having ? sql`SELECT * FROM (${grouped}) WHERE ${having}` : grouped;
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM (${filtered})`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT * FROM (${filtered})
    ${orderBy(input, MUSICS_SORT, 'likes', 'music_id DESC')}
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return pageResult(rows, total, p);
}
