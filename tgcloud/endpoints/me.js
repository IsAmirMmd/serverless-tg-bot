// POST /api/me — who is opening the panel: { isOwner, channels: [{ chat_id, title, username, status, role }] }.
// Members get only their channels; anyone else gets an empty list (the panel shows "no access").
import { db } from 'sdk';
import { sql } from 'sdk/db';
import { callerId, isOwner } from '../lib/access.js';

export default async function (input, ctx) {
  const owner = isOwner(ctx);
  const channels = owner
    ? await db.all(sql`SELECT chat_id, title, username, status, 'owner' AS role FROM channels ORDER BY created_at`)
    : await db.all(sql`
        SELECT c.chat_id, c.title, c.username, c.status, m.role
        FROM channel_members m JOIN channels c ON c.chat_id = m.channel_id
        WHERE m.user_id = ${callerId(ctx)}
        ORDER BY m.added_at`);
  return { isOwner: owner, channels };
}
