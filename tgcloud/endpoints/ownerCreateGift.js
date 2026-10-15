// POST /api/ownerCreateGift { days } — a one-time gift link (t.me/<bot>?start=gift_<code>)
// worth `days` of free subscription; the link works for 30 days. Owner only.
import { EndpointError } from 'sdk';
import { requireOwner, callerId } from '../lib/access.js';
import { createGiftCode } from '../lib/billing.js';

export default async function ({ days } = {}, ctx) {
  requireOwner(ctx);
  const n = Math.trunc(Number(days));
  if (!(n >= 1 && n <= 3650)) throw new EndpointError('تعداد روز باید بین ۱ تا ۳۶۵۰ باشد', { code: 'BAD_INPUT' });
  return createGiftCode(n, callerId(ctx));
}
