// POST /api/ownerPayments { page, size, q } — Stars payments with totals. Owner only.
import { requireOwner } from '../lib/access.js';
import { listPayments } from '../lib/owner.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  return listPayments(input);
}
