// POST /api/ownerRemoveMember { channelId, userId } — revokes access (and the
// panel button, if it was the user's last channel). Owner only.
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { removeMember } from '../lib/channels.js';

export default async function ({ channelId, userId } = {}, ctx) {
  requireOwner(ctx);
  const id = Number(userId);
  if (!channelId || !Number.isSafeInteger(id)) {
    throw new EndpointError('ورودی نامعتبر است', { code: 'BAD_INPUT' });
  }
  await removeMember(String(channelId), id);
  return { ok: true };
}
