// POST /api/adminLikes { page, size, q, filter: 'all'|'liked'|'disliked' } — the votes, paginated. Admin only.
import { requireAdmin, listLikes } from '../lib/dashboard.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return listLikes(input);
}
