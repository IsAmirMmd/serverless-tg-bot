// handlers/my_chat_member.js — the bot's own membership changed in a chat.
// Made an admin of a channel → the channel is recorded as `pending` and the
// owner is asked to activate it; removed → the channel is paused.

import { ADMIN_ID } from '../lib/config.js';
import { getChannel, saveChannel, notify } from '../lib/channels.js';

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
  const channel = await saveChannel(chat, { addedBy: from?.id ?? null, status });
  if (channel.status === 'active') return;

  const who = from?.username ? `@${from.username}` : `${from?.first_name ?? ''} (${from?.id})`;
  await notify(ADMIN_ID,
    `📢 ربات به کانال «${chat.title}»${chat.username ? ` (@${chat.username})` : ''} اضافه شد.\n` +
    `اضافه‌کننده: ${who}\n\nتا فعال نشود، پست‌های این کانال پردازش نمی‌شوند.`,
    { reply_markup: { inline_keyboard: [[
      { text: '✅ فعال‌سازی', callback_data: `ch:active:${chat.id}` },
      { text: '⛔️ رد', callback_data: `ch:paused:${chat.id}` },
    ]] } });
}
