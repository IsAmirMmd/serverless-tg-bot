// POST /api/growthCreateLink { channelId, name } — a named channel invite link
// for a campaign; joins through it show up under that name. Managers and the owner.
import { EndpointError } from 'sdk';
import { managedChannel, callerId } from '../lib/access.js';
import { createCampaignLink, GrowthError } from '../lib/growth.js';

export default async function (input, ctx) {
  const channel = await managedChannel(ctx, input.channelId);
  try {
    const link = await createCampaignLink(channel, input.name, callerId(ctx));
    return { name: link.name, url: link.url };
  } catch (e) {
    if (e instanceof GrowthError) throw new EndpointError(e.message, { code: 'BAD_INPUT' });
    throw e;
  }
}
