// handlers/message.js — runs on each `message` update (private chats, groups).
// The platform calls the default export with the Message; the full update is `ctx.update`.

import { api } from 'sdk';
import { ADMIN_ID } from '../lib/config.js';

// The admin command in `text`, started; or null when it is not one.
function adminCommand(message, text) {
  if (text === '/ping') return api.sendMessage({ chat_id: message.chat.id, text: 'pong' });
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

  if (text === '/start') {
    await api.sendMessage({ chat_id: message.chat.id, text: 'Hi! 👋' });
  }
}
