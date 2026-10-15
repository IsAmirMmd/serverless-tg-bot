// POST /api/ownerCreateInvite { channelId, role } — a one-time invite link
// (t.me/<bot>?start=inv_<code>, valid 7 days). Owner only.
import { EndpointError } from 'sdk';
import { requireOwner, callerId } from '../lib/access.js';
import { createInvite, ROLES } from '../lib/channels.js';
import { channelFromInput } from '../lib/owner.js';

export default async function ({ channelId, role = 'manager' } = {}, ctx) {
  requireOwner(ctx);
  if (!ROLES.includes(role)) throw new EndpointError('نقش نامعتبر است', { code: 'BAD_INPUT' });
  const channel = await channelFromInput(channelId);
  return { ...(await createInvite(channel.chat_id, role, callerId(ctx))), channel_title: channel.title };
}
