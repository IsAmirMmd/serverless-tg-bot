// The /start menu (support / help / prices) and buying a plan with Telegram Stars.
// Buttons use `style` (Bot API: 'primary' blue, 'success' green, 'danger' red).
// Callback data: menu:home | menu:help | menu:prices | buy:<plan id>

import { api, db } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID, CONTACT_USERNAME, PLANS, MINI_APP_URL } from './config.js';
import { notify, isMember } from './channels.js';
import { stamp } from './time.js';

const DAY = 86400;
const fa = (n) => Number(n).toLocaleString('fa-IR');
const contactUrl = () => `https://t.me/${CONTACT_USERNAME.replace(/^@/, '')}`;

const backButton = { text: '🔙 برگشت', callback_data: 'menu:home' };
const supportButton = { text: '💬 پشتیبانی', url: contactUrl(), style: 'primary' };

// ---------- screens: { text, reply_markup } ----------

function homeScreen(firstName) {
  const name = firstName ? ` ${firstName}` : '';
  return {
    text:
      `سلام${name} 👋\n\n` +
      'من یه ربات برای کانال‌های موزیکم 🎧\n' +
      'آهنگایی که توی کانال پست میشن رو مرتب می‌کنم، زیرشون دکمه‌ی ❤️ و 🥀 می‌ذارم ' +
      'و حساب می‌کنم کدوم آهنگا بیشتر به دل بقیه نشسته.\n' +
      'صاحب کانال هم یه پنل داره که همه‌ی این آمار رو اونجا می‌بینه 📊\n\n' +
      `اگه می‌خوای ربات روی کانال تو هم باشه یا سوالی داری، به ${CONTACT_USERNAME} پیام بده 😉`,
    reply_markup: { inline_keyboard: [
      [supportButton],
      [{ text: '📖 راهنما و کار با ربات', callback_data: 'menu:help', style: 'success' }],
      [{ text: '💎 قیمت‌ها و خرید اشتراک', callback_data: 'menu:prices', style: 'danger' }],
    ] },
  };
}

function helpScreen() {
  return {
    text:
      '📖 راهنمای کار با ربات\n\n' +
      '1️⃣ ربات رو ادمین کانالت کن. دسترسی «ارسال»، «ویرایش» و «حذف پیام» لازمه.\n' +
      '2️⃣ ما کانالت رو فعال می‌کنیم ✅\n' +
      '3️⃣ از اون به بعد هر آهنگی که توی کانال بذاری، ربات اسم و خواننده‌ش رو مرتب می‌کنه، ' +
      'یه کپشن تمیز براش می‌نویسه و دکمه‌های ❤️ و 🥀 رو زیرش می‌ذاره.\n' +
      '4️⃣ از پنل آمار می‌بینی کی چی رو دوست داشته، کدوم آهنگا ترکوندن و کدوما نه 📊\n\n' +
      'هر جا گیر کردی، از دکمه‌ی پشتیبانی بهم پیام بده 🙌',
    reply_markup: { inline_keyboard: [[supportButton], [backButton]] },
  };
}

function pricesScreen() {
  const monthly = PLANS.find((p) => p.months === 1);
  const lines = PLANS.map((p) => {
    const saving = monthly && p.months > 1 ? Math.round((1 - p.stars / (monthly.stars * p.months)) * 100) : 0;
    return `⭐️ ${p.title}: ${fa(p.stars)} استارز${saving > 0 ? ` (${fa(saving)}٪ به‌صرفه‌تر 🔥)` : ''}`;
  });
  return {
    text:
      '💎 قیمت‌ها\n\n' + lines.join('\n') + '\n\n' +
      'پرداخت با استارز تلگرام، همین‌جا و بدون دردسر 👇\n' +
      'بعد از خرید، ربات رو ادمین کانالت کن تا فعالش کنیم.',
    reply_markup: { inline_keyboard: [
      ...PLANS.map((p, i) => [{
        text: `⭐️ خرید ${p.title} — ${fa(p.stars)} استارز`,
        callback_data: `buy:${p.id}`,
        style: i === PLANS.length - 1 ? 'success' : 'primary',
      }]),
      [backButton],
    ] },
  };
}

function withPanelButton(screen) {
  screen.reply_markup.inline_keyboard.unshift([{ text: '📊 باز کردن پنل', web_app: { url: MINI_APP_URL } }]);
  return screen;
}

// Home screen for a user: the owner and channel members also get the panel button.
async function homeFor(user) {
  const screen = homeScreen(user?.first_name);
  return user && (user.id === ADMIN_ID || (await isMember(user.id))) ? withPanelButton(screen) : screen;
}

export function sendWelcome(message, { withPanel = false } = {}) {
  const screen = homeScreen(message.from?.first_name);
  return api.sendMessage({ chat_id: message.chat.id, ...(withPanel ? withPanelButton(screen) : screen) });
}

// Stops the button's spinner. Fails when the query is too old (e.g. a menu
// pressed long after it was sent) — the screen still changes then.
async function answer(query, text) {
  try {
    await api.answerCallbackQuery({ callback_query_id: query.id, text });
  } catch (e) {
    console.error(e);
  }
}

// Menu callbacks; true when `query` was one of them.
export async function handleMenuCallback(query) {
  const data = query.data ?? '';
  const message = query.message;

  const screen = data === 'menu:home' ? await homeFor(query.from)
    : data === 'menu:help' ? helpScreen()
      : data === 'menu:prices' ? pricesScreen()
        : null;
  if (screen) {
    await answer(query);
    if (message) {
      await api.editMessageText({ chat_id: message.chat.id, message_id: message.message_id, ...screen });
    }
    return true;
  }

  const buy = /^buy:(\w+)$/.exec(data);
  if (buy) {
    const plan = PLANS.find((p) => p.id === buy[1]);
    await answer(query, plan ? undefined : 'این پلن دیگه موجود نیست');
    if (plan) await sendPlanInvoice(query.from.id, plan);
    return true;
  }
  return false;
}

// ---------- Stars payments ----------

function sendPlanInvoice(chatId, plan) {
  return api.sendInvoice({
    chat_id: chatId,
    title: plan.title,
    description: `ربات لایک و آمار کانال موزیک، ${fa(plan.months)} ماه (${fa(plan.months * 30)} روز) ⭐️`,
    payload: `plan:${plan.id}`,
    provider_token: '',            // Telegram Stars
    currency: 'XTR',
    prices: [{ label: plan.title, amount: plan.stars }],
  });
}

// The plan an invoice payload + amount stand for, or null if they don't match.
export function planFor(payload, currency, amount) {
  const id = /^plan:(\w+)$/.exec(payload ?? '')?.[1];
  const plan = PLANS.find((p) => p.id === id);
  return plan && currency === 'XTR' && amount === plan.stars ? plan : null;
}

// Last day of the user's subscription (unix seconds), or null.
async function paidUntil(userId) {
  const row = await db.get(sql`SELECT max(period_end) AS until FROM payments WHERE user_id = ${userId}`);
  return row?.until ? Number(row.until) : null;
}

// message.successful_payment → record it, extend the user's period, thank them, tell the owner.
export async function recordPayment(message) {
  const p = message.successful_payment;
  const user = message.from;
  const plan = planFor(p.invoice_payload, p.currency, p.total_amount);
  const now = Math.floor(Date.now() / 1000);
  const start = Math.max(now, (await paidUntil(user.id)) ?? 0);
  const end = start + (plan?.months ?? 1) * 30 * DAY;

  await db.run(sql`
    INSERT INTO payments (charge_id, user_id, user_name, plan, months, stars, period_start, period_end)
    VALUES (${p.telegram_payment_charge_id}, ${user.id}, ${user.username ?? null},
            ${plan?.id ?? p.invoice_payload}, ${plan?.months ?? 1}, ${p.total_amount}, ${start}, ${end})
    ON CONFLICT (charge_id) DO NOTHING`);

  await api.sendMessage({
    chat_id: message.chat.id,
    text:
      `🎉 پرداختت انجام شد، مرسی!\n\n` +
      `${plan?.title ?? 'اشتراک'} برات ثبت شد و تا ${stamp(new Date(end * 1000)).slice(0, 10)} اعتبار داره ⭐️\n\n` +
      'قدم بعدی: ربات رو ادمین کانالت کن (ارسال، ویرایش و حذف پیام) تا فعالش کنیم.\n' +
      `اگه سوالی بود، به ${CONTACT_USERNAME} پیام بده 💬`,
    reply_markup: { inline_keyboard: [[supportButton]] },
  });

  const who = user.username ? `@${user.username}` : `${user.first_name ?? ''} (${user.id})`;
  await notify(ADMIN_ID,
    `💰 خرید جدید: ${who}\n${plan?.title ?? p.invoice_payload} — ${fa(p.total_amount)} استارز\n` +
    `اعتبار تا ${stamp(new Date(end * 1000)).slice(0, 10)}\nشناسه پرداخت: ${p.telegram_payment_charge_id}`);
}

// /paysupport — payment questions go to the contact (Telegram asks bots that take payments to answer it).
export function sendPaySupport(message) {
  return api.sendMessage({
    chat_id: message.chat.id,
    text: `برای هر سوال یا مشکل درباره‌ی پرداخت، به ${CONTACT_USERNAME} پیام بده تا رسیدگی کنیم 🙏`,
    reply_markup: { inline_keyboard: [[supportButton]] },
  });
}
