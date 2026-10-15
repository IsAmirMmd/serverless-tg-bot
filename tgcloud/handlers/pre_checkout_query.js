// handlers/pre_checkout_query.js — the last check before a Stars payment goes
// through; Telegram needs an answer within 10 seconds.

import { api } from 'sdk';
import { planFor, parsePayload } from '../lib/billing.js';
import { getChannel } from '../lib/channels.js';

export default async function (query, ctx) {
  const plan = planFor(query.invoice_payload, query.currency, query.total_amount);
  const channelId = parsePayload(query.invoice_payload)?.channelId;
  const ok = Boolean(plan) && (!channelId || Boolean(await getChannel(channelId)));
  await api.answerPreCheckoutQuery(ok
    ? { pre_checkout_query_id: query.id, ok: true }
    : { pre_checkout_query_id: query.id, ok: false, error_message: 'این صورتحساب دیگه معتبر نیست؛ از منوی قیمت‌ها دوباره امتحان کن.' });
}
