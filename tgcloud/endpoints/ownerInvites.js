// POST /api/ownerInvites — invite links not used, revoked or expired yet. Owner only.
import { requireOwner } from '../lib/access.js';
import { listInvites } from '../lib/owner.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  return { rows: await listInvites() };
}
