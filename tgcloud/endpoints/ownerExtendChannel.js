// POST /api/ownerExtendChannel { channelId, days } — gift subscription time
// (days > 0), or days = null for no limit. Owner only.
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { extendChannel } from '../lib/billing.js';
import { channelFromInput } from '../lib/owner.js';

export default async function ({ channelId, days } = {}, ctx) {
  requireOwner(ctx);
  const n = days == null ? null : Math.trunc(Number(days));
  if (n != null && !(n >= 1 && n <= 3650)) throw new EndpointError('تعداد روز نامعتبر است', { code: 'BAD_INPUT' });
  const channel = await channelFromInput(channelId);
  return extendChannel(channel.chat_id, n);
}
