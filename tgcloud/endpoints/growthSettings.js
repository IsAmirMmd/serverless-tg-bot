// POST /api/growthSettings { channelId, growthButtons } — turns the "my songs /
// send to a friend" row under new posts on or off. Managers and the owner.
import { managedChannel } from '../lib/access.js';
import { setGrowthButtons } from '../lib/growth.js';

export default async function (input, ctx) {
  const channel = await managedChannel(ctx, input.channelId);
  await setGrowthButtons(channel, Boolean(input.growthButtons));
  return { growthButtons: Boolean(input.growthButtons) };
}
