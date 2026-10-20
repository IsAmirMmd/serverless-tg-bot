---
name: tgcloud-bot
description: Start, scaffold or grow a Telegram bot on Telegram Serverless (tgcloud) with a proven architecture — tgcloud/ layout (schema, lib per feature, thin handlers and endpoints), users tracking, admin commands with error reports, a /start menu, deep links, multi-step input, offline tests on a mock SDK, `npm run sql`, and auto-deploy + scheduled jobs on GitHub Actions; optionally a React Mini App in the Mirza design system. Use when the user wants to create, scaffold, start or set up a new Telegram serverless / tgcloud bot (or Mini App), asks to "use tgcloud-kit", or wants an existing tgcloud project brought to this structure.
argument-hint: "[admin telegram id] [what the bot should do]"
---

# tgcloud bot: start here

This is the entry point of **tgcloud-kit**. It turns an empty folder into a
working Telegram Serverless bot with the architecture of a production bot, then
builds the requested features on it. The architecture and its conventions are
in [references/architecture.md](references/architecture.md). Read it before
writing feature code. The scaffold also copies it into the project as
`docs/ARCHITECTURE.md`.

Sibling skills in this kit:

| Skill | Use it for |
|---|---|
| **tgcloud-endpoints** | Writing Mini App endpoints: auth, errors, pagination |
| **tgcloud-mini-app** | The React front-end: wiring, deploy, Telegram UI |
| **mirza-design-system** | The UI look: Persian RTL, `.mz-*` classes |
| **tgcloud-growth** | Bigger blocks: multi-tenant channels, Stars payments, deep-link/invite attribution, join tracking, referrals, broadcasts, weekly digests |

## Step 1: Inputs

Take them from `$ARGUMENTS` or the conversation. Ask only for what is missing:
- **Admin Telegram user id**: a number. The user gets it from @userinfobot.
  It gates admin commands, `npm run sql` and the admin Mini App.
- **What the bot does**: the features. These decide whether it needs a
  **Mini App** (an admin panel, dashboards, forms → `--mini-app`) and which
  tgcloud-growth blocks apply.
- **Project folder**: default to the current directory when it's empty or
  already a tgcloud project.

## Step 2: Scaffold

In the project folder:

```
npx -y @tgcloud/cli@0.2.0 init                  # skip if tgcloud/ already exists; writes AGENTS.md, docs/tgcloud-sdk.md, tgcloud.jsonc, git repo
node "${CLAUDE_SKILL_DIR}/scripts/scaffold.mjs" . --admin <ADMIN_ID> [--mini-app] [--title "<panel title>"]
npm install
npm test                                          # 7 offline tests (10 with --mini-app) must pass before you change anything
```

`scaffold.mjs` overlays the template and never overwrites the user's files. It
only replaces the stock `init` versions of `schema.js` and
`handlers/message.js`. It adds:

- `tgcloud/`:
  - `schema.js`: `settings`, `users`
  - `lib/`: config, settings, users, access, admin, menu, query, html, time,
    files
  - `handlers/`: `message`, `callback_query`, `my_chat_member`
  - `endpoints/`: `me`, `sql`
- `test/` (a mock SDK on node:sqlite), `scripts/sql.mjs`
- `.github/workflows/`: `deploy.yml`, `scheduled.yml`
- `docs/ARCHITECTURE.md`, plus a pointer section in `AGENTS.md`
- npm scripts (`test`, `deploy`, `sql`, `migrate`, …)
- `.claude/settings.json`, which enables this kit for the project. Pass
  `--no-claude-settings` to skip it.

`--mini-app` adds:
- the React + Vite front-end, an admin panel with stats and a paginated,
  searchable users table;
- the Mirza CSS and fonts;
- `endpoints/adminStats.js`, `adminUsers.js` and their tests;
- `tgcloud.jsonc` → `"static": "dist"`.

## Step 3: Link to the bot (the user does this)

`tgcloud login` is interactive, so ask the user to run it. In Claude Code they
can type `! npx tgcloud login`. The token comes from **BotFather → the bot →
Serverless → CLI Access → Access token**. Never ask them to paste the token into
the chat. Then:

```
npm run deploy                        # push the code (builds the Mini App first if there is one)
npx tgcloud migrate                   # create the tables (interactive; or `npx tgcloud migrate --safe`)
npm run sql -- "SELECT * FROM users"  # check DB access
```

Then the admin sends `/start` and `/setcommands` to the bot. With a Mini App,
set the URL that `push` printed in BotFather (menu button / Mini App).

## Step 4: Build the features

Follow the architecture. Summary:

1. **Schema**: tables go in `tgcloud/schema.js`. New columns on existing tables
   are nullable or have a default. No foreign keys. Drop only with
   `.deprecated()`.
2. **Logic**: one `tgcloud/lib/<feature>.js` per feature, holding its queries,
   its Bot API calls, and its `handleXCallback(query)` that returns `true`
   when a button was its own.
3. **Entry points**: keep them thin.
   - Bot commands: a line in `adminCommand()` or in the public section of
     `handlers/message.js`.
   - Buttons: a `<feature>:` prefix in `handlers/callback_query.js`.
   - Deep links: `startPayload()`.
   - A question and its answer: `askFor()` / `takePending()`.
   - Mini App calls: `endpoints/<name>.js`. Use the tgcloud-endpoints skill.
4. **Tests**: `test/<feature>.test.mjs` with the helpers (`msg`, `press`,
   `ctxOf`, `take`, `failNext`, `row`). Run `npm test`. See the existing
   tests for the shape.
5. **Check in the cloud** when the Bot API's real behavior matters:
   `npx tgcloud run handlers/message '{ text: "/stats", from: { id: <ADMIN_ID> }, chat: { id: <ADMIN_ID>, type: "private" } }'`.

Code patterns (buttons, upserts, files, channel posts, secrets, scheduled jobs)
are in [references/patterns.md](references/patterns.md). Before building
channels/groups, payments, links, broadcasts or reports, load
**tgcloud-growth**.

Rules that break bots most often (AGENTS.md has the full list):
- Relative imports **with `.js`**. Import the SDK by name. No npm packages,
  filesystem or env vars at runtime.
- `await` every DB call.
- Raw SQL returns raw values (0/1, strings), so convert them.
- `push` never changes the DB. Schema changes need `migrate`.
- Logs are visible only through `tgcloud run`, so report failures to the
  admin. The template already does this for admin commands.
- User-facing copy is Persian by default (the template's). Change it if the
  bot targets another language.

## Step 5: Auto-deploy and scheduled jobs

1. Push the repo to GitHub.
2. Add the repository secret **TGCLOUD_TOKEN** (the same token as `login`).
3. From then on, every push to `main` that touches the bot or the front-end:
   1. builds;
   2. pushes;
   3. runs `migrate --safe` and `webhook sync`. Each of these is its own
      `always()` step; [architecture §9](references/architecture.md) explains
      why.

Without the secret, the workflows do nothing.

The platform has no scheduler. `scheduled.yml` runs an admin command on cron
(by default `/backup` every 8 hours). Add a job per periodic task: a report, a
billing check, a digest.

## Database from the terminal

```
npm run sql -- "SELECT * FROM users ORDER BY first_seen_at DESC LIMIT 5"
```

Put double quotes around the query and single quotes around values. Writes run
for real, with no undo, so SELECT with the same WHERE first. It runs the local
`endpoints/sql.js` in the cloud, which once deployed accepts only the admin.

## Existing projects

For a project with its own `tgcloud/schema.js`, the scaffold runs in
**existing-project mode** and leaves `tgcloud/` alone. It only adds:
- `.github/workflows/`, `scripts/sql.mjs`;
- the test harness (`test/sdk/`, `test/helpers.mjs`);
- `docs/ARCHITECTURE.md` and the `AGENTS.md` section;
- the npm scripts that are missing (existing ones are kept);
- `.claude/settings.json`.

With `--mini-app`:
- The front-end goes in only if there's no `index.html`.
- The admin endpoints go in only if `tgcloud/lib` came from this kit
  (`userStats`, `listUsers`).

After that:
1. Write `test/<feature>.test.mjs` for the project's existing handlers. The
   harness runs real production code unchanged.
2. Move logic toward the architecture one feature at a time.
3. Run `npm test` after each step.
