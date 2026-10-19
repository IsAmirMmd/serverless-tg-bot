// Channel subscriptions paid with Telegram Stars.
//
// A channel is served while status = 'active' AND (expires_at is null OR in the
// future) — see isLive() in channels.js, so expiry needs no scheduled job.
// A payment extends one channel; bought before the buyer has a channel, it
// waits as credit and is applied when they add the bot (applyCredits).
// Invoice payload: "plan:<plan id>" or "plan:<plan id>:<chat id>".

import { api, db } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID, PLANS, CONTACT_USERNAME, AUTO_ACTIVATE_PAID, RENEW_REMINDER_DAYS } from './config.js';
import { getChannel, addMember, notify, panelKeyboard, randomCode, getBotUsername } from './channels.js';
import { stamp } from './time.js';

const DAY = 86400;
const MONTH = 30 * DAY;
const now = () => Math.floor(Date.now() / 1000);
const fa = (n) => Number(n).toLocaleString('fa-IR');
export const faDay = (unix) => stamp(new Date(unix * 1000)).slice(0, 10);
const channelName = (c) => `«${c?.title ?? c?.chat_id}»`;

// ---------- plans & invoices ----------

export function parsePayload(payload) {
  const m = /^plan:(\w+)(?::(-?\d+))?$/.exec(payload ?? '');
  if (!m) return null;
  const plan = PLANS.find((p) => p.id === m[1]);
  return plan ? { plan, channelId: m[2] ?? null } : null;
}

// The plan an invoice stands for, or null if payload / currency / amount don't match.
export function planFor(payload, currency, amount) {
  const parsed = parsePayload(payload);
  return parsed && currency === 'XTR' && amount === parsed.plan.stars ? parsed.plan : null;
}

function invoiceParams(plan, channel) {
  const what = channel ? ` برای کانال ${channelName(channel)}` : '';
  return {
    title: plan.title,
    description: `ربات لایک و آمار کانال موزیک${what}، ${fa(plan.months)} ماه (${fa(plan.months * 30)} روز) ⭐️`.slice(0, 255),
    payload: channel ? `plan:${plan.id}:${channel.chat_id}` : `plan:${plan.id}`,
    provider_token: '',            // Telegram Stars
    currency: 'XTR',
    prices: [{ label: plan.title, amount: plan.stars }],
  };
}

export function sendPlanInvoice(chatId, plan, channel = null) {
  return api.sendInvoice({ chat_id: chatId, ...invoiceParams(plan, channel) });
}

// A t.me/$… link the Mini App opens with Telegram.WebApp.openInvoice.
export function planInvoiceLink(plan, channel) {
  return api.createInvoiceLink(invoiceParams(plan, channel));
}

// ---------- channels a user pays for ----------

// Channels the user added the bot to or manages.
export async function userChannels(userId) {
  return db.all(sql`
    SELECT DISTINCT c.* FROM channels c
    LEFT JOIN channel_members m ON m.channel_id = c.chat_id AND m.user_id = ${userId} AND m.role = 'manager'
    WHERE c.added_by = ${userId} OR m.user_id IS NOT NULL
    ORDER BY c.created_at`);
}

// Who hears about a channel's subscription: whoever added the bot, and its managers.
export async function channelContacts(channel) {
  const rows = await db.all(sql`
    SELECT user_id FROM channel_members WHERE channel_id = ${channel.chat_id} AND role = 'manager'`);
  const ids = new Set(rows.map((r) => r.user_id));
  if (channel.added_by) ids.add(channel.added_by);
  ids.delete(ADMIN_ID);
  return [...ids];
}

// Adds `seconds` to a channel's subscription (from now if it already ended).
// → the new expires_at.
async function extend(channel, seconds) {
  const base = Math.max(now(), channel.expires_at ?? 0);
  const end = base + seconds;
  await db.run(sql`
    UPDATE channels SET expires_at = ${end}, updated_at = unixepoch() WHERE chat_id = ${channel.chat_id}`);
  return { start: base, end };
}

// Length a payment row buys: gifts carry days, paid plans months.
const lengthOf = (p) => (p.days != null ? p.days * DAY : p.months * MONTH);

// A 0-Star payments row for an owner gift, so gifts show up next to sales.
async function recordGift({ userId, userName = null, channelId = null, days, unlimited = false, start, end }) {
  await db.run(sql`
    INSERT INTO payments (charge_id, user_id, user_name, plan, months, days, stars, channel_id, period_start, period_end)
    VALUES (${`gift:${randomCode()}`}, ${userId}, ${userName}, ${unlimited ? 'unlimited' : 'gift'}, 0,
            ${unlimited ? null : days}, 0, ${channelId}, ${start}, ${end})`);
}

// Owner gift on an existing channel: +days, or days = null for no limit.
// Recorded against whoever added the bot to it (the owner if unknown).
export async function extendChannel(chatId, days) {
  const channel = await getChannel(chatId);
  if (!channel) return null;
  const userId = channel.added_by ?? ADMIN_ID;
  if (days == null) {
    await db.run(sql`UPDATE channels SET expires_at = NULL, updated_at = unixepoch() WHERE chat_id = ${channel.chat_id}`);
    await recordGift({ userId, channelId: channel.chat_id, unlimited: true, start: now(), end: now() });
  } else {
    const { start, end } = await extend(channel, days * DAY);
    await recordGift({ userId, channelId: channel.chat_id, days, start, end });
  }
  return getChannel(chatId);
}

// ---------- gift links ----------

const GIFT_LINK_DAYS = 30; // how long an unused gift link keeps working

export async function createGiftCode(days, createdBy) {
  const code = randomCode();
  const expiresAt = now() + GIFT_LINK_DAYS * DAY;
  await db.run(sql`
    INSERT INTO gift_codes (code, days, created_by, expires_at) VALUES (${code}, ${days}, ${createdBy}, ${expiresAt})`);
  return { code, days, link: `https://t.me/${await getBotUsername()}?start=gift_${code}`, expires_at: expiresAt };
}

export async function listGiftCodes() {
  const rows = await db.all(sql`
    SELECT * FROM gift_codes
    WHERE used_by IS NULL AND revoked = 0 AND (expires_at IS NULL OR expires_at > unixepoch())
    ORDER BY created_at DESC LIMIT 50`);
  const username = await getBotUsername();
  return rows.map((r) => ({ ...r, revoked: false, link: `https://t.me/${username}?start=gift_${r.code}` }));
}

export async function revokeGiftCode(code) {
  await db.run(sql`UPDATE gift_codes SET revoked = 1 WHERE code = ${String(code)}`);
}

// /start gift_<code> → the gift becomes credit for `user` and, if they already
// have exactly one channel, goes onto it right away.
// → { ok, days, channel? } or { ok: false, reason }
export async function redeemGift(code, user) {
  const gift = await db.get(sql`SELECT * FROM gift_codes WHERE code = ${code}`);
  if (!gift || gift.revoked) return { ok: false, reason: 'این لینک هدیه معتبر نیست.' };
  if (gift.used_by) return { ok: false, reason: gift.used_by === user.id ? 'این هدیه قبلاً برات ثبت شده 😉' : 'این لینک هدیه قبلاً استفاده شده است.' };
  if (gift.expires_at && gift.expires_at < now()) return { ok: false, reason: 'این لینک هدیه منقضی شده است.' };

  await db.run(sql`UPDATE gift_codes SET used_by = ${user.id}, used_at = unixepoch() WHERE code = ${code} AND used_by IS NULL`);

  const mine = await userChannels(user.id);
  let channel = mine.length === 1 ? mine[0] : null;
  let start = now();
  let end = start + gift.days * DAY;
  if (channel) ({ start, end } = await extend(channel, gift.days * DAY));
  await recordGift({ userId: user.id, userName: user.username ?? null, channelId: channel?.chat_id ?? null, days: gift.days, start, end });
  if (channel) channel = await activatePaid(channel, user.id);

  const who = user.username ? `@${user.username}` : `${user.first_name ?? ''} (${user.id})`;
  await notify(ADMIN_ID, `🎁 ${who} هدیه ${fa(gift.days)} روزه را دریافت کرد` +
    (channel ? ` (کانال ${channelName(channel)} تا ${faDay(end)})` : ' (هنوز کانالی ندارد؛ اعتبار ذخیره شد)'));
  return { ok: true, days: gift.days, channel, end };
}

// A paid channel: active (if allowed) and its buyer a manager.
async function activatePaid(channel, buyerId) {
  if (AUTO_ACTIVATE_PAID && channel.status !== 'active') {
    await db.run(sql`UPDATE channels SET status = 'active', updated_at = unixepoch() WHERE chat_id = ${channel.chat_id}`);
  }
  if (buyerId && buyerId !== ADMIN_ID) await addMember(channel.chat_id, { id: buyerId }, 'manager');
  return getChannel(channel.chat_id);
}

// Applies the unused credit of whoever added the bot to `channel`. → number of payments applied.
export async function applyCredits(channel) {
  if (!channel?.added_by) return 0;
  const credits = await db.all(sql`
    SELECT * FROM payments
    WHERE user_id = ${channel.added_by} AND channel_id IS NULL AND refunded_at IS NULL
    ORDER BY created_at`);
  for (const p of credits) {
    const fresh = await getChannel(channel.chat_id);
    const { start, end } = await extend(fresh, lengthOf(p));
    await db.run(sql`
      UPDATE payments SET channel_id = ${channel.chat_id}, period_start = ${start}, period_end = ${end} WHERE id = ${p.id}`);
  }
  if (credits.length) await activatePaid(channel, channel.added_by);
  return credits.length;
}

// ---------- successful payment ----------

// message.successful_payment → store it, extend the channel (or keep it as
// credit), thank the buyer, tell the owner.
export async function recordPayment(message) {
  const p = message.successful_payment;
  const user = message.from;
  const parsed = parsePayload(p.invoice_payload);
  const plan = parsed?.plan;
  const months = plan?.months ?? 1;

  // The channel: named in the invoice, or the buyer's only channel.
  let channel = parsed?.channelId ? await getChannel(parsed.channelId) : null;
  if (!channel) {
    const mine = await userChannels(user.id);
    if (mine.length === 1) channel = mine[0];
  }

  let start = now();
  let end = start + months * MONTH;
  if (channel) ({ start, end } = await extend(channel, months * MONTH));

  await db.run(sql`
    INSERT INTO payments (charge_id, user_id, user_name, plan, months, stars, channel_id, period_start, period_end)
    VALUES (${p.telegram_payment_charge_id}, ${user.id}, ${user.username ?? null},
            ${plan?.id ?? p.invoice_payload}, ${months}, ${p.total_amount},
            ${channel?.chat_id ?? null}, ${start}, ${end})
    ON CONFLICT (charge_id) DO NOTHING`);

  if (channel) channel = await activatePaid(channel, user.id);

  const live = channel && channel.status === 'active';
  const text = channel
    ? `🎉 پرداختت انجام شد، مرسی!\n\n` +
      `${plan?.title ?? 'اشتراک'} کانال ${channelName(channel)} تا ${faDay(end)} تمدید شد ⭐️\n` +
      (live ? 'کانالت فعاله و می‌تونی آمارش رو توی پنل ببینی 📊' : 'به‌زودی فعالش می‌کنیم ✅')
    : `🎉 پرداختت انجام شد، مرسی!\n\n` +
      `${plan?.title ?? 'اشتراک'} برات ذخیره شد ⭐️\n` +
      'قدم بعدی: ربات رو ادمین کانالت کن (ارسال، ویرایش و حذف پیام). ' +
      'به‌محض اینکه اضافه‌ش کنی، اشتراکت روی همون کانال فعال میشه و از همون روز حساب میشه.';
  await api.sendMessage({
    chat_id: message.chat.id,
    text: `${text}\n\nاگه سوالی بود، به ${CONTACT_USERNAME} پیام بده 💬`,
    reply_markup: live ? panelKeyboard() : undefined,
  });

  const who = user.username ? `@${user.username}` : `${user.first_name ?? ''} (${user.id})`;
  await notify(ADMIN_ID,
    `💰 خرید جدید: ${who}\n${plan?.title ?? p.invoice_payload} — ${fa(p.total_amount)} استارز\n` +
    (channel ? `کانال ${channelName(channel)} تا ${faDay(end)}${live ? ' (فعال)' : ''}` : 'هنوز کانالی اضافه نکرده؛ اعتبار ذخیره شد') +
    `\nشناسه پرداخت: ${p.telegram_payment_charge_id}`);
}

// ---------- refunds ----------

// Owner refund: Stars go back, the channel loses the paid time. → the payment row.
export async function refundPayment(paymentId) {
  const p = await db.get(sql`SELECT * FROM payments WHERE id = ${paymentId}`);
  if (!p) return { error: 'پرداخت پیدا نشد' };
  if (p.refunded_at) return { error: 'این پرداخت قبلاً برگشت خورده است' };
  if (!p.stars) return { error: 'هدیه برگشت ندارد' };

  await api.refundStarPayment({ user_id: p.user_id, telegram_payment_charge_id: p.charge_id });
  await db.run(sql`UPDATE payments SET refunded_at = unixepoch() WHERE id = ${p.id}`);
  if (p.channel_id) {
    await db.run(sql`
      UPDATE channels SET expires_at = expires_at - ${p.months * MONTH}, updated_at = unixepoch()
      WHERE chat_id = ${p.channel_id} AND expires_at IS NOT NULL`);
  }
  await notify(p.user_id, `↩️ ${fa(p.stars)} استارز پرداختت برگشت داده شد.`);
  return { payment: await db.get(sql`SELECT * FROM payments WHERE id = ${p.id}`) };
}

// ---------- daily check (GitHub Actions → /billing) ----------

function renewKeyboard(channel) {
  return {
    inline_keyboard: PLANS.map((p, i) => [{
      text: `⭐️ تمدید ${p.title} — ${fa(p.stars)} استارز`,
      callback_data: `buy:${p.id}:${channel.chat_id}`,
      style: i === PLANS.length - 1 ? 'success' : 'primary',
    }]),
  };
}

// Reminds managers before a subscription ends and tells everyone once it has.
// → { reminded, expired }
export async function billingCheck() {
  const t = now();
  const soon = await db.all(sql`
    SELECT * FROM channels
    WHERE status = 'active' AND expires_at IS NOT NULL
      AND expires_at > ${t} AND expires_at <= ${t + RENEW_REMINDER_DAYS * DAY}
      AND (reminded_for IS NULL OR reminded_for != expires_at)`);
  for (const c of soon) {
    const days = Math.max(1, Math.ceil((c.expires_at - t) / DAY));
    for (const userId of await channelContacts(c)) {
      await notify(userId,
        `⏳ اشتراک کانال ${channelName(c)} ${fa(days)} روز دیگه (${faDay(c.expires_at)}) تموم میشه.\n` +
        'برای اینکه دکمه‌ها و آمار قطع نشه، همین الان تمدیدش کن 👇',
        { reply_markup: renewKeyboard(c) });
    }
    await db.run(sql`UPDATE channels SET reminded_for = expires_at WHERE chat_id = ${c.chat_id}`);
  }

  const ended = await db.all(sql`
    SELECT * FROM channels
    WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ${t}
      AND (expired_for IS NULL OR expired_for != expires_at)`);
  for (const c of ended) {
    for (const userId of await channelContacts(c)) {
      await notify(userId,
        `⛔️ اشتراک کانال ${channelName(c)} تموم شد؛ پست‌های جدید پردازش نمیشن و دکمه‌ها رأی ثبت نمی‌کنن.\n` +
        'با تمدید، همه‌چیز همون لحظه برمی‌گرده 👇',
        { reply_markup: renewKeyboard(c) });
    }
    await notify(ADMIN_ID, `⛔️ اشتراک کانال ${channelName(c)} در ${faDay(c.expires_at)} تمام شد.`);
    await db.run(sql`UPDATE channels SET expired_for = expires_at WHERE chat_id = ${c.chat_id}`);
  }
  return { reminded: soon.length, expired: ended.length };
}
