// handlers/message.js — runs on each `message` update (private chats, groups).
// Admin commands; anything else gets the same notice the n8n workflow sent.

import { api } from 'sdk';
import { ADMIN_ID, SIGNATURE } from '../lib/config.js';
import {
  sendReports, sendBackup, parseFakeCommand, addFakeLikes, importLikes, setApiKey, sendPanel,
} from '../lib/admin.js';

// The admin command in `text`, started; or null when it is not one.
function adminCommand(message, text) {
  if (text === '/report') return sendReports();
  if (text === '/backup') return sendBackup();
  if (text === '/panel') return sendPanel();
  // The file itself, or a forwarded file this message replies to.
  if (text === '/import') return importLikes(message.document ?? message.reply_to_message?.document);
  if (/^\/setkey(\s|$)/.test(text)) return setApiKey(message, text.slice('/setkey'.length).trim());
  const fake = parseFakeCommand(text);
  if (fake) return addFakeLikes(fake);
  return null;
}

export default async function (message, ctx) {
  const text = (message.text ?? message.caption ?? '').trim();

  if (message.from?.id === ADMIN_ID) {
    const command = adminCommand(message, text);
    if (command) {
      try {
        await command;
      } catch (e) {
        // Otherwise a failed command is silent: logs are only visible through `tgcloud run`.
        console.error(e);
        await api.sendMessage({ chat_id: ADMIN_ID, text: `⚠️ Command failed:\n${e.message}` });
      }
      return;
    }
  }

  await api.sendMessage({
    chat_id: ADMIN_ID,
    text: `Please send me an audio or music file, and I'll find the lyrics for you! 🎵\n\n${SIGNATURE}`,
  });
}
