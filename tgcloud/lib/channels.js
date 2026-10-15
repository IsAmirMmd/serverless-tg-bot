// Channels the bot serves, their members (who may see the stats) and invite
// links. Used by the handlers (my_chat_member, channel_post, callback_query,
// message) and by the panel endpoints.

import { db, api, BotApiError } from 'sdk';
import { sql } from 'sdk/db';
import { ADMIN_ID, MINI_APP_URL } from './config.js';

export const STATUSES = ['pending', 'active', 'paused'];
export const ROLES = ['manager', 'viewer'];

const now = () => Math.floor(Date.now() / 1000);

export async function getChannel(chatId) {
  return db.get(sql`SELECT * FROM channels WHERE chat_id = ${String(chatId)}`);
}

// Served right now: activated, and its subscription (if any) not over.
export const isLive = (channel) =>
  channel?.status === 'active' && (channel.expires_at == null || channel.expires_at > Math.floor(Date.now() / 1000));

export async function isActive(chatId) {
  return isLive(await getChannel(chatId));
}

// Records a channel from a Chat object; a new one starts as `pending`.
export async function saveChannel(chat, { addedBy = null, status = null } = {}) {
  await db.run(sql`
    INSERT INTO channels (chat_id, title, username, status, added_by)
    VALUES (${String(chat.id)}, ${chat.title ?? null}, ${chat.username ?? null}, ${status ?? 'pending'}, ${addedBy})
    ON CONFLICT (chat_id) DO UPDATE SET
      title = excluded.title,
      username = excluded.username,
      added_by = coalesce(excluded.added_by, channels.added_by),
      status = coalesce(${status}, channels.status),
      updated_at = unixepoch()`);
  return getChannel(chat.id);
}

// Status change. Activating also makes the user who added the bot a manager.
export async function setStatus(chatId, status) {
  if (!STATUSES.includes(status)) throw new Error(`Unknown status ${status}`);
  await db.run(sql`UPDATE channels SET status = ${status}, updated_at = unixepoch() WHERE chat_id = ${String(chatId)}`);
  const channel = await getChannel(chatId);
  if (status === 'active' && channel?.added_by && channel.added_by !== ADMIN_ID) {
    await addMember(channel.chat_id, { id: channel.added_by }, 'manager', { welcome: true });
  }
  return channel;
}

// 'https://t.me/<username>/' or, for a private channel, 'https://t.me/c/<id>/'.
export function postBase(channel) {
  if (!channel) return null;
  if (channel.username) return `https://t.me/${channel.username}/`;
  const id = String(channel.chat_id ?? '');
  return id.startsWith('-100') ? `https://t.me/c/${id.slice(4)}/` : null;
}

// ---------- members ----------

export async function memberChannelIds(userId) {
  const rows = await db.all(sql`SELECT channel_id FROM channel_members WHERE user_id = ${userId}`);
  return rows.map((r) => r.channel_id);
}

export async function isMember(userId) {
  return Boolean(await db.get(sql`SELECT 1 AS x FROM channel_members WHERE user_id = ${userId} LIMIT 1`));
}

// Shows the Mini App button in this user's chat only. Fails (403) if the user
// never started the bot — reported to the caller, not thrown.
export async function enablePanelButton(userId) {
  try {
    await api.setChatMenuButton({
      chat_id: userId,
      menu_button: { type: 'web_app', text: 'پنل', web_app: { url: MINI_APP_URL } },
    });
    return true;
  } catch (e) {
    if (e instanceof BotApiError) return false;
    throw e;
  }
}

async function disablePanelButton(userId) {
  try {
    await api.setChatMenuButton({ chat_id: userId, menu_button: { type: 'default' } });
  } catch (e) {
    if (!(e instanceof BotApiError)) throw e;
  }
}

// Message to a user; false when they never started the bot or blocked it.
export async function notify(userId, text, extra = {}) {
  try {
    await api.sendMessage({ chat_id: userId, text, ...extra });
    return true;
  } catch (e) {
    if (e instanceof BotApiError) return false;
    throw e;
  }
}

export const panelKeyboard = () =>
  ({ inline_keyboard: [[{ text: 'باز کردن پنل', web_app: { url: MINI_APP_URL } }]] });

// Grants `user` ({ id, username? }) access to a channel. With welcome, the user
// gets the panel button and a message. → { reachable } (false: never started the bot).
export async function addMember(channelId, user, role = 'manager', { welcome = false } = {}) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role ${role}`);
  await db.run(sql`
    INSERT INTO channel_members (channel_id, user_id, user_name, role)
    VALUES (${String(channelId)}, ${user.id}, ${user.username ?? null}, ${role})
    ON CONFLICT (channel_id, user_id) DO UPDATE SET
      role = excluded.role, user_name = coalesce(excluded.user_name, channel_members.user_name)`);
  if (!welcome) return { reachable: true };
  const channel = await getChannel(channelId);
  const reachable = await enablePanelButton(user.id);
  if (reachable) {
    await notify(user.id, `✅ دسترسی شما به آمار کانال «${channel?.title ?? channelId}» فعال شد.`, {
      reply_markup: panelKeyboard(),
    });
  }
  return { reachable };
}

export async function removeMember(channelId, userId) {
  await db.run(sql`DELETE FROM channel_members WHERE channel_id = ${String(channelId)} AND user_id = ${userId}`);
  if (!(await isMember(userId)) && userId !== ADMIN_ID) await disablePanelButton(userId);
}

// ---------- invites ----------

const INVITE_DAYS = 7;

export function randomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

let botUsername;
export async function getBotUsername() {
  botUsername ??= (await api.getMe()).username;
  return botUsername;
}

export async function inviteLink(code) {
  return `https://t.me/${await getBotUsername()}?start=inv_${code}`;
}

export async function createInvite(channelId, role, createdBy) {
  if (!ROLES.includes(role)) throw new Error(`Unknown role ${role}`);
  const code = randomCode();
  const expiresAt = now() + INVITE_DAYS * 86400;
  await db.run(sql`
    INSERT INTO invites (code, channel_id, role, created_by, expires_at)
    VALUES (${code}, ${String(channelId)}, ${role}, ${createdBy}, ${expiresAt})`);
  return { code, link: await inviteLink(code), expires_at: expiresAt };
}

// /start inv_<code> → { ok: true, channel } or { ok: false, reason }.
export async function redeemInvite(code, user) {
  const invite = await db.get(sql`SELECT * FROM invites WHERE code = ${code}`);
  if (!invite || invite.revoked) return { ok: false, reason: 'این لینک دعوت معتبر نیست.' };
  if (invite.used_by && invite.used_by !== user.id) return { ok: false, reason: 'این لینک دعوت قبلاً استفاده شده است.' };
  if (invite.expires_at && invite.expires_at < now()) return { ok: false, reason: 'این لینک دعوت منقضی شده است.' };
  const channel = await getChannel(invite.channel_id);
  if (!channel) return { ok: false, reason: 'کانال این دعوت پیدا نشد.' };

  await db.run(sql`UPDATE invites SET used_by = ${user.id}, used_at = unixepoch() WHERE code = ${code}`);
  await addMember(invite.channel_id, user, invite.role);
  await enablePanelButton(user.id);
  return { ok: true, channel };
}
