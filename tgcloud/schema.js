import { table, integer, text, boolean, uniqueIndex, index, sql } from 'sdk/db';

// Database tables, as named exports. `npx tgcloud push` registers the schema;
// `npx tgcloud migrate` applies the changes to the database.
// Keys match the column names, so query results use the same field names.

// One vote per (channel, music, user). `music_id`
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
  expires_at: integer('expires_at', { mode: 'timestamp' }), // paid until; null = no limit (owner-activated)
  reminded_for: integer('reminded_for'),                  // expires_at value the renewal reminder was sent for
  expired_for:  integer('expired_for'),                   // expires_at value the "expired" notice was sent for
  growth_buttons: boolean('growth_buttons').default(true), // "my songs" / "send to a friend" row under posts (null = on)
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

// Everyone who has started the bot or voted under a channel post (one row per
// Telegram user), kept up to date on every /start and vote.
// Columns added to an existing table are nullable, so `migrate --safe` (the
// deploy workflow) always applies them.
export const bot_users = table('bot_users', {
  user_id:       integer('user_id').primaryKey(),
  username:      text('username'),
  first_name:    text('first_name'),
  last_name:     text('last_name'),
  language_code: text('language_code'),
  is_premium:    boolean('is_premium').notNull().default(false),
  start_param:   text('start_param'),                     // payload of the first /start (e.g. inv_…)
  start_count:   integer('start_count').notNull().default(1),  // 0: only voted, never started
  joined_via:    text('joined_via').notNull().default('start'), // start | vote — how they first showed up
  vote_count:    integer('vote_count').notNull().default(0),    // button presses on channel posts
  last_vote_at:  integer('last_vote_at', { mode: 'timestamp' }),
  first_seen_at: integer('first_seen_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  last_seen_at:  integer('last_seen_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  blocked:       boolean('blocked').default(false),      // a message to them failed with 403 (null = no)
  unsubscribed:  boolean('unsubscribed').default(false), // sent /stop: no owner messages (null = no)
  pending_action: text('pending_action'),                           // 'req:<chat id>' — next text is a song request
  pending_at:    integer('pending_at', { mode: 'timestamp' }),
});

// Every audio post the bot published, with what is not in the likes table:
// when it went out and how many members the channel had then.
export const posts = table('posts', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  music_id:   integer('music_id').notNull(),                // message_id of the bot's post
  title:      text('title'),
  performer:  text('performer'),
  file_id:    text('file_id'),
  duration:   integer('duration'),
  members:    integer('members'),                          // channel member count when posted
  posted_at:  integer('posted_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  channelMusic: uniqueIndex('uidx_posts_channel_music').on(t.channel_id, t.music_id),
}));

// Channel invite links the bot made, so a join can be traced to where it came from.
// kind: campaign (named by a manager) | ref (a listener's own link) | share (song
// pages in the bot) | bot (the channel button in the bot).
export const invite_links = table('invite_links', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  kind:       text('kind').notNull(),
  name:       text('name').notNull(),                      // campaign name; 'ref:<user id>'; 'share'; 'bot'
  url:        text('url').notNull(),
  owner_id:   integer('owner_id'),                         // ref: the listener; campaign: who made it
  revoked:    boolean('revoked').notNull().default(false),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  channelKindName: uniqueIndex('uidx_invite_links_channel_kind_name').on(t.channel_id, t.kind, t.name),
  url: uniqueIndex('uidx_invite_links_url').on(t.url),
}));

// Joins and leaves of channel members (chat_member updates), with the source
// of the join: 'direct' | 'folder' | 'other' | 'link:<name>' | or an invite_links kind.
export const member_events = table('member_events', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  user_id:    integer('user_id').notNull(),
  event:      text('event').notNull(),                     // join | leave
  source:     text('source').notNull().default('direct'),  // a leave keeps the source of the join before it
  link_id:    integer('link_id'),                          // invite_links.id, when the join came through one
  at:         integer('at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  channelAt: index('idx_member_events_channel_at').on(t.channel_id, t.at),
  channelUser: index('idx_member_events_channel_user').on(t.channel_id, t.user_id),
}));

// Songs listeners asked a channel to post (from the bot's "request a song" button).
export const song_requests = table('song_requests', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  user_id:    integer('user_id').notNull(),
  user_name:  text('user_name'),
  text:       text('text').notNull(),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  channelAt: index('idx_song_requests_channel_at').on(t.channel_id, t.created_at),
}));

// Owner messages to a segment of bot users, sent in batches from the panel.
export const broadcasts = table('broadcasts', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  created_by: integer('created_by').notNull(),
  segment:    text('segment').notNull(),                   // JSON: { channelId, activity, artist }
  text:       text('text').notNull(),
  total:      integer('total').notNull().default(0),       // audience size when created
  sent:       integer('sent').notNull().default(0),
  failed:     integer('failed').notNull().default(0),
  cursor:     integer('cursor').notNull().default(0),      // last user_id handled (batches go by user_id)
  status:     text('status').notNull().default('sending'), // sending | done
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
  finished_at: integer('finished_at', { mode: 'timestamp' }),
});

// Subscriptions bought with Telegram Stars (one row per payment). A payment
// extends one channel's expires_at; until the buyer has a channel it waits
// as credit (channel_id null) and is applied when they add the bot.
export const payments = table('payments', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  charge_id:  text('charge_id').notNull(),               // telegram_payment_charge_id (for refunds)
  user_id:    integer('user_id').notNull(),
  user_name:  text('user_name'),
  plan:       text('plan').notNull(),                    // PLANS[].id | 'gift' | 'unlimited' (owner gifts, 0 Stars)
  months:     integer('months').notNull(),               // paid plans; 0 for gifts
  days:       integer('days'),                           // gifts: length in days (null for paid plans: months × 30)
  stars:      integer('stars').notNull(),
  channel_id: text('channel_id'),                        // the channel it paid for; null = unused credit
  period_start: integer('period_start', { mode: 'timestamp' }).notNull(),
  period_end:   integer('period_end', { mode: 'timestamp' }).notNull(),
  refunded_at:  integer('refunded_at', { mode: 'timestamp' }),
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
}, (t) => ({
  charge: uniqueIndex('uidx_payments_charge').on(t.charge_id),
}));

// One-time gift links: t.me/<bot>?start=gift_<code> → `days` of free
// subscription for whoever opens it (applied like paid credit).
export const gift_codes = table('gift_codes', {
  code:       text('code').primaryKey(),
  days:       integer('days').notNull(),
  created_by: integer('created_by').notNull(),
  used_by:    integer('used_by'),
  used_at:    integer('used_at', { mode: 'timestamp' }),
  revoked:    boolean('revoked').notNull().default(false),
  expires_at: integer('expires_at', { mode: 'timestamp' }),   // the link itself stops working after this
  created_at: integer('created_at', { mode: 'timestamp' }).default(sql`(unixepoch())`),
});

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
