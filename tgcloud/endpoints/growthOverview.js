// POST /api/growthOverview { channelId } — the growth tab's tiles and short
// lists for one channel: members, joins/leaves, real votes, engagement, best
// posting hours, top inviters, and whether the caller may change things.
import { readableChannel, callerId } from '../lib/access.js';
import { isManager } from '../lib/channels.js';
import { growthOverview } from '../lib/growth.js';

export default async function (input, ctx) {
  const channel = await readableChannel(ctx, input.channelId);
  return { ...(await growthOverview(channel)), canManage: await isManager(callerId(ctx), channel) };
}
