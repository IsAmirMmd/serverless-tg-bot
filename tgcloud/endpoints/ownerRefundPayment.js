// POST /api/ownerRefundPayment { paymentId } — returns the Stars to the buyer
// and takes the paid time off the channel. Owner only.
import { EndpointError, BotApiError } from 'sdk';
import { requireOwner } from '../lib/access.js';
import { refundPayment } from '../lib/billing.js';

export default async function ({ paymentId } = {}, ctx) {
  requireOwner(ctx);
  const id = Math.trunc(Number(paymentId));
  if (!Number.isSafeInteger(id) || id <= 0) throw new EndpointError('پرداخت نامعتبر است', { code: 'BAD_INPUT' });
  try {
    const result = await refundPayment(id);
    if (result.error) throw new EndpointError(result.error, { code: 'BAD_INPUT' });
    return result.payment;
  } catch (e) {
    if (e instanceof BotApiError) {
      throw new EndpointError(`تلگرام برگشت را قبول نکرد: ${e.description}`, { code: 'REFUND_FAILED' });
    }
    throw e;
  }
}
