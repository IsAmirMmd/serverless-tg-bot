// Owner tab of the panel: channels (activate / pause), members and invites.
// The endpoints in endpoints/owner*.js check requireOwner before calling these.

import { db, EndpointError } from 'sdk';
import { sql } from 'sdk/db';
import { pageParams, searchCondition, whereOf } from './dashboard.js';
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

// The channel named in an owner request, or EndpointError NOT_FOUND.
export async function channelFromInput(channelId) {
  const channel = channelId ? await getChannel(String(channelId)) : null;
  if (!channel) throw new EndpointError('کانال پیدا نشد', { code: 'NOT_FOUND' });
  return channel;
}
