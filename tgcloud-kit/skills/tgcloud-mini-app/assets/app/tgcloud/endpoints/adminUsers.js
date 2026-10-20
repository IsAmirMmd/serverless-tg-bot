// POST /api/adminUsers — { page, size, q, sort, dir } → { rows, page, size, total, pages }.
import { requireAdmin } from '../lib/access.js';
import { listUsers } from '../lib/users.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return listUsers(input);
}
