// handlers/callback_query.js — a ❤️ / 🥀 button under a channel post was pressed.

import { api } from 'sdk';
import { upsertLikes, refreshButtons } from '../lib/likes.js';

export default async function (query, ctx) {
  const post = query.message;
  if (!post) return; // button on an inline-mode message: no channel post behind it

  const audio = post.audio ?? {};
  await upsertLikes([{
    user_id: query.from.id,
    liked: !(query.data ?? '').includes('disliked'),
    music_id: post.message_id,
    user_name: query.from.username || query.from.first_name,
    channel_id: String(post.chat.id),
    music_name: [audio.title, audio.performer].filter(Boolean).join(' - '),
  }]);

  await api.answerCallbackQuery({ callback_query_id: query.id, text: 'نظرت ثبت شد 🛌', show_alert: true });
  await refreshButtons(post.chat.id, post.message_id);
}
