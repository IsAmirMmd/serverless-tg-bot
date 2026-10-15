// POST /api/adminSummary — totals for the admin Mini App. Admin only.
import { requireAdmin, summary } from '../lib/dashboard.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return summary();
}
