// handlers/channel_post.js — a new post in a channel the bot administers.
// An audio post is reposted with a cleaned-up caption and like/dislike
// buttons, and the original is deleted.

import { api } from 'sdk';
import { ADMIN_ID, SIGNATURE, USE_LLM } from '../lib/config.js';
import { cleanMetadata } from '../lib/llm.js';
import { basicMetadata } from '../lib/metadata.js';
import { buildCaption } from '../lib/caption.js';
import { likeKeyboard } from '../lib/likes.js';
import { getChannel, saveChannel, isLive } from '../lib/channels.js';

export default async function (post, ctx) {
  // Only active channels with a running subscription are served. A channel the
  // bot was in before my_chat_member was handled shows up here first: record it as pending.
  const channel = (await getChannel(post.chat.id)) ?? (await saveChannel(post.chat));
  if (!isLive(channel)) return;

  const audio = post.audio;
  if (!audio?.mime_type?.startsWith('audio/')) {
    // The notice is meant for the owner's own channels, not customers' text posts.
    if (channel.added_by && channel.added_by !== ADMIN_ID) return;
    await api.sendMessage({
      chat_id: ADMIN_ID,
      text: `Please send me an audio or music file, and I'll find the lyrics for you! 🎵\n\n${SIGNATURE}`,
    });
    return;
  }

  let meta = basicMetadata(audio);
  if (USE_LLM) {
    try {
      meta = await cleanMetadata(audio);
    } catch (e) {
      // Tell the admin, and still remove the original post.
      console.error(e);
      await api.sendMessage({ chat_id: ADMIN_ID, text: `Error on LLM\n\n${e.message}` });
      await api.deleteMessage({ chat_id: post.chat.id, message_id: post.message_id });
      return;
    }
  }

  await api.sendAudio({
    chat_id: post.chat.id,
    audio: audio.file_id,
    caption: buildCaption(meta, audio.duration),
    parse_mode: 'MarkdownV2',
    reply_markup: likeKeyboard(),
  });
  await api.deleteMessage({ chat_id: post.chat.id, message_id: post.message_id });
}
