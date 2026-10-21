import { localTime, pad } from './time.js';
import { SOURCE_BOTS } from './config.js';

// MarkdownV2 escaping: everywhere, and inside `code` spans.
const escapeText = (s) => String(s ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
const escapeCode = (s) => String(s ?? '').replace(/[`\\]/g, '\\$&');
// …and inside the (url) part of a [text](url) link.
const escapeUrl = (s) => String(s ?? '').replace(/[)\\]/g, '\\$&');

function timeOfDayIcon(hour) {
  if (hour >= 6 && hour < 12) return '🌅';   // morning
  if (hour >= 12 && hour < 18) return '☀️';  // day
  if (hour >= 18 && hour < 21) return '🌇';  // evening
  if (hour >= 21) return '🌕';               // night
  return '🌑';                               // midnight (00:00–05:59)
}

// Every link in a message: text links and bare URLs in its caption or text,
// and url buttons.
function linksOf(post) {
  const text = post.caption ?? post.text ?? '';
  const links = [];
  for (const e of post.caption_entities ?? post.entities ?? []) {
    if (e.type === 'text_link') links.push(e.url);
    // Offsets count UTF-16 units, like JS string indexes.
    else if (e.type === 'url') links.push(text.slice(e.offset, e.offset + e.length));
  }
  for (const row of post.reply_markup?.inline_keyboard ?? []) {
    for (const button of row) if (button.url) links.push(button.url);
  }
  return links;
}

// The first link on one of `hosts` (or their subdomains), with a scheme.
function linkOn(links, hosts) {
  for (const link of links) {
    const host = /^(?:https?:\/\/)?([^/?#:\s]+)/i.exec(link)?.[1]?.toLowerCase();
    if (host && hosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return /^https?:\/\//i.test(link) ? link : `https://${link}`;
    }
  }
  return null;
}

// The bot in SOURCE_BOTS a channel post came from — forwarded from its chat, or
// sent through its inline mode (via_bot) — as { name, username, label, link }
// (link: the original song, or null); null when it came from anywhere else.
export function sourceBot(post) {
  const origin = post.forward_origin;
  const forwardedFrom = origin ? (origin.type === 'user' ? origin.sender_user : null) : post.forward_from;
  for (const user of [forwardedFrom, post.via_bot]) {
    const bot = user && SOURCE_BOTS.find((b) => b.id === user.id);
    if (!bot) continue;
    const username = user.username || bot.username;
    return {
      name: user.first_name || username,
      username,
      label: bot.linkLabel,
      link: bot.linkLabel ? linkOn(linksOf(post), bot.linkHosts ?? []) : null,
    };
  }
  return null;
}

// "[Bot name](t.me/bot) • [Sound Cloud](song)" in MarkdownV2.
function sourceLine(source) {
  const bot = `[${escapeText(source.name)}](https://t.me/${escapeUrl(source.username)})`;
  return source.link ? `${bot} • [${escapeText(source.label)}](${escapeUrl(source.link)})` : bot;
}

// Caption of a reposted track (parse_mode MarkdownV2):
//   🌊 [`Title`]
//   🎤 [`Performer`]
//   🕯 [03:45] | 🌇  19:30
//   Bot name • Sound Cloud            ← only for a track from one of SOURCE_BOTS (both linked)
export function buildCaption({ title, performer, emoji }, duration = 0, { now = new Date(), source = null } = {}) {
  const { hour, minute } = localTime(now);
  const seconds = duration || 0;
  return `${escapeText(emoji)} \\[\`${escapeCode(title)}\`\\]\n` +
    `🎤 \\[\`${escapeCode(performer)}\`\\]\n` +
    `🕯 \\[${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}\\] \\| ${timeOfDayIcon(hour)}  ${pad(hour)}:${pad(minute)}` +
    (source ? `\n${sourceLine(source)}` : '');
}
