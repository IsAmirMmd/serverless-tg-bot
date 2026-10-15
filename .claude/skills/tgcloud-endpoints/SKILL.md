---
name: tgcloud-endpoints
description: Complete reference for writing Telegram Serverless (tgcloud) endpoints — tgcloud/endpoints/<name>.js answering POST /api/<name> for a Mini App — signature (input, ctx), verified ctx.initData, EndpointError, client errors, Serverless.call, admin-only access, pagination/search/filter patterns with the db SDK, testing with `tgcloud run`, deploy. Use whenever creating, changing, debugging or reviewing an endpoint or the Mini App's server side, so the official docs (core.telegram.org/bots/serverless#endpoints) don't need to be re-read.
---

# tgcloud endpoints

Distilled from https://core.telegram.org/bots/serverless#endpoints (October 2026) and tested against a live bot. If something here disagrees with the CLI's actual behavior, re-check the page with WebFetch and update this skill.

## The contract

- File: `tgcloud/endpoints/<name>.js`. The folder is **flat** (no subfolders). One file is one endpoint, answering `POST /api/<name>` on the Mini App's host (`https://app<app_id>.tgcloud.ai/api/<name>`).
- Name: a JS identifier (letters, digits, `_`, not starting with a digit), e.g. `adminLikes`, `getProfile`.
- Scaffold: `npx tgcloud add endpoints/<name>`. Deploy: `npx tgcloud push`. `push` mirrors the folder, so a deleted file is removed from the cloud.
- Shape:

```js
import { db, api, fetch, EndpointError } from 'sdk';
import { sql, eq } from 'sdk/db';
import { something } from '../lib/something.js';   // relative, WITH .js

export default async function (input, ctx) {
  // input: the JSON object the Mini App sent ({} when none)
  // ctx.initData: verified init data — { user, chat, start_param, auth_date, … }
  return { ok: true };                              // → JSON to the client
}
```

## ctx and trust

- `ctx.initData` has the same shape as `Telegram.WebApp.initDataUnsafe`, but the **platform has verified it**, so it can be trusted. There is **no `ctx.user`**: use `ctx.initData.user`. No other ctx fields are documented.
- A call without valid init data is rejected with **401 before your code runs** (client `err.type` is `'UNAUTHORIZED'`). Endpoints can only be called by a Telegram user from the bot's Mini App. There's no public API and no login to build.
- But **any** Telegram user who opens the Mini App can call **every** endpoint. Identify and authorize the caller only from `ctx.initData.user.id`. Never trust ids, roles or prices sent in `input`.
- `input` is arbitrary client JSON. Coerce and clamp everything: numbers (`Math.trunc`, min/max), strings (`typeof`, `.trim()`, `.slice(0, N)`), enums (whitelist).

## Errors

| Server does | HTTP | Client `err` |
|---|---|---|
| `throw new EndpointError('متن خطا', { code: 'OUT_OF_STOCK' })` | 400 | `type: 'ENDPOINT_ERROR'`, `message` = description, `parameters` = the object, unchanged |
| any other throw / bug | 500 | generic error; the real message goes **only to logs** |
| invalid / missing init data | 401 | `type: 'UNAUTHORIZED'` |

Always put a machine-readable `code` in `parameters` so the UI can branch on it. Write the description in the user's language, because it is shown as is.

## Calling from the front-end

```js
Telegram.WebApp.Serverless.call('getProfile', { lang: 'fa' }, (err, result) => { … });
Telegram.WebApp.Serverless.call('getProfile', (err, result) => { … });   // no input
```

Requires `<script src="https://telegram.org/js/telegram-web-app.js"></script>`. Init data is sent automatically. `input` must be a **plain object** (not an array or string). In projects, use the promise wrapper `callEndpoint(name, input)` (`src/lib/serverless.js` in this repo; template in the `tgcloud-mini-app` skill) and, in React, the `useEndpoint(name, input)` hook (`src/lib/useEndpoint.js`).

## Patterns (tested, from this repo's `tgcloud/lib/dashboard.js`)

**Admin-only gate.** Call it first in every admin endpoint:

```js
import { ADMIN_ID } from './config.js';
export function requireAdmin(ctx) {
  if (ctx.initData?.user?.id !== ADMIN_ID) {
    throw new EndpointError('دسترسی فقط برای ادمین است', { code: 'FORBIDDEN' });
  }
}
```

The UI shows a "no access" screen when `err.code === 'FORBIDDEN'`.

**Multi-tenant scope (owner + channel members).** In this repo, `tgcloud/lib/access.js` has `channelScope(ctx, input.channelId)`. It returns `null` (owner asking for `'all'`) or the list of chat ids the caller may read, and throws `FORBIDDEN` otherwise. Every stats query then adds `scopeCondition(scope)` (`channel_id IN (…)`). The client may send any `channelId`, and the server re-checks it against `channel_members` each time. Owner-only actions call `requireOwner(ctx)`. Members, invites and channel status live in `tgcloud/lib/channels.js`.

**Thin endpoint, logic in lib.** Endpoints, bot handlers and scripts can all share it:

```js
// tgcloud/endpoints/adminLikes.js
import { requireAdmin, listLikes } from '../lib/dashboard.js';
export default async function (input, ctx) {
  requireAdmin(ctx);
  return listLikes(input);
}
```

**Pagination contract.** The client sends `{ page, size }` (1-based) and receives `{ rows, page, size, total, pages }`:

```js
export function pageParams(input = {}) {
  const toInt = (v, d) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d);
  const size = Math.min(100, Math.max(5, toInt(input.size, 20)));
  const page = Math.max(1, toInt(input.page, 1));
  return { page, size, offset: (page - 1) * size };
}
const total = Number((await db.get(sql`SELECT count(*) AS n FROM likes ${where}`))?.n ?? 0);
const rows = await db.all(sql`SELECT … FROM likes ${where} ORDER BY id DESC LIMIT ${p.size} OFFSET ${p.offset}`);
return { rows, page: p.page, size: p.size, total, pages: Math.max(1, Math.ceil(total / p.size)) };
```

**Composable WHERE / search.** `sql` fragments nest; join them with reduce:

```js
const conds = [
  input.filter === 'liked' ? sql`liked = 1` : null,
  text ? sql`(user_name LIKE ${'%' + text + '%'} OR music_name LIKE ${'%' + text + '%'})` : null,
].filter(Boolean);
const where = conds.length ? sql`WHERE ${conds.reduce((a, b) => sql`${a} AND ${b}`)}` : sql``;
```

Column names that come from code (never from input) can go through `sql.raw('user_name')`. Values always go through `${}` (bound parameters).

**Reports with GROUP BY, paginated.** Wrap the grouped query and filter or count the outer one:
`SELECT * FROM (${grouped}) WHERE ${having} … LIMIT … OFFSET …` and `SELECT count(*) AS n FROM (${filtered})`.
`group_concat(CASE WHEN liked = 1 THEN music_id END, '، ')` builds lists. `coalesce(sum(liked = 1), 0)` counts.

**Links to channel posts (no config).** A post's message_id plus its chat gives a link. `api.getChat({ chat_id })` → `chat.username` ? `https://t.me/<username>/<id>` : `https://t.me/c/<chat_id without -100>/<id>` (private, members only). Cache the base per chat in a module-level `Map`. For rows without a chat id, fall back to the most frequent one in the table. Return `music_url` per row, plus a page-wide `channelBase` for id lists. Open them in the UI with `Telegram.WebApp.openTelegramLink(url)`. See `withLinks()` in this repo's `tgcloud/lib/dashboard.js`.

**Raw SQL returns raw values**: booleans come back as `0/1`, timestamps as unix seconds, JSON as strings, and aggregates may be strings. Convert them before returning (`liked: r.liked === 1`, `Number(n)`). Only the table-bound builder (`db.select().from(t)`) converts by column mode.

## db cheat sheet (all async, always `await`)

```js
await db.select().from(t).where(eq(t.id, 1)).get()          // row | null
await db.select().from(t).where(and(…)).orderBy(desc(t.x)).limit(10).offset(20).all()
await db.$count(t, where?)
await db.insert(t).values({…}).onConflictDoUpdate({ target: t.key, set: {…} }).run()
await db.update(t).set({…}).where(…).run()                  // .returning() → rows
await db.delete(t).where(…).run()
await db.all(sql`…`)  /  db.get(sql`…`)  /  db.run(sql`…`)  /  db.values(sql`…`)
```

Operators come from `sdk/db`: `eq ne gt gte lt lte like notLike isNull isNotNull and or not between inArray count sum avg min max asc desc`. No foreign keys. A batch insert is one statement, limited by SQLite's variable count (chunk at about 50 rows). No transactions API is documented. Full reference: the project's `docs/tgcloud-sdk.md`.

## Other SDK pieces inside endpoints

- `api.<method>({ snake_case })`: the whole Bot API, with results unwrapped. It throws `BotApiError` (`code`, `description`, `method`, `parameters.retry_after`). A 403 from `sendMessage` means the user never started or has blocked the bot, so map it to an `EndpointError`.
- `fetch`: like web fetch; responses capped at 30 MB.
- `InputFile(bytes, name, { type })`: uploads up to 50 MB (photo 10 MB). `api.getFileContent` / `getFileStream` up to 20 MB.
- `console.log/error` lines are tagged `[file:line]`. They're visible in `tgcloud run` output (where deployed logs are visible isn't documented).
- No npm packages, filesystem or env vars at runtime. Secrets go in a DB table (e.g. `settings`).

## Test before deploying

```
npx tgcloud run endpoints/adminLikes '{ page: 2, size: 5, filter: "disliked" }' --ctx '{ initData: { user: { id: 199419831 } } }'
npx tgcloud run endpoints/adminSummary '{}' --ctx '{ initData: { user: { id: 5 } } }'   # expect FORBIDDEN
```

`run` executes your **local** files in the cloud against the real DB and Bot API, printing the return value, console output and timing. `--ctx` is **not verified**, so it tests logic, not the platform's 401 check. The input must be an object (JSON5 allowed). On Windows, an `Assertion failed … async.c` line after the output is a Node exit bug, not your code.

## Undocumented (don't promise anything)

Timeouts and CPU limits, request size limits, rate limits, CORS (same-origin only in practice), `auth_date` expiry, status codes other than 400/401/500, and where production logs appear.

## Checklist for a new endpoint

1. Put the logic in `tgcloud/lib/<feature>.js`, and keep a thin `tgcloud/endpoints/<name>.js`.
2. Authorize from `ctx.initData.user.id` (`requireAdmin` for admin tools).
3. Validate and clamp `input`. Refuse with `EndpointError(msg, { code })`.
4. Convert raw SQL values. Return plain JSON.
5. Test with `npx tgcloud run`: the happy path, a bad input, and a forbidden user.
6. Front-end: call it through `callEndpoint` / `useEndpoint` and handle `err.code`.
7. Ship it: `npm run update` (build + push + migrate), or push to `main` for CI.
