// POST /api/growthSources { channelId, days: 7 | 30 | 0 (all) } — where new
// members came from, with how many stayed. Campaign links carry their url.
import { readableChannel } from '../lib/access.js';
import { DAY, now, sourceStats } from '../lib/growth.js';

export default async function (input, ctx) {
  const channel = await readableChannel(ctx, input.channelId);
  const days = [7, 30].includes(Number(input.days)) ? Number(input.days) : 0;
  return { rows: await sourceStats(String(channel.chat_id), days ? now() - days * DAY : 0), days };
}
