// handlers/callback_query.js — an inline button was pressed:
//   ch:<status>:<chat_id>  the owner activates / rejects a channel (my_chat_member notice)
//   menu:… / buy:…         the /start menu (lib/menu.js)
//   g:…                    a listener's buttons in the bot (lib/listener.js)
//   wk:…                   publish the weekly top songs (lib/weekly.js)
//   anything else          a ❤️ / 🥀 button under a channel post

import { api } from 'sdk';
import { ADMIN_ID } from '../lib/config.js';
import { upsertLikes, refreshButtons } from '../lib/likes.js';
import { isActive, setStatus, getChannel } from '../lib/channels.js';
import { applyCredits } from '../lib/billing.js';
import { handleMenuCallback } from '../lib/menu.js';
import { trackVote } from '../lib/botUsers.js';
import { handleListenerCallback } from '../lib/listener.js';
import { handleWeeklyCallback } from '../lib/weekly.js';

async function channelAction(query, status, chatId) {
  if (query.from.id !== ADMIN_ID) {
    return api.answerCallbackQuery({ callback_query_id: query.id, text: 'فقط مالک ربات', show_alert: true });
  }
  let channel = await setStatus(chatId, status);
  if (status === 'active' && (await applyCredits(channel))) channel = await getChannel(chatId);
  await api.answerCallbackQuery({ callback_query_id: query.id, text: status === 'active' ? 'فعال شد ✅' : 'رد شد' });
  if (query.message) {
    await api.editMessageText({
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      text: `${query.message.text}\n\n${status === 'active' ? '✅ فعال شد' : '⛔️ رد شد'} — «${channel?.title ?? chatId}»`,
    });
  }
}

export default async function (query, ctx) {
  const action = /^ch:(active|paused):(-?\d+)$/.exec(query.data ?? '');
  if (action) return channelAction(query, action[1], action[2]);
  if (await handleMenuCallback(query)) return;
  if (await handleListenerCallback(query)) return;
  if (await handleWeeklyCallback(query)) return;

  const post = query.message;
  if (!post) return; // button on an inline-mode message: no channel post behind it

  // Paused or never activated: votes are not counted.
  if (!(await isActive(post.chat.id))) {
    await api.answerCallbackQuery({ callback_query_id: query.id, text: 'این کانال فعلاً غیرفعال است.', show_alert: true });
    return;
  }

  const audio = post.audio ?? {};
  await upsertLikes([{
    user_id: query.from.id,
    liked: !(query.data ?? '').includes('disliked'),
    music_id: post.message_id,
    user_name: query.from.username || query.from.first_name,
    channel_id: String(post.chat.id),
    music_name: [audio.title, audio.performer].filter(Boolean).join(' - '),
  }]);

  await trackVote(query.from);

  // A short toast, not a popup the listener has to close after every vote.
  await api.answerCallbackQuery({ callback_query_id: query.id, text: 'نظرت ثبت شد 🛌' });
  await refreshButtons(post.chat.id, post.message_id);
}
