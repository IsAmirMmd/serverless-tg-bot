// POST /api/adminStats — the admin's numbers for the Mini App's first tab.
import { requireAdmin } from '../lib/access.js';
import { userStats } from '../lib/admin.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return userStats();
}
