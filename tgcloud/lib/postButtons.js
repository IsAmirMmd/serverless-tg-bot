// Deep links from a channel post into the bot, and the button row that carries
// them (under the ❤️ / 🥀 row, when the channel has growth_buttons on):
//   ?start=m<cid>          the songs this listener liked in that channel
// (?start=s<cid>_<post>, a song page, came from the "send to a friend" button
// that was removed; links already shared still open — lib/listener.js.)
// <cid> is the channel id without its -100 prefix (start payloads allow only
// letters, digits, _ and -).

import { getChannel, getBotUsername } from './channels.js';

export const shortId = (chatId) => String(chatId).replace(/^-100/, '');
export const chatIdOf = (short) => `-100${short}`;

// The "liked songs" button: under posts, and inside the bot.
export const MINE_TEXT = '🎧 آهنگ‌هایی که لایک کردم';

export const growthOn = (channel) => Boolean(channel) && channel.growth_buttons !== 0 && channel.growth_buttons !== false;

export async function mineUrl(chatId) {
  return `https://t.me/${await getBotUsername()}?start=m${shortId(chatId)}`;
}

export function shareUrl(url, text = '') {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
}

// The second row under a post, or null when the channel turned it off.
export async function growthRow(chatId) {
  const channel = await getChannel(chatId);
  if (!growthOn(channel)) return null;
  return [{ text: MINE_TEXT, url: await mineUrl(chatId) }];
}
