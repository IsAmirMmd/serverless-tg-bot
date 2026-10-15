// Rule-based title/performer cleanup, used instead of the LLM when USE_LLM is
// false. Removes only noise — links, @usernames, site names, tags like
// "(Official Audio)" or "128kbps" — and keeps the rest as is.

const SITE = /\b[\w-]+\.(?:com|net|org|ir|in|me|info|co|xyz|fm|io|app|top|site|online|club|music)\b/gi;
const TAG_WORDS = /official|download|lyrics?|\bhd\b|kbps|\b\d{3,4}p\b/i;

function cleanTag(value) {
  return String(value ?? '')
    .replace(/https?:\/\/\S+/gi, '')
    .replace(/\bwww\.\S+/gi, '')
    .replace(/(^|[^\w.])@\w+/g, '$1')
    .replace(SITE, '')
    .replace(/\b\d{2,3}\s?kbps\b/gi, '')
    // bracketed parts that are now empty, or only a tag like (Official Audio)
    .replace(/[[(]([^[\]()]*)[\])]/g, (part, inner) => (!inner.trim() || TAG_WORDS.test(inner) ? '' : part))
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s\-–—|_:•·]+|[\s\-–—|_:•·]+$/g, '');
}

const EMOJIS = ['🌙', '🔥', '💫', '🌊', '🌹', '🖤', '✨', '🌧', '🌅', '💔', '🎧', '🕊', '🌌', '🍂', '⚡️', '🌿', '🪐', '🫧'];

// The same song always gets the same emoji.
function pickEmoji(seed) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.codePointAt(0)) >>> 0;
  return EMOJIS[hash % EMOJIS.length];
}

// An Audio's { title, performer, emoji } for the caption.
export function basicMetadata(audio) {
  const fileName = String(audio.file_name ?? '').replace(/\.[^.]+$/, '');
  // When cleaning leaves nothing, fall back to the file name, then the raw tag.
  const title = cleanTag(audio.title) || cleanTag(fileName) || String(audio.title ?? '').trim() || 'Unknown';
  const performer = cleanTag(audio.performer) || String(audio.performer ?? '').trim() || 'Unknown';
  return { title, performer, emoji: pickEmoji(`${title}|${performer}`) };
}
