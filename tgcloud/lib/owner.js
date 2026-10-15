// Owner tab of the panel: channels (activate / pause), members and invites.
// The endpoints in endpoints/owner*.js check requireOwner before calling these.

import { db, EndpointError } from 'sdk';
import { sql } from 'sdk/db';
import { pageParams, searchCondition, whereOf, orderBy } from './dashboard.js';
import { getChannel, postBase, inviteLink } from './channels.js';

const pages = (total, size) => Math.max(1, Math.ceil(total / size));

// Every channel with its member and vote counts; pending ones first.
export async function listChannels() {
  const rows = await db.all(sql`
    SELECT c.*,
           (SELECT count(*) FROM channel_members m WHERE m.channel_id = c.chat_id) AS members,
           (SELECT count(*) FROM likes l WHERE l.channel_id = c.chat_id) AS votes
    FROM channels c
    ORDER BY CASE c.status WHEN 'pending' THEN 0 WHEN 'active' THEN 1 ELSE 2 END, c.created_at DESC`);
  return rows.map((c) => ({
    ...c,
    members: Number(c.members),
    votes: Number(c.votes),
    link: c.username ? `https://t.me/${c.username}` : null,
    post_base: postBase(c),
  }));
}

export async function listMembers(input = {}) {
  const p = pageParams(input);
  const where = whereOf([
    input.channelId && input.channelId !== 'all' ? sql`m.channel_id = ${String(input.channelId)}` : null,
    searchCondition(input.q, { names: ['m.user_name'], ids: ['m.user_id'] }),
  ]);
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM channel_members m ${where}`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT m.*, c.title AS channel_title
    FROM channel_members m LEFT JOIN channels c ON c.chat_id = m.channel_id
    ${where}
    ORDER BY m.added_at DESC, m.id DESC
    LIMIT ${p.size} OFFSET ${p.offset}`);
  return { rows, page: p.page, size: p.size, total, pages: pages(total, p.size) };
}

// Invites not used, not revoked and not expired.
export async function listInvites() {
  const rows = await db.all(sql`
    SELECT i.*, c.title AS channel_title
    FROM invites i LEFT JOIN channels c ON c.chat_id = i.channel_id
    WHERE i.used_by IS NULL AND i.revoked = 0 AND (i.expires_at IS NULL OR i.expires_at > unixepoch())
    ORDER BY i.created_at DESC
    LIMIT 50`);
  const out = [];
  for (const r of rows) out.push({ ...r, revoked: false, link: await inviteLink(r.code) });
  return out;
}

export async function revokeInvite(code) {
  await db.run(sql`UPDATE invites SET revoked = 1 WHERE code = ${String(code)}`);
}

// Stars payments, newest first, plus totals. A row is "active" while its
// period has not ended.
export async function listPayments(input = {}) {
  const p = pageParams(input);
  const where = whereOf([
    input.kind === 'paid' ? sql`p.stars > 0` : input.kind === 'gift' ? sql`p.stars = 0` : null,
    searchCondition(input.q, { names: ['p.user_name', 'p.charge_id'], ids: ['p.user_id'] }),
  ]);
  const total = Number((await db.get(sql`SELECT count(*) AS n FROM payments p ${where}`))?.n ?? 0);
  const rows = await db.all(sql`
    SELECT p.*, c.title AS channel_title, c.expires_at AS channel_expires_at,
           p.refunded_at IS NULL AND p.period_end > unixepoch() AS active
    FROM payments p LEFT JOIN channels c ON c.chat_id = p.channel_id
    ${where}
    ${orderBy(input, { date: 'p.created_at', stars: 'p.stars', end: 'p.period_end' }, 'date', 'p.id DESC')}
    LIMIT ${p.size} OFFSET ${p.offset}`);
  // Totals leave refunded payments out; "active" = paid channels still running.
  const sums = await db.get(sql`
    SELECT count(*) AS payments,
           coalesce(sum(stars), 0) AS stars,
           coalesce(sum(CASE WHEN created_at > unixepoch() - 30 * 86400 THEN stars END), 0) AS stars_30d,
           (SELECT count(*) FROM channels WHERE status = 'active' AND expires_at > unixepoch()) AS active_users,
           (SELECT count(*) FROM payments WHERE channel_id IS NULL AND refunded_at IS NULL) AS credits
    FROM payments WHERE refunded_at IS NULL`);
  return {
    rows: rows.map((r) => ({ ...r, active: r.active === 1 })),
    page: p.page, size: p.size, total, pages: pages(total, p.size),
    summary: Object.fromEntries(Object.entries(sums ?? {}).map(([k, v]) => [k, Number(v ?? 0)])),
  };
}

// The channel named in an owner request, or EndpointError NOT_FOUND.
export async function channelFromInput(channelId) {
  const channel = channelId ? await getChannel(String(channelId)) : null;
  if (!channel) throw new EndpointError('کانال پیدا نشد', { code: 'NOT_FOUND' });
  return channel;
}
