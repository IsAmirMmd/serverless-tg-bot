import { SOURCE_BOTS } from './config.js';

// MarkdownV2 escaping: everywhere, and inside `code` spans.
const escapeText = (s) => String(s ?? '').replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
const escapeCode = (s) => String(s ?? '').replace(/[`\\]/g, '\\$&');
// …and inside the (url) part of a [text](url) link.
const escapeUrl = (s) => String(s ?? '').replace(/[)\\]/g, '\\$&');

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
// sent through its inline mode (via_bot) — as { emoji, name, username, label, link }
// (link: the original song, or null); null when it came from anywhere else.
export function sourceBot(post) {
  const origin = post.forward_origin;
  const forwardedFrom = origin ? (origin.type === 'user' ? origin.sender_user : null) : post.forward_from;
  for (const user of [forwardedFrom, post.via_bot]) {
    const bot = user && SOURCE_BOTS.find((b) => b.id === user.id);
    if (!bot) continue;
    const username = user.username || bot.username;
    return {
      emoji: bot.emoji || '🎧',
      name: bot.name || user.first_name || username,
      username,
      label: bot.linkLabel,
      link: bot.linkLabel ? linkOn(linksOf(post), bot.linkHosts ?? []) : null,
    };
  }
  return null;
}

// "🎧 [ساندگیر] • [Sound Cloud]" in MarkdownV2 — bracketed like the other caption
// lines; the names inside are links (to the bot, to the song). Not monospace:
// Telegram doesn't allow code inside a link. Starts with a left-to-right mark:
// a line's direction follows its first letter, and «ساندگیر» would otherwise
// turn just this line right-to-left, right-aligned under the others.
function sourceLine(source) {
  const linked = (text, url) => `\\[[${escapeText(text)}](${escapeUrl(url)})\\]`;
  const bot = linked(source.name, `https://t.me/${source.username}`);
  return `\u200E${escapeText(source.emoji)} ${bot}` + (source.link ? ` • ${linked(source.label, source.link)}` : '');
}

// Caption of a reposted track (parse_mode MarkdownV2):
//   🌊 [`Title`]
//   🎤 [`Performer`]
//   🎧 [ساندگیر] • [Sound Cloud]      ← only for a track from one of SOURCE_BOTS (both names linked)
export function buildCaption({ title, performer, emoji }, { source = null } = {}) {
  return `${escapeText(emoji)} \\[\`${escapeCode(title)}\`\\]\n` +
    `🎤 \\[\`${escapeCode(performer)}\`\\]` +
    (source ? `\n${sourceLine(source)}` : '');
}
