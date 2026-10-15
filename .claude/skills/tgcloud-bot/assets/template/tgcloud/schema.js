import { table, integer, text, boolean, uniqueIndex, sql } from 'sdk/db';

// Database tables, as named exports. `npx tgcloud push` registers the schema;
// `npx tgcloud migrate` applies the changes to the database.
// No foreign keys (.references() throws); drop things only with .deprecated('reason').

// Key/value settings, e.g. API keys set by an admin command.
export const settings = table('settings', {
  key:   text('key').primaryKey(),
  value: text('value').notNull(),
});

// Example of a typical table — uncomment and adapt:
// export const votes = table('votes', {
//   id:         integer('id').primaryKey({ autoIncrement: true }),
//   user_id:    integer('user_id').notNull(),
//   item_id:    integer('item_id').notNull(),
//   liked:      boolean('liked').notNull(),
//   created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
// }, (t) => ({
//   itemUser: uniqueIndex('uidx_votes_item_user').on(t.item_id, t.user_id),
// }));
