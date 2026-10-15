// POST /api/ownerRevokeInvite { code } — the link stops working. Owner only.
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { revokeInvite } from '../lib/owner.js';

export default async function ({ code } = {}, ctx) {
  requireOwner(ctx);
  if (typeof code !== 'string' || !/^[A-Za-z0-9]{8,32}$/.test(code)) {
    throw new EndpointError('کد دعوت نامعتبر است', { code: 'BAD_INPUT' });
  }
  await revokeInvite(code);
  return { ok: true };
}
