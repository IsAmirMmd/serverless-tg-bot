---
name: tgcloud-bot
description: Build a Telegram bot on Telegram Serverless (tgcloud) with a fixed project layout (tgcloud/schema.js, lib/, handlers/, endpoints/), an admin-only `npm run sql` command to query the bot's database from the terminal, and auto-deploy from main via GitHub Actions. Use when the user wants to create, scaffold or start a new Telegram serverless / tgcloud bot, or add database querying (`npm run sql`) or the standard layout to an existing tgcloud project.
---

# tgcloud bot

Scaffolds and grows a Telegram Serverless bot in this layout:

```
<project>/
├─ tgcloud/                 ← the only deployed code
│  ├─ schema.js             ← DB tables as named exports (starts with `settings`)
│  ├─ handlers/             ← one file per Telegram update type (message.js, callback_query.js, channel_post.js …)
│  ├─ endpoints/sql.js      ← admin-only raw SQL, used by `npm run sql`
│  └─ lib/                  ← shared code: config.js (ADMIN_ID), settings.js, feature modules
├─ scripts/sql.mjs          ← `npm run sql -- "<query>"`
├─ .github/workflows/deploy.yml  ← push to main → fetch, push, migrate --safe
├─ AGENTS.md, docs/tgcloud-sdk.md ← platform rules + SDK reference (from `tgcloud init`)
├─ tgcloud.jsonc, package.json, .gitignore
└─ .tgcloud/                ← CLI state + token, gitignored — never read or edit
```

## Step 1: Gather inputs

Ask for (only what is missing):
- **Project folder** (new, or an existing tgcloud project).
- **Admin Telegram user id** — a number; they can get it from @userinfobot. It gates admin commands and `npm run sql`.
- **What the bot should do** — the features to build after scaffolding.

## Step 2: Scaffold

In a **new** folder (skip `init` if `tgcloud/` already exists):

```
npx -y @tgcloud/cli@0.2.0 init
node "<this skill's dir>/scripts/scaffold.mjs" . <ADMIN_ID>
npm install
```

`init` writes AGENTS.md, docs/tgcloud-sdk.md, tgcloud.jsonc, .gitignore and the git repo. `scaffold.mjs` adds the template (config.js, settings.js, schema.js with a `settings` table, an admin-aware message handler, endpoints/sql.js, scripts/sql.mjs, deploy.yml) and the npm scripts. It never overwrites the user's own files.

## Step 3: Link to the bot (user does this)

`tgcloud login` is interactive, so ask the user to run it themselves (in Claude Code: `! npx tgcloud login`). The token comes from **BotFather → the bot → Serverless → CLI Access → Access token**. Then:

```
npx tgcloud push       # deploy modules
npx tgcloud migrate    # create the tables (interactive — user runs it, or `migrate --safe`)
npm run sql -- "SELECT * FROM settings"   # verify DB access
```

## Step 4: Build features

Before writing any module, **read the project's AGENTS.md** (module rules) and use docs/tgcloud-sdk.md for the db/api details. Then follow [references/patterns.md](references/patterns.md) — handlers, buttons, admin commands, tables, scheduled jobs.

The rules that break bots most often:
- Relative imports **with `.js`** (`'../lib/config.js'`); the SDK by name (`'sdk'`, `'sdk/db'`). No npm packages, filesystem or env vars at runtime.
- Handler file name = update type; default export gets the payload (`message`, `callback_query`…), full update in `ctx.update`.
- Every DB call is async — `await` it. No foreign keys. Drops only via `.deprecated()`.
- `push` never changes the DB; schema changes need `migrate`.
- Logs are only visible via `npx tgcloud run`; report errors to the admin with `api.sendMessage`.

Test a handler without deploying:
`npx tgcloud run handlers/message '{ text: "/ping", from: { id: <ADMIN_ID> }, chat: { id: <ADMIN_ID> } }'`

## Step 5: Database from the terminal

```
npm run sql -- "SELECT * FROM <table>"
npm run sql -- "SELECT item_id, SUM(liked) FROM votes GROUP BY item_id"
```

Double quotes around the query, single quotes for values inside. Writes (UPDATE/DELETE/DROP) also run with no undo — tell the user to SELECT with the same WHERE first. Runs the local endpoints/sql.js in the cloud, so it works before deploying; once deployed it accepts only ADMIN_ID's verified Mini App init data.

For a Mini App front-end or new endpoints the Mini App calls, use the `tgcloud-mini-app` skill.

## Step 6: Auto-deploy (optional)

Push to GitHub and add the repo secret **TGCLOUD_TOKEN** (same token as login). Every push to `main` touching `tgcloud/` then deploys and applies safe migrations. Without the secret the workflow is a no-op.
