// POST /api/ownerBroadcastPreview { segment } — how many people a message to
// that segment would reach, and the last few broadcasts. Owner only.
import { requireOwner } from '../lib/access.js';
import { parseSegment, audienceCount, recentBroadcasts } from '../lib/broadcast.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  const segment = await parseSegment(input.segment);
  return { segment, count: await audienceCount(segment), recent: await recentBroadcasts() };
}
