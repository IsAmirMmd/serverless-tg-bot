---
name: tgcloud-mini-app
description: Build, add or update a Telegram Mini App hosted on Telegram Serverless (tgcloud) — the front-end build served at app<id>.tgcloud.ai, its server side as tgcloud/endpoints/<name>.js (POST /api/<name>), calls via Telegram.WebApp.Serverless.call, the tgcloud.jsonc "static" config (source, spa, immutable, headers, redirects), and build + deploy. Use whenever the user wants to create, implement, change, debug or deploy a serverless Mini App, web app or endpoint for a tgcloud bot.
---

# tgcloud Mini App

A Mini App on Telegram Serverless is two halves deployed together by `npx tgcloud push`:

| Half | Lives in | Runs | Can use |
|---|---|---|---|
| Front-end | project root (Vite/React/Vue/…), build → `dist/` | the user's browser in Telegram | npm packages, `window.Telegram.WebApp` |
| Endpoints | `tgcloud/endpoints/<name>.js` | the platform's V8 isolate | `sdk` only: `db`, `api`, `fetch`, `EndpointError` |

The front-end never imports `tgcloud/` code. It talks to the server **only** through endpoints. Site URL: `https://app<app_id>.tgcloud.ai/` (`push` prints it). Endpoints answer `POST /api/<name>` on the same host.

Source: https://core.telegram.org/bots/serverless#mini-app-front-end. Re-check it with WebFetch if something here doesn't match the CLI's behavior.

## Step 1: Inspect the project

- Is there a `tgcloud/` folder? If not, set up the bot first (the `tgcloud-bot` skill, or `npm create @tgcloud/bot .`). Read the project's `AGENTS.md`, since it holds the module rules.
- Is there a front-end? Look at `package.json`, `vite.config.*` and `index.html`. If there's none, create one at the **project root**, next to `tgcloud/`, keeping the existing files.
- Check `tgcloud.jsonc` → `"static"`.

**The front-end is always React (Vite + `@vitejs/plugin-react`).** The user requires it, so never write a vanilla-JS UI. Style it with the `mirza-design-system` skill. Write endpoints with the `tgcloud-endpoints` skill.

Reference implementation in this repo: `index.html`, `vite.config.js`, `src/main.jsx`, `src/App.jsx`, `src/views.jsx`, `src/components/*`, `src/lib/*`, with the endpoints in `tgcloud/endpoints/admin*.js`.

## Step 2: Wire the front-end

0. React setup in an existing project: `npm i react react-dom` and `npm i -D vite @vitejs/plugin-react`. Then add `vite.config.js` with `plugins: [react()]`, `index.html` with `<div id="root">` and `<script type="module" src="/src/main.jsx">`, and the scripts `"dev": "vite"`, `"build": "vite build"`, `"update": "vite build && tgcloud push && tgcloud migrate --yes"`. Add `dist/` to `.gitignore`.
1. Add the Telegram script to `index.html` `<head>`, before the app bundle:
   `<script src="https://telegram.org/js/telegram-web-app.js"></script>`
2. Copy [assets/serverless.js](assets/serverless.js) to `src/lib/serverless.js` and [assets/useEndpoint.js](assets/useEndpoint.js) to `src/lib/useEndpoint.js`. The first turns `Serverless.call` into a promise (`await callEndpoint('getProfile', { lang: 'en' })`). The second is a React hook: `const { data, error, loading, reload } = useEndpoint('adminLikes', { page, size })`. It refetches when the input changes and drops stale responses.
3. On startup: `Telegram.WebApp.ready(); Telegram.WebApp.expand();`. Use `Telegram.WebApp.themeParams` / CSS vars (`var(--tg-theme-bg-color)`) so the app matches the Telegram theme.
3a. Fullscreen and close confirmation (this project's panels use both):
   ```js
   if (tg?.isVersionAtLeast?.('8.0') && !tg.isFullscreen) tg.requestFullscreen();   // fails → 'fullscreenFailed' event { error: 'UNSUPPORTED' | 'ALREADY_FULLSCREEN' }
   if (tg?.isVersionAtLeast?.('6.2')) tg.enableClosingConfirmation();               // "are you sure?" on close
   ```
   In fullscreen, Telegram's buttons overlay the page. Pad the top and bottom with `var(--tg-safe-area-inset-top, 0px) + var(--tg-content-safe-area-inset-top, 0px)` (and `-bottom`). `telegram-web-app.js` sets these variables, and they update on the `safeAreaChanged` / `contentSafeAreaChanged` events. Call `setHeaderColor` so the status bar stays readable. Also available: `exitFullscreen()`, `isFullscreen`, the `fullscreenChanged` event, and `disableClosingConfirmation()`. Docs: https://core.telegram.org/bots/webapps
4. `initDataUnsafe` is for display only (name, photo). Anything that needs trust goes through an endpoint, which receives **verified** init data.
5. Keep the bundler's `base` at `/`. Never put files under `/api/` in the build output. Don't set `X-Frame-Options` or a restrictive `frame-ancestors`, because Telegram Web loads the app in an iframe.

## Step 3: Configure static hosting (`tgcloud.jsonc`)

```jsonc
{
  "static": {
    "source": "dist",             // the build folder (Vite: dist). Next/Nuxt/SvelteKit/Angular: configure static export first
    "spa": true,                  // client-side routing: index.html for missing extension-less paths
    "immutable": ["/assets/*"],   // content-hashed files only → cached 1 year
    // "headers":   [{ "path": "/assets/*", "set": { "X-Foo": "bar" } }],   // exact path or prefix/*; null removes
    // "redirects": [{ "from": "/old", "to": "/new", "status": 301 }],       // first match wins; real files beat rules
  },
  "$schema": "./node_modules/@tgcloud/cli/schema/tgcloud.json"
}
```

`"static": "dist"` is shorthand for this. `"static": false` **deletes** the deployed site on the next push. Removing the key only stops managing it, and the deployed site stays. Use either `tgcloud.jsonc` or `tgcloud.json`, never both.

## Step 4: Write endpoints

Scaffold: `npx tgcloud add endpoints/<name>`. Names use letters, digits and `_`, don't start with a digit, and the folder is flat (no subfolders).

```js
// tgcloud/endpoints/getProfile.js
import { db, EndpointError } from 'sdk';
import { eq } from 'sdk/db';
import { profiles } from '../schema.js';

export default async function (input, ctx) {
  const user = ctx.initData.user;              // verified by the platform; there is no ctx.user
  const profile = await db.select().from(profiles).where(eq(profiles.userId, user.id)).get();
  if (!profile) throw new EndpointError('Profile not found', { code: 'NO_PROFILE' });
  return profile;                              // sent back as JSON
}
```

Rules:
- **Identify the caller only from `ctx.initData.user.id`.** Never trust a user id sent in `input`.
- Refusals use `throw new EndpointError(description, { code })` → HTTP 400, and the client gets `err.message` and `err.parameters.code`. Any other throw becomes a generic 500, and its message never reaches the client.
- Bad or missing init data → 401 before your code runs.
- Validate `input` (types, lengths). It's arbitrary JSON from the client.
- Admin-only endpoints compare `ctx.initData.user.id` with `ADMIN_ID` from `lib/config.js`.
- Shared logic goes in `tgcloud/lib/`, imported with relative paths that end in `.js`. The bot's handlers and the endpoints can share it.
- Every DB call is `await`ed. Schema changes go in `tgcloud/schema.js` and then `npx tgcloud migrate`.

More recipes (sending a message from the app, upserting the user, pagination, errors in the UI): [references/recipes.md](references/recipes.md).

## Step 5: Test

- Endpoint logic, without deploying (`--ctx` isn't verified, so this tests your logic only):
  `npx tgcloud run endpoints/getProfile '{}' --ctx '{ initData: { user: { id: 1, first_name: "Ann" } } }'`
- Front-end layout: `npm run dev` in a browser works, but `Telegram.WebApp.Serverless` only works inside Telegram. The wrapper in `assets/serverless.js` throws a clear error outside Telegram. For real calls, deploy and open the app in Telegram.

## Step 6: Build and deploy

`push` uploads the build folder **as it is on disk** and never builds. Always build first. In this repo, one command does everything:

```
npm run update     # vite build → tgcloud push → tgcloud migrate --yes
```

`migrate --yes` applies every safe and warning schema change without asking. Changes that need manual handling are never applied automatically. Use `npx tgcloud migrate --dry-run` first if you aren't sure.

- `npx tgcloud push`: modules + static files (only changed files are uploaded).
- `npx tgcloud push dist/`: static files only. `npx tgcloud push tgcloud/endpoints/x.js`: that module only (leaves the site untouched).
- If the project auto-deploys from GitHub Actions, add the front-end build step (`npm run build`) before `npx tgcloud push` in the workflow, and include the front-end paths in its `paths:` filter.

## Step 7: Open it in Telegram

Copy the URL that `push` printed (`https://app<app_id>.tgcloud.ai/`) and set it in **BotFather** as the bot's Mini App / menu button URL. The Mini App files are also visible under **Serverless** in BotFather. Inline/keyboard buttons can open it too: `{ text: 'Open', web_app: { url } }`.

## Limits

Upload 50 MB per file (10 MB photo). `api.getFileContent`/`getFileStream` 20 MB. `fetch` response 30 MB. A batch insert is one statement, limited by SQLite's variable count (rows × columns). No foreign keys.
