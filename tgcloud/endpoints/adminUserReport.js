// POST /api/adminUserReport { page, size, q } — votes grouped by user, paginated. Admin only.
import { requireAdmin, userReport } from '../lib/dashboard.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return userReport(input);
}
