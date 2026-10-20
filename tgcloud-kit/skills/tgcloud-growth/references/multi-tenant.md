# Multi-tenant: one bot, many channels (or groups)

The bot's owner (`ADMIN_ID`) runs the service. Channel admins add the bot to
their channels, and each channel gets:
- its own status;
- its own managers and viewers;
- its own slice of every table.

The same shape works for groups. Check `chat.type`.

## Tables

```js
// Channels the bot was added to. Only live ones are served.
export const channels = table('channels', {
  chat_id:    text('chat_id').primaryKey(),                 // '-100…' as TEXT (CSV exports mangle big numbers)
  title:      text('title'),
  username:   text('username'),                             // public: t.me/<username>/<post>
  status:     text('status').notNull().default('pending'),  // pending | active | paused
  added_by:   integer('added_by'),                          // who made the bot an admin → manager on activation
  expires_at: integer('expires_at'),                        // paid until (unix s); null = no limit
  created_at: integer('created_at').default(sql`(unixepoch())`),
  updated_at: integer('updated_at').default(sql`(unixepoch())`),
});

// Who may see / manage which channel. The owner needs no row.
export const channel_members = table('channel_members', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  user_id:    integer('user_id').notNull(),
  user_name:  text('user_name'),
  role:       text('role').notNull().default('manager'),    // manager (changes things) | viewer (reads)
  added_at:   integer('added_at').default(sql`(unixepoch())`),
}, (t) => ({ channelUser: uniqueIndex('uidx_members_channel_user').on(t.channel_id, t.user_id) }));

// One-time invite links: t.me/<bot>?start=inv_<code> → a channel_members row.
export const invites = table('invites', {
  code:       text('code').primaryKey(),
  channel_id: text('channel_id').notNull(),
  role:       text('role').notNull().default('manager'),
  created_by: integer('created_by').notNull(),
  used_by:    integer('used_by'),
  used_at:    integer('used_at'),
  revoked:    boolean('revoked').notNull().default(false),
  expires_at: integer('expires_at'),
  created_at: integer('created_at').default(sql`(unixepoch())`),
});
```

Every per-channel table (votes, posts, events…) carries `channel_id TEXT NOT NULL`.
An id like a message_id is unique **only within its channel**, so unique indexes
are `(channel_id, item_id, user_id)` and never `(item_id, user_id)`. The
production bot had to deprecate exactly that index.

## lib/channels.js (core)

```js
export async function getChannel(chatId) {
  return db.get(sql`SELECT * FROM channels WHERE chat_id = ${String(chatId)}`);
}

// Served right now: activated, and its subscription (if any) not over.
export const isLive = (c) => c?.status === 'active' && (c.expires_at == null || c.expires_at > now());

// From a Chat object; a new channel starts `pending`. Keeps added_by/status when not given.
export async function saveChannel(chat, { addedBy = null, status = null } = {}) {
  await db.run(sql`
    INSERT INTO channels (chat_id, title, username, status, added_by)
    VALUES (${String(chat.id)}, ${chat.title ?? null}, ${chat.username ?? null}, ${status ?? 'pending'}, ${addedBy})
    ON CONFLICT (chat_id) DO UPDATE SET
      title = excluded.title, username = excluded.username,
      added_by = coalesce(excluded.added_by, channels.added_by),
      status = coalesce(${status}, channels.status), updated_at = unixepoch()`);
  return getChannel(chat.id);
}

// May change things (not only read): the owner, whoever added the bot, or a manager.
export async function isManager(userId, channel) {
  if (!userId || !channel) return false;
  if (userId === ADMIN_ID || channel.added_by === userId) return true;
  return Boolean(await db.get(sql`
    SELECT 1 AS x FROM channel_members
    WHERE channel_id = ${String(channel.chat_id)} AND user_id = ${userId} AND role = 'manager'`));
}

// A message that may not arrive (never started / blocked) → false instead of throwing.
export async function notify(userId, text, extra = {}) {
  try { await api.sendMessage({ chat_id: userId, text, ...extra }); return true; }
  catch (e) { if (e instanceof BotApiError) return false; throw e; }
}
```

## Registration: handlers/my_chat_member.js

The update arrives when the bot's own membership changes.

```js
const IN = ['administrator', 'creator'];
export default async function (update) {
  const { chat, from, new_chat_member: me } = update;
  if (chat.type === 'private') return setBlocked(chat.id, me?.status === 'kicked');   // from the template
  if (chat.type !== 'channel') return;
  if (!IN.includes(me?.status)) {                       // removed or demoted → pause
    const known = await getChannel(chat.id);
    if (known && known.status !== 'paused') { await saveChannel(chat, { status: 'paused' }); await notify(ADMIN_ID, `⏸ removed from «${chat.title}»`); }
    return;
  }
  const before = await getChannel(chat.id);
  const status = from?.id === ADMIN_ID ? 'active' : before?.status === 'active' ? 'active' : 'pending';
  const channel = await saveChannel(chat, { addedBy: from?.id ?? null, status });
  if (isLive(channel)) return;
  await notify(ADMIN_ID, `📢 added to «${chat.title}» by ${from?.id}`, { reply_markup: { inline_keyboard: [[
    { text: '✅ Activate', callback_data: `ch:active:${chat.id}` },
    { text: '⛔️ Reject', callback_data: `ch:paused:${chat.id}` },
  ]] } });
}
```

The `ch:` callback:
1. checks `query.from.id === ADMIN_ID`;
2. sets the status;
3. on activation, adds `added_by` as a manager (`addMember`);
4. edits the notice to show the result.

With payments, a paying user's channel activates itself (payments.md).

Every content handler (`channel_post`, the vote buttons, `chat_member`)
starts with `if (!isLive(await getChannel(chat.id))) return;`. A paused or
expired channel is ignored. For a button, answer with an alert explaining why.

## Members and one-time invites

- `addMember(channelId, user, role)` upserts into `channel_members`.
  `removeMember` deletes the row. When the user has no channels left, it also
  resets their menu button.
- `createInvite(channelId, role, createdBy)`:
  1. makes a random code (16 chars from an unambiguous alphabet, via
     `crypto.getRandomValues` when available);
  2. sets a 7-day expiry;
  3. returns `https://t.me/<bot>?start=inv_<code>`.
- `redeemInvite(code, user)` refuses:
  - an unknown or revoked code;
  - a code used by someone else;
  - an expired code;
  - a missing channel.

  Otherwise it marks the code used and adds the member. Route it in
  `startPayload()`: `inv_<code>`.
- The Mini App button for members only:
  `api.setChatMenuButton({ chat_id: userId, menu_button: { type: 'web_app', text: 'پنل', web_app: { url: MINI_APP_URL } } })`.
  This sets it for that user's chat only. It fails with 403 if they never
  started the bot, so return false rather than throwing.

## Access from endpoints (lib/access.js)

```js
// The channels a read may cover: null = every channel (owner asking for 'all'), else a list of ids.
export async function channelScope(ctx, channelId) {
  const requested = channelId == null || channelId === '' || channelId === 'all' ? 'all' : String(channelId);
  if (isAdmin(ctx)) return requested === 'all' ? null : [requested];
  const allowed = (await db.all(sql`SELECT channel_id FROM channel_members WHERE user_id = ${callerId(ctx)}`)).map((r) => r.channel_id);
  if (!allowed.length) throw forbidden('No channel is enabled for you');
  if (requested === 'all') return allowed;
  if (!allowed.includes(requested)) throw forbidden();
  return [requested];
}

// One channel the caller may read; 'all' refused with NEED_CHANNEL.
export async function readableChannel(ctx, channelId) { /* channelScope → getChannel → NOT_FOUND */ }
// The same for changes: owner or manager.
export async function managedChannel(ctx, channelId) { /* readableChannel + isManager else FORBIDDEN */ }
```

Every stats query adds `inList('channel_id', scope)` when `scope` isn't null.
The client may send any `channelId`, and it is re-checked on every call.
`endpoints/me.js` returns the caller's channels with their role, so the UI can
show a picker and hide manager-only actions. The server still decides.

Tests to write:
- a viewer reading another channel → `FORBIDDEN`;
- a viewer changing something → `FORBIDDEN`;
- the owner with `'all'` → every row;
- a paused channel's votes are refused.
