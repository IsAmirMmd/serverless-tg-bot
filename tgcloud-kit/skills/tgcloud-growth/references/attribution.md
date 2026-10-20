# Attribution: where users and members come from

There are two funnels, measured differently:
- **Bot users** start the bot. They are measured with **deep-link payloads**.
- **Channel members** join a channel. They are measured with **invite links**
  plus **`chat_member` updates**.

## Deep-link payloads (bot)

`https://t.me/<bot>?start=<payload>`. The payload is at most 64 characters of
`[A-Za-z0-9_-]`. Give each entry point a prefix and route it in
`startPayload()`:

| Payload | Meaning |
|---|---|
| `inv_<code>` | a panel invite (multi-tenant.md) |
| `gift_<code>` | a gift (payments.md) |
| `m<cid>` | "my items" for channel cid, from a button under each post |
| `s<cid>_<item>` | a shared item, opened by a friend |
| `ref_<user id>` | a user's referral link |

Rules:
- Chat ids don't fit as-is (`-100` plus digits), so use the short form
  `String(chatId).replace(/^-100/, '')` and restore it with `'-100' + short`.
- `trackStart` keeps the **first** payload in `users.start_param`. A row created
  earlier by another path (e.g. a button press) still records its first
  `/start` payload (`CASE WHEN start_count = 0`).
- Count by source in SQL: `GROUP BY substr(start_param, 1, 1)`, or by the
  prefix before `_`.

Buttons under channel posts are url buttons that carry the payload. They work
for people who never started the bot. Build the bot URL with the cached
`getMe().username`.

A share link:
`https://t.me/share/url?url=${encodeURIComponent(botLink)}&text=${encodeURIComponent(text)}`.
It opens Telegram's chat picker.

## Channel invite links

```js
export const invite_links = table('invite_links', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  kind:       text('kind').notNull(),        // campaign | ref | share | bot
  name:       text('name').notNull(),        // campaign name; 'ref:<user id>'; 'share'; 'bot'
  url:        text('url').notNull(),
  owner_id:   integer('owner_id'),
  revoked:    boolean('revoked').notNull().default(false),
  created_at: integer('created_at').default(sql`(unixepoch())`),
}, (t) => ({
  key: uniqueIndex('uidx_invite_links_channel_kind_name').on(t.channel_id, t.kind, t.name),
  url: uniqueIndex('uidx_invite_links_url').on(t.url),
}));

// Get-or-create. Two concurrent requests: the second insert is skipped and both read the first link.
export async function ensureLink(channelId, kind, name, ownerId = null) {
  const find = () => db.get(sql`SELECT * FROM invite_links WHERE channel_id = ${String(channelId)} AND kind = ${kind} AND name = ${name}`);
  const found = await find();
  if (found) return found;
  const link = await api.createChatInviteLink({ chat_id: String(channelId), name: name.slice(0, 32) });   // throws without "Add subscribers"
  await db.run(sql`INSERT INTO invite_links (channel_id, kind, name, url, owner_id)
    VALUES (${String(channelId)}, ${kind}, ${name}, ${link.invite_link}, ${ownerId}) ON CONFLICT DO NOTHING`);
  return find();
}
```

- **Campaign links** are named by a manager in the panel (one per ad or
  placement). In the endpoint:
  - trim the name and cap it at 32 characters;
  - refuse duplicates with `EndpointError`;
  - map a `BotApiError` to "give the bot the Add subscribers right".
- **Referral links**: `ensureLink(cid, 'ref', 'ref:' + userId, userId)`. Each
  user has one personal link. A leaderboard counts joins per `owner_id` that
  stayed (no later leave).

## Join and leave tracking: handlers/chat_member.js

The bot receives `chat_member` updates only when:
- it is an **admin** of the channel, and
- `chat_member` is in the webhook's allowed updates. Deploying
  `handlers/chat_member.js` puts it there, and CI's `webhook sync` makes sure.

```js
export const member_events = table('member_events', {
  id:         integer('id').primaryKey({ autoIncrement: true }),
  channel_id: text('channel_id').notNull(),
  user_id:    integer('user_id').notNull(),
  event:      text('event').notNull(),                     // join | leave
  source:     text('source').notNull().default('direct'),  // a leave copies its join's source
  link_id:    integer('link_id'),
  at:         integer('at').default(sql`(unixepoch())`),
}, (t) => ({
  channelAt: index('idx_member_events_channel_at').on(t.channel_id, t.at),
  channelUser: index('idx_member_events_channel_user').on(t.channel_id, t.user_id),
}));

const isIn = (m) => ['creator', 'administrator', 'member'].includes(m?.status) || (m?.status === 'restricted' && Boolean(m.is_member));

async function joinSource(update) {
  if (update.via_chat_folder_invite_link) return { source: 'folder', linkId: null };
  const link = update.invite_link;
  if (!link) return { source: 'direct', linkId: null };
  const known = await db.get(sql`SELECT id, kind FROM invite_links WHERE url = ${link.invite_link}`);
  if (known) return { source: known.kind, linkId: known.id };
  if (link.is_primary) return { source: 'primary', linkId: null };
  return { source: link.name ? `link:${link.name.slice(0, 32)}` : 'other', linkId: null };   // another admin's link: the URL arrives cut short
}

// ChatMemberUpdated → 'join' | 'leave' | null (promotions etc. are not membership changes)
export async function recordMemberUpdate(update) {
  const user = update.new_chat_member?.user;
  if (!user || user.is_bot) return null;
  const was = isIn(update.old_chat_member), is = isIn(update.new_chat_member);
  if (was === is) return null;
  // join: insert with joinSource(); leave: insert with the source/link_id of this user's latest join
}
```

The handler:
1. ignores non-channel chats and channels that aren't live;
2. calls `recordMemberUpdate`.

## Reading it

Per source, since a date, take the joins plus how many of those left:
- at all (`left_total`);
- within 7 days (`left_7d`).

This is an `EXISTS` on a later leave by the same user. Then `stayed = joins -
left_total`. List campaign links even with zero joins, so managers see what
they made.

```sql
SELECT j.source, j.link_id, count(*) AS joins,
       coalesce(sum(EXISTS (SELECT 1 FROM member_events x WHERE x.channel_id = j.channel_id AND x.user_id = j.user_id
                            AND x.event = 'leave' AND x.at >= j.at)), 0) AS left_total
FROM member_events j WHERE j.channel_id = ? AND j.event = 'join' AND j.at >= ? GROUP BY j.source, j.link_id
```

- **Member count now**: `api.getChatMemberCount({ chat_id })`.
- **Members at posting time**: when the bot publishes a post, record the
  count in a `posts` row. That gives the per-post engagement rate
  (reports.md).

## Tests

- A join via a known link → its kind.
- A folder join → `'folder'`.
- A leave copies the join's source.
- A promotion is no event.
- `ensureLink` called twice → one Telegram call.
- `createChatInviteLink` failing → a clear `EndpointError`.
