// handlers/pre_checkout_query.js — the last check before a Stars payment goes
// through; Telegram needs an answer within 10 seconds.

import { api } from 'sdk';
import { planFor } from '../lib/menu.js';

export default async function (query, ctx) {
  const plan = planFor(query.invoice_payload, query.currency, query.total_amount);
  await api.answerPreCheckoutQuery(plan
    ? { pre_checkout_query_id: query.id, ok: true }
    : { pre_checkout_query_id: query.id, ok: false, error_message: 'این صورتحساب دیگه معتبر نیست؛ از منوی قیمت‌ها دوباره امتحان کن.' });
}
