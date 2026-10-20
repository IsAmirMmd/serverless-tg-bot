# Telegram Stars: subscriptions, credits, refunds, gifts

Digital goods in Telegram are sold for **Stars**: `currency: 'XTR'` with
`provider_token: ''`. The flow:

1. **invoice**: `sendInvoice` in the chat, or `createInvoiceLink`, which the
   Mini App opens with `Telegram.WebApp.openInvoice`.
2. **`pre_checkout_query`**: answer it within 10 seconds.
3. **`message.successful_payment`**: grant what was bought.

## Config and tables

```js
// lib/config.js
export const PLANS = [
  { id: 'm1', months: 1, stars: 199, title: 'اشتراک یک‌ماهه' },
  { id: 'm3', months: 3, stars: 499, title: 'اشتراک سه‌ماهه' },
];
export const RENEW_REMINDER_DAYS = 3;
export const AUTO_ACTIVATE_PAID = true;   // a paid channel activates without the owner
```

```js
// One row per payment. Bought before the buyer has a channel → credit (channel_id null),
// applied when they add the bot.
export const payments = table('payments', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  charge_id:    text('charge_id').notNull(),          // telegram_payment_charge_id — needed for refunds
  user_id:      integer('user_id').notNull(),
  user_name:    text('user_name'),
  plan:         text('plan').notNull(),               // PLANS[].id | 'gift'
  months:       integer('months').notNull(),
  days:         integer('days'),                      // gifts
  stars:        integer('stars').notNull(),
  channel_id:   text('channel_id'),                   // null = unused credit
  period_start: integer('period_start').notNull(),
  period_end:   integer('period_end').notNull(),
  refunded_at:  integer('refunded_at'),
  created_at:   integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({ charge: uniqueIndex('uidx_payments_charge').on(t.charge_id) }));
```

Add these to `channels` (nullable, for idempotent reminders): `reminded_for`
and `expired_for`, each holding the `expires_at` value already notified.

## Invoice

```js
function invoiceParams(plan, channel) {
  return {
    title: plan.title,
    description: `… ${plan.months} ماه`.slice(0, 255),
    payload: channel ? `plan:${plan.id}:${channel.chat_id}` : `plan:${plan.id}`,   // ≤ 128 bytes; parsed back later
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: plan.title, amount: plan.stars }],
  };
}
export const sendPlanInvoice = (chatId, plan, channel) => api.sendInvoice({ chat_id: chatId, ...invoiceParams(plan, channel) });
export const planInvoiceLink = (plan, channel) => api.createInvoiceLink(invoiceParams(plan, channel));

export function parsePayload(payload) {
  const m = /^plan:(\w+)(?::(-?\d+))?$/.exec(payload ?? '');
  const plan = m && PLANS.find((p) => p.id === m[1]);
  return plan ? { plan, channelId: m[2] ?? null } : null;
}
// Payload, currency and amount must all match a current plan.
export function planFor(payload, currency, amount) {
  const p = parsePayload(payload);
  return p && currency === 'XTR' && amount === p.plan.stars ? p.plan : null;
}
```

The menu's `buy:<plan>[:<chat id>]` buttons call `sendPlanInvoice`. A Mini App
asks an endpoint for `planInvoiceLink` and opens it.

## handlers/pre_checkout_query.js

```js
export default async function (query) {
  const plan = planFor(query.invoice_payload, query.currency, query.total_amount);
  const channelId = parsePayload(query.invoice_payload)?.channelId;
  const ok = Boolean(plan) && (!channelId || Boolean(await getChannel(channelId)));
  await api.answerPreCheckoutQuery(ok
    ? { pre_checkout_query_id: query.id, ok: true }
    : { pre_checkout_query_id: query.id, ok: false, error_message: 'This invoice is no longer valid — open the prices again.' });
}
```

It must answer quickly and always. A stale invoice (old price, deleted
channel) is refused here, before any Stars move.

## successful_payment (first line of handlers/message.js)

`if (message.successful_payment) return recordPayment(message);`

```js
export async function recordPayment(message) {
  const p = message.successful_payment;
  const parsed = parsePayload(p.invoice_payload);
  const months = parsed?.plan?.months ?? 1;
  // The channel: named in the invoice, else the buyer's only channel, else credit.
  let channel = parsed?.channelId ? await getChannel(parsed.channelId) : null;
  if (!channel) { const mine = await userChannels(message.from.id); if (mine.length === 1) channel = mine[0]; }
  let start = now(), end = start + months * MONTH;
  if (channel) ({ start, end } = await extend(channel, months * MONTH));   // from max(now, expires_at)
  await db.run(sql`
    INSERT INTO payments (charge_id, user_id, user_name, plan, months, stars, channel_id, period_start, period_end)
    VALUES (${p.telegram_payment_charge_id}, ${message.from.id}, ${message.from.username ?? null},
            ${parsed?.plan.id ?? p.invoice_payload}, ${months}, ${p.total_amount}, ${channel?.chat_id ?? null}, ${start}, ${end})
    ON CONFLICT (charge_id) DO NOTHING`);          // the same update delivered twice records once
  if (channel) channel = await activatePaid(channel, message.from.id);   // AUTO_ACTIVATE_PAID + buyer becomes manager
  // thank the buyer (what they got, until when, what to do next) + notify ADMIN_ID with the charge id
}
```

- `extend(channel, seconds)` sets
  `expires_at = max(now, coalesce(expires_at, now)) + seconds` and returns the
  period. A renewal before expiry adds to the remaining time.
- **Credits**: someone may pay before adding the bot. In `my_chat_member`,
  after `saveChannel`, `applyCredits(channel)` takes `added_by`'s unused
  payments (`channel_id IS NULL AND refunded_at IS NULL`, oldest first),
  extends the channel for each, writes `channel_id` and the period onto the
  payment, and activates the channel.

## Refunds (owner, from the panel)

```js
await api.refundStarPayment({ user_id: p.user_id, telegram_payment_charge_id: p.charge_id });
await db.run(sql`UPDATE payments SET refunded_at = unixepoch() WHERE id = ${p.id}`);
await db.run(sql`UPDATE channels SET expires_at = expires_at - ${p.months * MONTH} WHERE chat_id = ${p.channel_id} AND expires_at IS NOT NULL`);
```

Refuse gifts (0 Stars) and payments that were already refunded.

## Renewal reminders and expiry: a daily cron

`/billing` as an admin command, run by a `scheduled.yml` job every day:

```js
// Reminders: live, expiring within RENEW_REMINDER_DAYS, not yet reminded for this expires_at.
const soon = await db.all(sql`SELECT * FROM channels WHERE status = 'active' AND expires_at IS NOT NULL
  AND expires_at > ${t} AND expires_at <= ${t + RENEW_REMINDER_DAYS * DAY}
  AND (reminded_for IS NULL OR reminded_for != expires_at)`);
// → notify every manager with renew buttons `buy:<plan>:<chat id>`; then SET reminded_for = expires_at
// Expired: expires_at <= now AND (expired_for IS NULL OR expired_for != expires_at) → notify once; SET expired_for = expires_at
```

Store the notified `expires_at`, not a boolean. A renewal changes
`expires_at`, which re-arms both notices automatically, and a cron that runs
twice notifies once.

## Gift codes (free days)

`gift_codes(code PK, days, created_by, used_by, used_at, revoked, expires_at)`.

- **Link**: `?start=gift_<code>`.
- **Redeeming**: the user gets a 0-Star `payments` row (`plan: 'gift'`,
  `days`).
- **Where the days go**: onto their only channel, or kept as credit,
  exactly like a paid credit.
- **The link expires** after 30 days if unused. The days themselves never do.

## Tests

- `pre_checkout`: a wrong amount → `ok: false`.
- `successful_payment` twice with the same charge id → one row.
- Payment before the channel exists → credit, then applied on `my_chat_member`.
- `/billing` run twice → each notice sent once.
- Renewal → the reminder is armed again.
