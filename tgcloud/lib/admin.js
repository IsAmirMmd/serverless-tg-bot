import { api, db, InputFile } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID, SIGNATURE, MAX_FAKE_LIKES } from './config.js';
import { enablePanelButton, panelKeyboard } from './channels.js';
import { allLikes, countAllLikes, findMusic, upsertLikes, refreshButtons } from './likes.js';
import { buildUserReport, buildMusicReport } from './report.js';
import { toXlsx, toCsv, parseCsv, utf8Encode, utf8Decode } from './files.js';
import { setSetting } from './settings.js';
import { API_KEY_SETTING } from './llm.js';
import { stamp } from './time.js';

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const tell = (text) => api.sendMessage({ chat_id: ADMIN_ID, text });

function sendFile(bytes, fileName, type, caption) {
  return api.sendDocument({ chat_id: ADMIN_ID, document: new InputFile(bytes, fileName, { type }), caption });
}

// /report — the two Excel reports.
export async function sendReports() {
  const likes = await allLikes();
  if (!likes.length) return tell('No likes yet.');
  const now = new Date();

  await sendFile(
    toXlsx(buildUserReport(likes), 'User Likes Report'),
    `Likes_Report_${stamp(now, true)}.xlsx`, XLSX,
    `📊 User Likes/Dislikes Report\n\nGenerated: ${stamp(now)}\n\n${SIGNATURE}`,
  );

  const musicReport = buildMusicReport(likes);
  if (!musicReport.length) return;
  await sendFile(
    toXlsx(musicReport, 'Music Likes Report'),
    `Music_Likes_Report_${stamp(now, true)}.xlsx`, XLSX,
    `🎵 Likes by Music Report\n\nGenerated: ${stamp(now)}\n\n${SIGNATURE}`,
  );
}

// /panel — opens the panel Mini App, for the owner or a channel member. The
// menu button is set for that user's chat only, so other users never see it.
export async function sendPanel(chatId = ADMIN_ID) {
  await enablePanelButton(chatId);
  await api.sendMessage({ chat_id: chatId, text: '📊 پنل لایک‌ها و گزارش‌ها', reply_markup: panelKeyboard() });
}

// /backup — the whole likes table as CSV (run every 8 hours by GitHub Actions).
export async function sendBackup() {
  const likes = await allLikes();
  if (!likes.length) return;
  const now = new Date();
  await sendFile(
    utf8Encode(toCsv(likes)),
    `Likes_Backup_${stamp(now, true)}.csv`, 'text/csv',
    `🗄️ Likes table backup\n\nGenerated: ${stamp(now)}`,
  );
}

// "liked <music_id> <count> [channel_id]" / "disliked …" → { liked, musicId, count, channelId }, or null.
// The channel is needed only when two channels have a post with that id.
export function parseFakeCommand(text) {
  const m = /^(liked|disliked)\s+(\d+)\s+(\d+)(?:\s+(-?\d+))?$/i.exec(text);
  if (!m) return null;
  return { liked: m[1].toLowerCase() === 'liked', musicId: Number(m[2]), count: Number(m[3]), channelId: m[4] ?? null };
}

// The channel id as stored, normalized to a -100… chat id.
function channelChatId(channelId) {
  const id = String(channelId ?? '');
  return id.startsWith('-100') ? id : `-100${id}`;
}

// Adds `count` votes from made-up users to a channel post and redraws its buttons.
export async function addFakeLikes({ liked, musicId, count, channelId }) {
  if (count > MAX_FAKE_LIKES) return tell(`At most ${MAX_FAKE_LIKES} at a time.`);
  const found = await findMusic(musicId);
  const candidates = channelId ? found.filter((m) => m.channel_id === channelChatId(channelId)) : found;
  if (!candidates.length) {
    return tell(`The channel of music ${musicId} is unknown. Vote on the post once, then try again.`);
  }
  if (candidates.length > 1) {
    return tell(`Music ${musicId} exists in several channels: ${candidates.map((m) => m.channel_id).join(', ')}.\n` +
      `Add the channel: ${liked ? 'liked' : 'disliked'} ${musicId} ${count} <channel_id>`);
  }
  const music = candidates[0];

  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      user_id: -(Math.floor(Math.random() * 900000000) + 100000000),
      liked,
      music_id: musicId,
      user_name: `testuser${Math.floor(Math.random() * 900000) + 100000}`,
      channel_id: String(music.channel_id),
      music_name: music.music_name ?? '',
    });
  }
  await upsertLikes(rows);
  await refreshButtons(channelChatId(music.channel_id), musicId);
  await tell('Done ✅');
}

const toInt = (v) => (/^-?\d+$/.test(String(v).trim()) ? Number(v) : null);
// Backups written by n8n carry channel ids like "-1.0018E+12" (precision lost),
// "0" or "" — keep only whole ids. The next vote on a post records its real id.
const toChannelId = (v) => (/^-?\d+$/.test(String(v).trim()) && Number(v) !== 0 ? String(v).trim() : null);
const toBool = (v) => (/^(true|1)$/i.test(String(v).trim()) ? true : /^(false|0)$/i.test(String(v).trim()) ? false : null);

// A CSV document with caption /import — e.g. a "Likes_Backup" file the n8n
// workflow sent — loaded into the likes table. Votes already in the table win
// over the file, so votes cast since the backup are kept.
// Rows without a channel id get `channelId` (from "/import <channel_id>"), or
// the only active channel when there is just one.
export async function importLikes(document, channelId = null) {
  if (!document) {
    return tell('Send the CSV backup as a file with the caption /import, or reply /import to a forwarded backup file.');
  }
  let fallbackChannel = channelId ? channelChatId(channelId) : null;
  if (!fallbackChannel) {
    const active = await db.all(sql`SELECT chat_id FROM channels WHERE status = 'active'`);
    if (active.length === 1) fallbackChannel = active[0].chat_id;
  }
  const csv = parseCsv(utf8Decode(await api.getFileContent(document.file_id)));
  if (!csv.length) return tell(`No rows found in ${document.file_name ?? 'the file'}. Is it the CSV backup?`);
  const rows = [];
  for (const r of csv) {
    const row = {
      user_id: toInt(r.user_id),
      liked: toBool(r.liked),
      music_id: toInt(r.music_id),
      user_name: r.user_name || null,
      channel_id: toChannelId(r.channel_id) ?? fallbackChannel,
      music_name: r.music_name || null,
    };
    if (row.user_id != null && row.music_id != null && row.liked != null) rows.push(row);
  }
  if (rows.some((r) => !r.channel_id)) {
    return tell('Some rows have no channel id and there is more than one active channel.\n' +
      'Send it again with the channel: /import <channel_id>');
  }
  const before = await countAllLikes();
  await upsertLikes(rows, { keepExisting: true });
  const after = await countAllLikes();
  await tell(`Imported ${after - before} new rows from ${csv.length} ✅` +
    (csv.length > rows.length ? ` (${csv.length - rows.length} invalid)` : ''));
}

// /setkey <OpenRouter API key> — stored in the database, then the message is deleted.
export async function setApiKey(message, key) {
  if (!key) return tell('Usage: /setkey <OpenRouter API key>');
  await setSetting(API_KEY_SETTING, key);
  try {
    await api.deleteMessage({ chat_id: message.chat.id, message_id: message.message_id });
  } catch {
    // Nothing to delete when run from the CLI.
  }
  await tell('API key saved ✅');
}
