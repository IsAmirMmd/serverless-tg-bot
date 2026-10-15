// POST /api/ownerMembers { channelId?, page, size, q } — who can see which channel. Owner only.
import { requireOwner } from '../lib/access.js';
import { listMembers } from '../lib/owner.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  return listMembers(input);
}
