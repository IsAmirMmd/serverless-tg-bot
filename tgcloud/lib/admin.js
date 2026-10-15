import { api, InputFile } from 'sdk';
import { ADMIN_ID, SIGNATURE, MAX_FAKE_LIKES } from './config.js';
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

// "liked <music_id> <count>" / "disliked <music_id> <count>" → { liked, musicId, count }, or null.
export function parseFakeCommand(text) {
  const m = /^(liked|disliked)\s+(\d+)\s+(\d+)$/i.exec(text);
  if (!m) return null;
  return { liked: m[1].toLowerCase() === 'liked', musicId: Number(m[2]), count: Number(m[3]) };
}

// The channel id as stored, normalized to a -100… chat id.
function channelChatId(channelId) {
  const id = String(channelId ?? '');
  return id.startsWith('-100') ? id : `-100${id}`;
}

// Adds `count` votes from made-up users to a channel post and redraws its buttons.
export async function addFakeLikes({ liked, musicId, count }) {
  if (count > MAX_FAKE_LIKES) return tell(`At most ${MAX_FAKE_LIKES} at a time.`);
  const music = await findMusic(musicId);
  if (!music?.channel_id) return tell(`No votes on music ${musicId} yet, so its channel is unknown.`);

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
const toBool = (v) => (/^(true|1)$/i.test(String(v).trim()) ? true : /^(false|0)$/i.test(String(v).trim()) ? false : null);

// A CSV document with caption /import — e.g. a "Likes_Backup" file the n8n
// workflow sent — loaded into the likes table. Votes already in the table win
// over the file, so votes cast since the backup are kept.
export async function importLikes(document) {
  const csv = parseCsv(utf8Decode(await api.getFileContent(document.file_id)));
  const rows = [];
  for (const r of csv) {
    const row = {
      user_id: toInt(r.user_id),
      liked: toBool(r.liked),
      music_id: toInt(r.music_id),
      user_name: r.user_name || null,
      channel_id: r.channel_id || null,
      music_name: r.music_name || null,
    };
    if (row.user_id != null && row.music_id != null && row.liked != null) rows.push(row);
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
