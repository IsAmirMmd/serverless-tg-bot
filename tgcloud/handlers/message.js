// handlers/message.js — runs on each `message` update (private chats, groups).
// Payments, /start (menu, invite links, listener links from channel posts),
// /panel for channel members, /stop, song requests and the owner's admin
// commands; anything else is ignored.

import { api } from 'sdk';
import { ADMIN_ID } from '../lib/config.js';
import { sendWelcome, sendPaySupport } from '../lib/menu.js';
import { recordPayment, billingCheck, redeemGift, faDay } from '../lib/billing.js';

const faNum = (n) => Number(n).toLocaleString('fa-IR');
import { trackStart } from '../lib/botUsers.js';
import {
  sendReports, sendBackup, parseFakeCommand, addFakeLikes, importLikes, setApiKey, sendPanel, setCommands,
} from '../lib/admin.js';
import { redeemInvite, isMember, notify, panelKeyboard } from '../lib/channels.js';
import { handleListenerStart, takeSongRequest } from '../lib/listener.js';
import { unsubscribe } from '../lib/broadcast.js';
import { weeklyReports } from '../lib/weekly.js';

// The admin command in `text`, started; or null when it is not one.
function adminCommand(message, text) {
  if (text === '/report') return sendReports();
  if (text === '/backup') return sendBackup();
  if (text === '/panel') return sendPanel();
  if (text === '/setcommands') return setCommands();
  // Renewal reminders and expiry notices — run daily by .github/workflows/billing.yml.
  if (text === '/billing') return billingCheck();
  // Weekly report to every channel's managers — run by .github/workflows/weekly.yml.
  if (text === '/weekly') return weeklyReports();
  // The file itself, or a forwarded file this message replies to; optional channel id.
  const imp = /^\/import(?:\s+(-?\d+))?$/.exec(text);
  if (imp) return importLikes(message.document ?? message.reply_to_message?.document, imp[1] ?? null);
  if (/^\/setkey(\s|$)/.test(text)) return setApiKey(message, text.slice('/setkey'.length).trim());
  const fake = parseFakeCommand(text);
  if (fake) return addFakeLikes(fake);
  return null;
}

// /start gift_<code> from a gift link the owner made in the panel.
async function acceptGift(message, code) {
  const r = await redeemGift(code, message.from);
  if (!r.ok) {
    await api.sendMessage({ chat_id: message.chat.id, text: `⛔️ ${r.reason}` });
    return;
  }
  const text = r.channel
    ? `🎁 هدیه داری! ${faNum(r.days)} روز اشتراک رایگان روی کانال «${r.channel.title ?? r.channel.chat_id}» ثبت شد ` +
      `و تا ${faDay(r.end)} اعتبار داره ⭐️`
    : `🎁 هدیه داری! ${faNum(r.days)} روز اشتراک رایگان برات ذخیره شد ⭐️\n\n` +
      'قدم بعدی: ربات رو ادمین کانالت کن (ارسال، ویرایش و حذف پیام). ' +
      'به‌محض اینکه اضافه‌ش کنی، هدیه‌ت روی همون کانال فعال میشه.';
  await api.sendMessage({
    chat_id: message.chat.id,
    text,
    reply_markup: r.channel && r.channel.status === 'active' ? panelKeyboard() : undefined,
  });
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
  if (/^\/start(\s|$)/.test(text) && message.chat.type === 'private') await trackStart(message);
  if (text === '/paysupport') return sendPaySupport(message);

  const invite = /^\/start\s+inv_([A-Za-z0-9]+)$/.exec(text);
  if (invite && message.chat.type === 'private') return acceptInvite(message, invite[1]);
  const gift = /^\/start\s+gift_([A-Za-z0-9]+)$/.exec(text);
  if (gift && message.chat.type === 'private') return acceptGift(message, gift[1]);
  // From the buttons under channel posts: "my songs" and a shared song.
  const listener = /^\/start\s+(\S+)$/.exec(text);
  if (listener && message.chat.type === 'private' && (await handleListenerStart(message, listener[1]))) return;
  if (text === '/stop' && message.chat.type === 'private') return unsubscribe(message);

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

  // The answer to "request a song", if the bot is waiting for one.
  if (await takeSongRequest(message)) return;

  // Anything else (unknown commands, admin commands from other users, free
  // text) gets no reply, and the owner is not notified.
}
