import { fetch } from 'sdk';
import { LLM_MODEL } from './config.js';
import { getSetting } from './settings.js';

export const API_KEY_SETTING = 'openrouter_api_key';

const SYSTEM = 'Output only a JSON object, no other text: {"title":"...","performer":"...","emoji":"..."}';

// The prompt of the n8n "Basic LLM Chain" node.
const prompt = (audio) => `Clean music metadata.

Input:
Title: \`${audio.title ?? ''}\`
Performer: \`${audio.performer ?? ''}\`

Rules:
- Remove only unrelated noise: URLs, websites, @usernames/@channels, Telegram/channel names, promo text, unrelated tags/descriptions (e.g. Official, Download, Lyrics, HD, 128kbps, or movie/series names when descriptive only).
- Do not add, rewrite, translate, improve, or alter the actual title/performer. If correct, keep unchanged.
- Add exactly 1 creative emoji matching the title's vibe/meaning. Avoid 🎵🎶🎼🔊.

Return ONLY valid JSON:
{"title":"...","performer":"...","emoji":"..."}`;

async function complete(messages) {
  const key = await getSetting(API_KEY_SETTING);
  if (!key) throw new Error('OpenRouter API key is not set. Send "/setkey <key>" to the bot.');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: LLM_MODEL, messages }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${data?.error?.message ?? res.statusText}`);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('OpenRouter returned no content');
  return content;
}

// Pulls {title, performer, emoji} out of the model's answer, or null.
function parseMeta(answer) {
  const json = answer.match(/\{[\s\S]*\}/);
  if (!json) return null;
  try {
    const o = JSON.parse(json[0]);
    if (typeof o?.title !== 'string') return null;
    return { title: o.title, performer: String(o.performer ?? ''), emoji: String(o.emoji ?? '') };
  } catch {
    return null;
  }
}

// Cleans an Audio's title/performer and picks an emoji. Throws on failure.
export async function cleanMetadata(audio) {
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: prompt(audio) },
  ];
  const answer = await complete(messages);
  const meta = parseMeta(answer);
  if (meta) return meta;

  // Like n8n's auto-fixing output parser: ask the model once to repair its answer.
  const fixed = parseMeta(await complete([
    ...messages,
    { role: 'assistant', content: answer },
    { role: 'user', content: 'That was not valid JSON. Reply with only the JSON object.' },
  ]));
  if (!fixed) throw new Error(`LLM output is not valid JSON: ${answer.slice(0, 200)}`);
  return fixed;
}
