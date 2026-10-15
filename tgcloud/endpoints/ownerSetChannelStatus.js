// POST /api/ownerSetChannelStatus { channelId, status: 'active'|'paused' } — Owner only.
// Activating makes the user who added the bot a manager of the channel and
// applies their unused paid credit to it.
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { setStatus, getChannel } from '../lib/channels.js';
import { applyCredits } from '../lib/billing.js';
import { channelFromInput } from '../lib/owner.js';

export default async function ({ channelId, status } = {}, ctx) {
  requireOwner(ctx);
  if (!['active', 'paused'].includes(status)) {
    throw new EndpointError('وضعیت نامعتبر است', { code: 'BAD_INPUT' });
  }
  const channel = await channelFromInput(channelId);
  const updated = await setStatus(channel.chat_id, status);
  if (status === 'active' && (await applyCredits(updated))) return getChannel(channel.chat_id);
  return updated;
}
