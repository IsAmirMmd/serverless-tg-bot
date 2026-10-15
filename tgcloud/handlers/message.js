// handlers/message.js — runs on each `message` update (private chats, groups).
// Invite links (/start inv_<code>), /panel for channel members, the owner's
// admin commands; anything else gets the same notice the n8n workflow sent.

import { api } from 'sdk';
import { ADMIN_ID, SIGNATURE } from '../lib/config.js';
import { sendWelcome, recordPayment, sendPaySupport } from '../lib/menu.js';
import {
  sendReports, sendBackup, parseFakeCommand, addFakeLikes, importLikes, setApiKey, sendPanel,
} from '../lib/admin.js';
import { redeemInvite, isMember, notify, panelKeyboard } from '../lib/channels.js';

// The admin command in `text`, started; or null when it is not one.
function adminCommand(message, text) {
  if (text === '/report') return sendReports();
  if (text === '/backup') return sendBackup();
  if (text === '/panel') return sendPanel();
  // The file itself, or a forwarded file this message replies to; optional channel id.
  const imp = /^\/import(?:\s+(-?\d+))?$/.exec(text);
  if (imp) return importLikes(message.document ?? message.reply_to_message?.document, imp[1] ?? null);
  if (/^\/setkey(\s|$)/.test(text)) return setApiKey(message, text.slice('/setkey'.length).trim());
  const fake = parseFakeCommand(text);
  if (fake) return addFakeLikes(fake);
  return null;
}

// /start inv_<code> from an invite link the owner made in the panel.
async function acceptInvite(message, code) {
  const user = message.from;
  const result = await redeemInvite(code, user);
  if (!result.ok) {
    await api.sendMessage({ chat_id: message.chat.id, text: `⛔️ ${result.reason}` });
    return;
  }
  const title = result.channel.title ?? result.channel.chat_id;
  await api.sendMessage({
    chat_id: message.chat.id,
    text: `✅ دسترسی شما به آمار کانال «${title}» فعال شد.\nاز دکمه «پنل» یا دکمه زیر وارد شوید.`,
    reply_markup: panelKeyboard(),
  });
  const who = user.username ? `@${user.username}` : `${user.first_name ?? ''} (${user.id})`;
  await notify(ADMIN_ID, `👤 ${who} با لینک دعوت به کانال «${title}» اضافه شد.`);
}

export default async function (message, ctx) {
  const text = (message.text ?? message.caption ?? '').trim();
  const fromId = message.from?.id;

  if (message.successful_payment) return recordPayment(message);
  if (text === '/paysupport') return sendPaySupport(message);

  const invite = /^\/start\s+inv_([A-Za-z0-9]+)$/.exec(text);
  if (invite && message.chat.type === 'private') return acceptInvite(message, invite[1]);

  if (fromId === ADMIN_ID) {
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

  const hasPanel = Boolean(fromId) && (fromId === ADMIN_ID || (await isMember(fromId)));
  if (text === '/panel' && hasPanel) return sendPanel(fromId);

  // The menu for everyone; owner and members get the panel button on top.
  if (/^\/start(\s|$)/.test(text) && message.chat.type === 'private') {
    return sendWelcome(message, { withPanel: hasPanel });
  }

  await api.sendMessage({
    chat_id: ADMIN_ID,
    text: `Please send me an audio or music file, and I'll find the lyrics for you! 🎵\n\n${SIGNATURE}`,
  });
}
