// POST /api/adminMusicReport { page, size, q } — votes grouped by music, paginated. Admin only.
import { requireAdmin, musicReport } from '../lib/dashboard.js';

export default async function (input, ctx) {
  requireAdmin(ctx);
  return musicReport(input);
}
