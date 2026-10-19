// Deep links from a channel post into the bot, and the button row that carries
// them (under the ❤️ / 🥀 row, when the channel has growth_buttons on):
//   ?start=m<cid>          "my songs" in that channel
//   ?start=s<cid>_<post>   a song page, for sharing one post with a friend
// <cid> is the channel id without its -100 prefix (start payloads allow only
// letters, digits, _ and -).

import { getChannel, getBotUsername } from './channels.js';

export const shortId = (chatId) => String(chatId).replace(/^-100/, '');
export const chatIdOf = (short) => `-100${short}`;

export const growthOn = (channel) => Boolean(channel) && channel.growth_buttons !== 0 && channel.growth_buttons !== false;

export async function mineUrl(chatId) {
  return `https://t.me/${await getBotUsername()}?start=m${shortId(chatId)}`;
}

export async function songUrl(chatId, musicId) {
  return `https://t.me/${await getBotUsername()}?start=s${shortId(chatId)}_${musicId}`;
}

export function shareUrl(url, text = '') {
  return `https://t.me/share/url?url=${encodeURIComponent(url)}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
}

// The second row under a post, or null when the channel turned it off.
export async function growthRow(chatId, musicId) {
  const channel = await getChannel(chatId);
  if (!growthOn(channel)) return null;
  return [
    { text: '🎧 آهنگ‌های من', url: await mineUrl(chatId) },
    { text: '📤 بفرست برای دوستت', url: shareUrl(await songUrl(chatId, musicId), '🎧 اینو گوش بده:') },
  ];
}
