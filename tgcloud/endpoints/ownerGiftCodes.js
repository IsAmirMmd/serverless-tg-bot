// POST /api/ownerGiftCodes — gift links not used, revoked or expired yet. Owner only.
import { requireOwner } from '../lib/access.js';
import { listGiftCodes } from '../lib/billing.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  return { rows: await listGiftCodes() };
}
