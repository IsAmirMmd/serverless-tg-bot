# Patterns (from a production tgcloud bot)

Each one fits the layout in [architecture.md](architecture.md). The template
already contains the first few. Copy their shape for new features.

## Where code goes

- `handlers/<update_type>.js` is thin: read the payload, route it to lib, answer.
- `lib/<feature>.js` holds one feature's DB queries, Bot API helpers and
  `handleXCallback(query)`.
- `lib/config.js` holds constants only. There are no env vars, so secrets go in
  the `settings` table (`lib/settings.js`).
- `lib/admin.js` holds the bodies of the admin commands. `handlers/message.js`
  routes to them through `adminCommand()`.

## Inline buttons and callback_query

```js
// lib/votes.js
export function voteKeyboard(itemId, up = 0, down = 0) {
  return { inline_keyboard: [[
    { text: `❤️ (${up})`, callback_data: `vote:up:${itemId}` },
    { text: `🥀 (${down})`, callback_data: `vote:down:${itemId}` },
  ]] };
}

// Buttons that start with `vote:`. true when handled.
export async function handleVoteCallback(query) {
  const m = /^vote:(up|down):(\d+)$/.exec(query.data ?? '');
  if (!m) return false;
  await saveVote({ user_id: query.from.id, item_id: Number(m[2]), liked: m[1] === 'up' });
  await api.answerCallbackQuery({ callback_query_id: query.id, text: 'ثبت شد ✅' });   // always answer; a toast
  if (query.message) await refreshButtons(query.message.chat.id, query.message.message_id, Number(m[2]));
  return true;
}

// Redraw the buttons. Ignore "message is not modified" (the same counts pressed twice).
export async function refreshButtons(chatId, messageId, itemId) {
  const { up, down } = await countVotes(itemId);
  try {
    await api.editMessageReplyMarkup({ chat_id: chatId, message_id: messageId, reply_markup: voteKeyboard(itemId, up, down) });
  } catch (e) {
    if (!(e.code === 400 && /not modified/i.test(e.description ?? ''))) throw e;
  }
}
```

`handlers/callback_query.js` gains one line: `if (await handleVoteCallback(query)) return;`.
callback_data is at most **64 bytes**. Keep it `<feature>:<action>:<id>`.

Buttons can carry `style: 'primary' | 'success' | 'danger'` (blue, green, red),
`url`, `web_app: { url }` (opens the Mini App), or `copy_text: { text }`.

## Menus as screens

`lib/menu.js` in the template:
- A screen is `{ text, reply_markup }`.
- `menu:<screen>` buttons edit the same message into that screen with
  `editMessageText`.
- A "not modified" error is ignored.
- Add a screen by adding an entry to `SCREENS`.

## One row per (item, user): upsert

Use a unique index in schema.js, plus `ON CONFLICT`:

```js
await db.run(sql`
  INSERT INTO votes (user_id, item_id, liked) VALUES (${userId}, ${itemId}, ${liked ? 1 : 0})
  ON CONFLICT (item_id, user_id) DO UPDATE SET liked = excluded.liked`);
```

For bulk imports, insert about 50 rows per statement.

Counting with SQL:
`db.get(sql\`SELECT coalesce(sum(liked = 1), 0) AS up, coalesce(sum(liked = 0), 0) AS down FROM votes WHERE item_id = ${id}\`)`.
Wrap the results in `Number(...)`.

## Admin commands

`handlers/message.js` checks `message.from.id === ADMIN_ID` and gets the
command's promise from `adminCommand()`. It awaits the promise, and on failure
sends `⚠️ Command failed: …` to the admin. Without that message a failure is
silent.

To add a command:
1. Add one line to `adminCommand()`.
2. Put the body in `lib/admin.js` or the feature module.
3. Add the command to `setCommands()`'s admin list.
4. Send `/setcommands`.

Commands with arguments: `const m = /^\/give\s+(\d+)\s+(\d+)$/.exec(text); if (m) return give(Number(m[1]), Number(m[2]));`.
To accept a file sent as a reply, use `message.document ?? message.reply_to_message?.document`.

## Deep links

`https://t.me/<bot username>?start=<payload>` takes a payload of at most 64
characters, `[A-Za-z0-9_-]`. Route the payload by prefix in `startPayload()` in
`handlers/message.js`. `trackStart` keeps the first payload in
`users.start_param`. Get the bot's username once with `api.getMe()` and cache it
in a module variable.

For a Mini App link with a parameter, use
`https://t.me/<bot>/<app short name>?startapp=<payload>`. Read the parameter as
`ctx.initData.start_param` in an endpoint.

## Multi-step input (ask, then take the answer)

```js
// a button or command asks:
await askFor(query.from, `rename:${itemId}`);
await api.sendMessage({ chat_id: query.from.id, text: 'اسم جدید رو بفرست 👇' });

// handlers/message.js, after the commands:
const pending = await takePending(message);
const rename = /^rename:(\d+)$/.exec(pending ?? '');
if (rename) return renameItem(Number(rename[1]), text, message);
```

`takePending` clears the action, so one question takes one answer. It ignores
answers older than 15 minutes.

## Sending files

`import { api, InputFile } from 'sdk'`, then
`api.sendDocument({ chat_id, document: new InputFile(bytes, 'name.csv', { type: 'text/csv' }), caption })`.
`lib/files.js` builds CSV (`toCsv`), XLSX (`toXlsx`) and UTF-8 bytes
(`utf8Encode`) without npm packages, and parses CSV (`parseCsv`). Add a BOM
(`'﻿'`) so Excel reads UTF-8 CSV correctly. Use `sendMediaGroup` for 2–10
documents in one album.

Downloading what a user sent: `api.getFileContent({ file_id })` returns the
bytes, up to 20 MB.

## Channel posts

The bot must be an admin of the channel. `handlers/channel_post.js` receives each
post. To "edit" media (a new caption or buttons on audio, for example), re-send
it with the changes and then `deleteMessage` the original.

The link to a post:
- public channel: `https://t.me/<username>/<message_id>`;
- private channel: `https://t.me/c/<chat id without -100>/<message_id>`.

## Secrets (API keys)

Add an admin command `/setkey <key>`. It calls
`setSetting('openai_key', key)` and then deletes the admin's message
(`api.deleteMessage`). Read the key later with `getSetting`. Call outside APIs
with `fetch` from `sdk`. Backups never include `settings`.

## Scheduled jobs

The platform has no scheduler. `.github/workflows/scheduled.yml` runs an admin
command in the cloud on a cron (UTC):

```yaml
- run: |
    mkdir -p .tgcloud
    npx tgcloud run handlers/message '{ text: "/weekly", from: { id: ADMIN_ID }, chat: { id: ADMIN_ID, type: "private" } }'
  env: { TGCLOUD_TOKEN: '${{ secrets.TGCLOUD_TOKEN }}' }
```

Add one job per command, and keep `workflow_dispatch` so it can run by hand. A
job that goes through many rows (reminders, digests) works in batches and keeps
a cursor in a table, like broadcasts in tgcloud-growth.

## Webhook

The deployed `handlers/*` decide which update types the bot receives. For
example, `chat_member` arrives only once `handlers/chat_member.js` exists. If
updates stop arriving, run `npx tgcloud webhook`, and `npx tgcloud webhook sync`
when it doesn't match. CI syncs on every deploy.
