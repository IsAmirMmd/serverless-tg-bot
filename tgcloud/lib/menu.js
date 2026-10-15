// The /start menu (support / help / prices) and buying a plan with Telegram Stars.
// Buttons use `style` (Bot API: 'primary' blue, 'success' green, 'danger' red).
// Callback data: menu:home | menu:help | menu:prices | buy:<plan id>[:<chat id>]
// Payments themselves are in billing.js.

import { api } from 'sdk';
import { ADMIN_ID, CONTACT_USERNAME, PLANS, MINI_APP_URL } from './config.js';
import { isMember, getChannel } from './channels.js';
import { sendPlanInvoice, userChannels } from './billing.js';

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

  // buy:<plan>             from the prices screen — asks for the channel when the buyer has several
  // buy:<plan>:<chat id>   a specific channel (channel picker, renewal reminders)
  const buy = /^buy:(\w+)(?::(-?\d+))?$/.exec(data);
  if (buy) {
    const plan = PLANS.find((p) => p.id === buy[1]);
    if (!plan) {
      await answer(query, 'این پلن دیگه موجود نیست');
      return true;
    }
    await answer(query);
    if (buy[2]) {
      await sendPlanInvoice(query.from.id, plan, await getChannel(buy[2]));
      return true;
    }
    const mine = await userChannels(query.from.id);
    if (mine.length <= 1) {
      // No channel yet: the payment waits as credit until they add the bot.
      await sendPlanInvoice(query.from.id, plan, mine[0] ?? null);
    } else if (message) {
      await api.editMessageText({
        chat_id: message.chat.id,
        message_id: message.message_id,
        text: `${plan.title} برای کدوم کانالت؟ 👇`,
        reply_markup: { inline_keyboard: [
          ...mine.map((c) => [{ text: `📢 ${c.title ?? c.chat_id}`, callback_data: `buy:${plan.id}:${c.chat_id}` }]),
          [{ text: '🔙 برگشت', callback_data: 'menu:prices' }],
        ] },
      });
    }
    return true;
  }
  return false;
}

// /paysupport — payment questions go to the contact (Telegram asks bots that take payments to answer it).
export function sendPaySupport(message) {
  return api.sendMessage({
    chat_id: message.chat.id,
    text: `برای هر سوال یا مشکل درباره‌ی پرداخت، به ${CONTACT_USERNAME} پیام بده تا رسیدگی کنیم 🙏`,
    reply_markup: { inline_keyboard: [[supportButton]] },
  });
}
