// POST /api/ownerSetChannelStatus { channelId, status: 'active'|'paused' } — Owner only.
// Activating makes the user who added the bot a manager of the channel.
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { setStatus } from '../lib/channels.js';
import { channelFromInput } from '../lib/owner.js';

export default async function ({ channelId, status } = {}, ctx) {
  requireOwner(ctx);
  if (!['active', 'paused'].includes(status)) {
    throw new EndpointError('وضعیت نامعتبر است', { code: 'BAD_INPUT' });
  }
  const channel = await channelFromInput(channelId);
  return setStatus(channel.chat_id, status);
}
