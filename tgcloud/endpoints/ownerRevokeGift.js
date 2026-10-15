// POST /api/ownerRevokeGift { code } — the gift link stops working. Owner only.
import { EndpointError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { revokeGiftCode } from '../lib/billing.js';

export default async function ({ code } = {}, ctx) {
  requireOwner(ctx);
  if (typeof code !== 'string' || !/^[A-Za-z0-9]{8,32}$/.test(code)) {
    throw new EndpointError('کد هدیه نامعتبر است', { code: 'BAD_INPUT' });
  }
  await revokeGiftCode(code);
  return { ok: true };
}
