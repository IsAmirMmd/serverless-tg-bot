// POST /api/adminUserReport { channelId, page, size, q } — votes grouped by (channel, user), paginated.
import { channelScope } from '../lib/access.js';
import { userReport } from '../lib/dashboard.js';

export default async function (input, ctx) {
  return userReport(await channelScope(ctx, input.channelId), input);
}
