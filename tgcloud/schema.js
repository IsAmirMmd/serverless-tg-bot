import { table, integer, text, boolean, uniqueIndex, sql } from 'sdk/db';

// Database tables, as named exports. `npx tgcloud push` registers the schema;
// `npx tgcloud migrate` applies the changes to the database.
// Keys match the column names, so rows read back with the same field names
// the n8n workflow used.

// One vote per (music, user) — the n8n "Likes" data table. `music_id` is the
// message_id of the post in the channel.
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
  musicUser: uniqueIndex('uidx_likes_music_user').on(t.music_id, t.user_id),
}));

// Key/value settings, e.g. the OpenRouter API key (set with /setkey).
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});
