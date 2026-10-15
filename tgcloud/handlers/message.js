// handlers/message.js — runs on each `message` update (private chats, groups).
// Admin commands; anything else gets the same notice the n8n workflow sent.

import { api } from 'sdk';
import { ADMIN_ID, SIGNATURE } from '../lib/config.js';
import {
  sendReports, sendBackup, parseFakeCommand, addFakeLikes, importLikes, setApiKey,
} from '../lib/admin.js';

export default async function (message, ctx) {
  const text = (message.text ?? message.caption ?? '').trim();

  if (message.from?.id === ADMIN_ID) {
    if (text === '/report') return sendReports();
    if (text === '/backup') return sendBackup();
    if (text === '/import' && message.document) return importLikes(message.document);
    if (/^\/setkey(\s|$)/.test(text)) return setApiKey(message, text.slice('/setkey'.length).trim());
    const fake = parseFakeCommand(text);
    if (fake) return addFakeLikes(fake);
  }

  await api.sendMessage({
    chat_id: ADMIN_ID,
    text: `Please send me an audio or music file, and I'll find the lyrics for you! 🎵\n\n${SIGNATURE}`,
  });
}
