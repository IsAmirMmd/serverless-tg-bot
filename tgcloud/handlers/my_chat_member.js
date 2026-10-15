// handlers/my_chat_member.js — the bot's own membership changed in a chat.
// Made an admin of a channel → the channel is recorded as `pending` and the
// owner is asked to activate it — unless whoever added the bot has paid (their
// credit is applied and the channel activated); removed → the channel is paused.

import { ADMIN_ID, AUTO_ACTIVATE_PAID } from '../lib/config.js';
import { getChannel, saveChannel, setStatus, isLive, notify, panelKeyboard } from '../lib/channels.js';
import { applyCredits, faDay } from '../lib/billing.js';

const IN_CHANNEL = ['administrator', 'creator'];

export default async function (update, ctx) {
  const { chat, from, new_chat_member: member } = update;
  if (chat.type !== 'channel') return;

  if (!IN_CHANNEL.includes(member?.status)) {
    const known = await getChannel(chat.id);
    if (known && known.status !== 'paused') {
      await saveChannel(chat, { status: 'paused' });
      await notify(ADMIN_ID, `⏸ ربات از ادمین‌های کانال «${chat.title}» حذف شد؛ کانال متوقف شد.`);
    }
    return;
  }

  const before = await getChannel(chat.id);
  // A re-added channel waits for the owner again, unless the owner added it.
  const status = from?.id === ADMIN_ID ? 'active' : before?.status === 'active' ? 'active' : 'pending';
  let channel = await saveChannel(chat, { addedBy: from?.id ?? null, status });

  // Paid before adding the bot: the credit goes to this channel and activates it.
  const applied = await applyCredits(channel);
  channel = await getChannel(chat.id);
  // Re-added with paid time left: back on without asking.
  if (!isLive(channel) && AUTO_ACTIVATE_PAID && channel.expires_at > Math.floor(Date.now() / 1000)) {
    channel = await setStatus(chat.id, 'active');
  }

  const who = from?.username ? `@${from.username}` : `${from?.first_name ?? ''} (${from?.id})`;
  if (isLive(channel)) {
    if (applied && from?.id) {
      await notify(from.id,
        `✅ کانال «${chat.title}» فعال شد و اشتراکت تا ${faDay(channel.expires_at)} روش ثبت شد 🎉\n` +
        'از این به بعد آهنگای کانال دکمه‌ی ❤️ و 🥀 می‌گیرن و آمارش رو توی پنل می‌بینی.',
        { reply_markup: panelKeyboard() });
      await notify(ADMIN_ID, `✅ کانال «${chat.title}» با اشتراک پرداخت‌شده‌ی ${who} خودکار فعال شد (تا ${faDay(channel.expires_at)}).`);
    }
    return;
  }

  await notify(ADMIN_ID,
    `📢 ربات به کانال «${chat.title}»${chat.username ? ` (@${chat.username})` : ''} اضافه شد.\n` +
    `اضافه‌کننده: ${who}\n\nتا فعال نشود، پست‌های این کانال پردازش نمی‌شوند.`,
    { reply_markup: { inline_keyboard: [[
      { text: '✅ فعال‌سازی', callback_data: `ch:active:${chat.id}` },
      { text: '⛔️ رد', callback_data: `ch:paused:${chat.id}` },
    ]] } });
}
