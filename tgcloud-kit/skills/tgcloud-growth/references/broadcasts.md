# Segmented broadcasts

The owner messages a segment of the people who started the bot. There are two
constraints:
- one run of a module should stay short;
- Telegram rate-limits sending (about 30 messages per second overall, and
  429s when you exceed it).

So a broadcast is a **row with a cursor**, sent in **batches**. The panel (or a
cron) calls "next batch" until the row is `done`.

## Table

```js
export const broadcasts = table('broadcasts', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  created_by:  integer('created_by').notNull(),
  segment:     text('segment').notNull(),                 // JSON of the validated segment
  text:        text('text').notNull(),
  total:       integer('total').notNull().default(0),     // audience size when created
  sent:        integer('sent').notNull().default(0),
  failed:      integer('failed').notNull().default(0),
  cursor:      integer('cursor').notNull().default(0),    // last user_id handled — batches go by user_id
  status:      text('status').notNull().default('sending'), // sending | done
  created_at:  integer('created_at').default(sql`(unixepoch())`),
  finished_at: integer('finished_at'),
});
```

It relies on `users.blocked` and `users.unsubscribed` from the template. Read
them as `coalesce(x, 0) = 0`, because they were added as nullable columns.

## lib/broadcast.js

```js
export const BATCH = 60;
const FOOTER = '\n\n—\n🔕 برای اینکه دیگه از این پیام‌ها نگیری: /stop';

// Client input → a validated segment (whitelists only). Throws EndpointError BAD_INPUT.
export async function parseSegment(input = {}) { /* activity ∈ ['all','active30','inactive30','new7'], text filters trimmed + capped */ }

function audienceWhere(seg, after = 0) {
  const conds = [
    sql`u.user_id > ${after}`,
    sql`u.start_count > 0 AND coalesce(u.blocked, 0) = 0 AND coalesce(u.unsubscribed, 0) = 0`,
  ];
  if (seg.activity === 'new7') conds.push(sql`u.first_seen_at > ${now() - 7 * DAY}`);
  // … more filters: came from a channel (start_param prefix), liked an artist (EXISTS over votes), …
  return sql`WHERE ${conds.reduce((a, b) => sql`${a} AND ${b}`)}`;
}

export const audienceCount = async (seg) =>
  Number((await db.get(sql`SELECT count(*) AS n FROM users u ${audienceWhere(seg)}`))?.n ?? 0);

export async function createBroadcast(createdBy, seg, text) {
  // validate text (non-empty, ≤ 3500 chars so the footer fits in 4096), count the audience (refuse 0)
  const r = await db.run(sql`INSERT INTO broadcasts (created_by, segment, text, total)
    VALUES (${createdBy}, ${JSON.stringify(seg)}, ${text}, ${total})`);
  return Number(r.lastInsertRowid);
}

// The next batch. → the row after it.
export async function sendBatch(id) {
  const b = await db.get(sql`SELECT * FROM broadcasts WHERE id = ${id}`);
  if (!b || b.status === 'done') return b;
  const users = await db.all(sql`SELECT u.user_id FROM users u ${audienceWhere(JSON.parse(b.segment), b.cursor)} ORDER BY u.user_id LIMIT ${BATCH}`);
  let sent = 0, failed = 0, cursor = b.cursor, paused = false;
  for (const { user_id: userId } of users) {
    try {
      await api.sendMessage({ chat_id: userId, text: b.text + FOOTER, link_preview_options: { is_disabled: true } });
      sent += 1;
    } catch (e) {
      if (!(e instanceof BotApiError)) throw e;
      if (e.code === 429) { paused = true; break; }           // too fast: the next call resumes from this user
      failed += 1;
      if (e.code === 403 || /chat not found|deactivated/i.test(e.description ?? '')) {
        await db.run(sql`UPDATE users SET blocked = 1 WHERE user_id = ${userId}`);   // skipped from now on
      }
    }
    cursor = userId;
  }
  const done = !paused && users.length < BATCH;
  await db.run(sql`UPDATE broadcasts SET sent = sent + ${sent}, failed = failed + ${failed}, cursor = ${cursor},
    status = ${done ? 'done' : 'sending'}, finished_at = ${done ? now() : null} WHERE id = ${id}`);
  return db.get(sql`SELECT * FROM broadcasts WHERE id = ${id}`);
}
```

Why it's built this way:
- **The cursor is the last `user_id`**, not an offset. Users who start the bot
  or block it mid-broadcast don't shift the window, so nobody is skipped or
  messaged twice.
- **On 429, stop** and let the caller come back. Don't sleep inside the
  module.
- **The audience is re-evaluated per batch.** Someone who sends `/stop`
  mid-broadcast stops receiving it.
- **Every message carries the opt-out.** `/stop` in `message.js` calls
  `unsubscribe()` (template), and `/start` resubscribes.

## Endpoints (owner only)

- `ownerBroadcastPreview`, input `{ segment }`, returns
  `{ count, recent: last 5 broadcasts }`. The UI shows "N people will get it"
  before sending.
- `ownerBroadcastSend`:
  - input `{ segment, text }` creates the broadcast and sends the first batch;
  - input `{ id }` sends the next batch;
  - it returns the row.

  The panel loops while `status === 'sending'`, shows `sent/total`, and
  survives a closed panel. Reopening continues the same `id` from `recent`.

Instead of the panel, a cron job can drive the loop through an admin command
that calls `sendBatch` for every broadcast still `sending`.

## Tests

- A segment excludes blocked, unsubscribed and never-started users.
- 403 → the user is marked blocked.
- 429 mid-batch → paused, then the next call resumes after the last user that
  succeeded.
- Two batches cover everyone exactly once.
- `/stop` between batches → skipped.
