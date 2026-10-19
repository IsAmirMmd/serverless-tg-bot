// POST /api/growthSendPoll { channelId, question, options: [text…] } — posts a
// native poll in the channel. Managers and the owner.
import { EndpointError } from 'sdk';
import { managedChannel } from '../lib/access.js';
import { isLive } from '../lib/channels.js';
import { sendPoll, GrowthError } from '../lib/growth.js';

export default async function (input, ctx) {
  const channel = await managedChannel(ctx, input.channelId);
  if (!isLive(channel)) throw new EndpointError('این کانال فعال نیست', { code: 'NOT_LIVE' });
  try {
    return await sendPoll(channel, input.question, input.options);
  } catch (e) {
    if (e instanceof GrowthError) throw new EndpointError(e.message, { code: 'BAD_INPUT' });
    throw e;
  }
}
