# Patterns (taken from a working tgcloud bot)

## Where code goes

- `handlers/<update_type>.js`: thin. Read the payload, call lib functions, answer.
- `lib/<feature>.js`: DB queries and Bot API helpers for one feature (e.g. `lib/likes.js`).
- `lib/config.js`: constants only (ADMIN_ID, flags, limits). There are no env vars, so config lives here, and secrets go in the `settings` table.
- `lib/admin.js`: the bodies of the admin commands. `handlers/message.js` routes to them.

## Inline buttons + callback_query (votes, menus)

```js
// lib/votes.js
export function voteKeyboard(up = 0, down = 0) {
  return { inline_keyboard: [[
    { text: `❤️ (${up})`, callback_data: 'up' },
    { text: `🥀 (${down})`, callback_data: 'down' },
  ]] };
}

// Redraw buttons; ignore "message is not modified" (same counts pressed twice).
export async function refreshButtons(chatId, messageId) {
  const { up, down } = await countVotes(messageId);
  try {
    await api.editMessageReplyMarkup({ chat_id: chatId, message_id: messageId, reply_markup: voteKeyboard(up, down) });
  } catch (e) {
    if (!(e.code === 400 && /not modified/i.test(e.description ?? ''))) throw e;
  }
}
```

```js
// handlers/callback_query.js
export default async function (query, ctx) {
  if (!query.message) return;                 // inline-mode message: nothing to edit
  await saveVote({ user_id: query.from.id, item_id: query.message.message_id, liked: query.data === 'up' });
  await api.answerCallbackQuery({ callback_query_id: query.id, text: 'Saved ✅' });   // always answer
  await refreshButtons(query.message.chat.id, query.message.message_id);
}
```

## One row per (item, user): upsert

Use a unique index in schema.js plus `ON CONFLICT`:

```js
await db.run(sql`
  INSERT INTO votes (user_id, item_id, liked) VALUES (${userId}, ${itemId}, ${liked ? 1 : 0})
  ON CONFLICT (item_id, user_id) DO UPDATE SET liked = excluded.liked`);
```

For bulk imports, insert in chunks of about 50 rows per statement.

Counting with SQL:
`db.get(sql\`SELECT coalesce(sum(liked = 1), 0) AS up, coalesce(sum(liked = 0), 0) AS down FROM votes WHERE item_id = ${id}\`)`.
Wrap the results in `Number(...)`.

## Admin commands

`handlers/message.js` (from the template) checks `message.from.id === ADMIN_ID`, gets the command from `adminCommand()`, awaits it, and on failure sends `⚠️ Command failed: …` to the admin. Without that message a failure is silent. To add a command, add one line to `adminCommand()` and put the body in `lib/admin.js`.
To accept a file sent as a reply, use `message.document ?? message.reply_to_message?.document`.

## Sending files

`import { api, InputFile } from 'sdk'`, then
`api.sendDocument({ chat_id, document: new InputFile(bytes, 'name.csv', { type: 'text/csv' }), caption })`.
Build CSV/XLSX bytes yourself, because npm packages aren't available at runtime.

## Channel posts

The bot must be an admin in the channel. `handlers/channel_post.js` receives the post. To "edit" media, re-send it with a new caption and buttons, then `deleteMessage` the original.

## Secrets (API keys)

Add an admin command like `/setkey <key>` that calls `setSetting('openrouter_key', key)` and deletes the admin's message. Read the key later with `getSetting`. Use `fetch` from `sdk` for outbound HTTP.

## Scheduled jobs

The platform has no scheduler. Use a GitHub Actions workflow on `schedule:` that runs a handler in the cloud:

```yaml
on: { schedule: [{ cron: '0 */8 * * *' }], workflow_dispatch: {} }
jobs:
  job:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: |
          mkdir -p .tgcloud
          npx tgcloud run handlers/message '{ text: "/backup", from: { id: ADMIN_ID }, chat: { id: ADMIN_ID } }'
        env: { TGCLOUD_TOKEN: '${{ secrets.TGCLOUD_TOKEN }}' }
```

## Webhook

Deployed `handlers/*` set which update types the bot receives. If updates stop arriving, run `npx tgcloud webhook`, and `npx tgcloud webhook sync` if it doesn't match.
