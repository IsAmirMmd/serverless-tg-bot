// POST /api/ownerChannels — every channel with status, members and votes. Owner only.
import { requireOwner } from '../lib/access.js';
import { listChannels } from '../lib/owner.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  return { rows: await listChannels() };
}
