import { table, integer, text, boolean, uniqueIndex, sql } from 'sdk/db';

// Database tables, as named exports. `npx tgcloud push` registers the schema;
// `npx tgcloud migrate` applies the changes to the database.
// Keys match the column names, so rows read back with the same field names
// the n8n workflow used.

// One vote per (channel, music, user) — the n8n "Likes" data table. `music_id`
// is the message_id of the post, unique only within its channel, so
// `channel_id` is always set.
export const likes = table('likes', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  user_id:    integer('user_id').notNull(),
  liked:      boolean('liked').notNull(),
  music_id:   integer('music_id').notNull(),
  user_name:  text('user_name'),
  channel_id: text('channel_id'),
  music_name: text('music_name'),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updated_at: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  musicUser: uniqueIndex('uidx_likes_music_user').on(t.music_id, t.user_id)
    .deprecated('message ids repeat across channels; replaced by uidx_likes_channel_music_user'),
  channelMusicUser: uniqueIndex('uidx_likes_channel_music_user').on(t.channel_id, t.music_id, t.user_id),
}));

// Channels the bot was added to. Only `active` ones are processed; the owner
// (ADMIN_ID) activates them from the panel or the notice the bot sends.
export const channels = table('channels', {
  chat_id:    text('chat_id').primaryKey(),               // '-100…'
  title:      text('title'),
  username:   text('username'),                           // public channels: t.me/<username>/<post>
  status:     text('status').notNull().default('pending'), // pending | active | paused
  added_by:   integer('added_by'),                        // who made the bot an admin; manager on activation
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  updated_at: integer('updated_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Who may see which channel's stats in the panel. The owner sees everything
// without a row here.
export const channel_members = table('channel_members', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  user_id:    integer('user_id').notNull(),
  user_name:  text('user_name'),
  role:       text('role').notNull().default('manager'),  // manager | viewer (both read-only for now)
  added_at:   integer('added_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  channelUser: uniqueIndex('uidx_members_channel_user').on(t.channel_id, t.user_id),
}));

// One-time invite links: t.me/<bot>?start=inv_<code> → a channel_members row.
export const invites = table('invites', {
  code:       text('code').primaryKey(),
  channel_id: text('channel_id').notNull(),
  role:       text('role').notNull().default('manager'),
  created_by: integer('created_by').notNull(),
  used_by:    integer('used_by'),
  used_at:    integer('used_at', { mode: 'timestamp' }),
  revoked:    boolean('revoked').notNull().default(false),
  expires_at: integer('expires_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

// Key/value settings, e.g. the OpenRouter API key (set with /setkey).
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});
