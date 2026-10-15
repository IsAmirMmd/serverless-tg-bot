// POST /api/adminSummary { channelId } — stat tiles for the caller's channel(s).
// channelId: a chat id, or 'all' (owner: every channel; member: their channels).
import { channelScope } from '../lib/access.js';
import { summary } from '../lib/dashboard.js';

export default async function (input, ctx) {
  return summary(await channelScope(ctx, input.channelId));
}
