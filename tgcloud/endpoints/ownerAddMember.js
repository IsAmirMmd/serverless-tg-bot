// POST /api/ownerAddMember { channelId, userId, role } — grants a Telegram user id
// access directly (the alternative to an invite link). Owner only.
// → { reachable }: false when the user never started the bot (no panel button, no message).
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { addMember, ROLES } from '../lib/channels.js';
import { channelFromInput } from '../lib/owner.js';

export default async function ({ channelId, userId, role = 'manager' } = {}, ctx) {
  requireOwner(ctx);
  const id = Number(userId);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new EndpointError('شناسه عددی کاربر نامعتبر است', { code: 'BAD_INPUT' });
  }
  if (!ROLES.includes(role)) throw new EndpointError('نقش نامعتبر است', { code: 'BAD_INPUT' });
  const channel = await channelFromInput(channelId);
  return addMember(channel.chat_id, { id }, role, { welcome: true });
}
