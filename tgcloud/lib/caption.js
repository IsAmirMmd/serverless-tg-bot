import { localTime, pad } from './time.js';
import { SOURCE_BOTS } from './config.js';

// MarkdownV2 escaping: everywhere, and inside `code` spans.
const escapeText = (s) => String(s ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
const escapeCode = (s) => String(s ?? '').replace(/[`\\]/g, '\\$&');

function timeOfDayIcon(hour) {
  if (hour >= 6 && hour < 12) return '🌅';   // morning
  if (hour >= 12 && hour < 18) return '☀️';  // day
  if (hour >= 18 && hour < 21) return '🌇';  // evening
  if (hour >= 21) return '🌕';               // night
  return '🌑';                               // midnight (00:00–05:59)
}

// The bot in SOURCE_BOTS a channel post came from — forwarded from its chat, or
// sent through its inline mode (via_bot) — as { id, username }; null otherwise.
export function sourceBot(post) {
  const origin = post.forward_origin;
  const forwardedFrom = origin ? (origin.type === 'user' ? origin.sender_user : null) : post.forward_from;
  for (const user of [forwardedFrom, post.via_bot]) {
    const bot = user && SOURCE_BOTS.find((b) => b.id === user.id);
    if (bot) return { id: bot.id, username: user.username || bot.username };
  }
  return null;
}

// Caption of a reposted track (parse_mode MarkdownV2):
//   🌊 [`Title`]
//   🎤 [`Performer`]
//   🕯 [03:45] | 🌇  19:30
//   📥 فوروارد از @SourceBot        ← only for a track from one of SOURCE_BOTS
export function buildCaption({ title, performer, emoji }, duration = 0, { now = new Date(), source = null } = {}) {
  const { hour, minute } = localTime(now);
  const seconds = duration || 0;
  return `${escapeText(emoji)} \\[\`${escapeCode(title)}\`\\]\n` +
    `🎤 \\[\`${escapeCode(performer)}\`\\]\n` +
    `🕯 \\[${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}\\] \\| ${timeOfDayIcon(hour)}  ${pad(hour)}:${pad(minute)}` +
    (source ? `\n📥 فوروارد از @${escapeText(source.username)}` : '');
}
