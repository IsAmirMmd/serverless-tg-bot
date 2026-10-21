# Telegram Music Channel Bot

A Telegram bot for music channels that runs entirely on
**[Telegram Serverless](https://core.telegram.org/bots/serverless)**. There's no server to
host, the webhook is set up for you, and a built-in SQLite database stores everything.
It comes with a **React Mini App** panel for stats and reports, and you can sell it
to other channel owners with **Telegram Stars** subscriptions.

## Features

- **Clean reposts:** when a track is posted to a channel, the bot reposts it with a
  tidy title and performer (links, @usernames, site names and tags like
  `(Official Audio)` or `320kbps` are stripped), a short caption, and
  **❤️ / 🥀 vote buttons**. The original post is removed. Cleanup is rule-based by
  default, and an optional LLM mode (OpenRouter) is available. A track forwarded
  from a known music bot (e.g. @SoundCoudMusicBot; the list is `SOURCE_BOTS` in
  `tgcloud/lib/config.js`) gets a last caption line «ساندگیر • Sound Cloud»: the
  name (set per bot) links to the bot, "Sound Cloud" to the original song (taken
  from the forwarded message's links).
- **Live vote counts:** every vote is stored and the counts on the buttons update
  instantly. Each user gets one vote per post.
- **Mini App panel:** opens fullscreen inside Telegram and follows its light/dark
  theme, in a Persian right-to-left design. It shows:
  - stat tiles
  - paginated, searchable tables of votes, per-user reports and per-track reports
  - track ids that link straight to the channel post
- **Multi-channel:** any channel owner can add the bot to their channel. Each owner
  sees only their own channel's stats. New channels wait for approval unless their
  owner has paid.
- **Team access:** one-time invite links give someone panel access to a channel,
  either as a manager or as a viewer.
- **Subscriptions with Telegram Stars:**
  - monthly and quarterly plans
  - renewal from the panel
  - reminders before a subscription ends
  - automatic pause when it does
  - refunds
  - free gift time, given directly or through one-time gift links
- **Bot members:** everyone who starts the bot or votes is recorded and listed in
  the panel.
- **Growth & marketing** (per channel, in the panel's «رشد و بازاریابی» tab):
  - **real vs team vs fake votes:** stats count the audience only; the owner, the
    channel's managers and whoever added the bot are "team", made-up voters are "fake"
  - **where members come from:** every join and leave is recorded (`chat_member`),
    with its source: a named campaign invite link, a listener's personal link,
    the bot, a folder, or directly. Each source shows how many stayed after 7 days
  - **per-post engagement:** the member count at posting time, real ❤️ / 🥀, and
    the share of members who voted; the best hour to post
  - **weekly report** every Saturday to each channel's managers, with a ready
    "top songs of the week" post they publish with one button
  - **polls** in the channel and **song requests** from listeners
- **Listener features in the bot:** a second row under each post — **🎧 my songs**
  (their liked songs plus "you might also like", from what similar listeners liked,
  always within that channel) and **📤 send to a friend** (opens the song in the
  bot with a join button). Listeners get a **personal invite link** with a
  leaderboard, and can **request a song**. Managers can turn the row off.
- **Messages to users** (owner): to a segment of people who started the bot (by
  channel, activity, or an artist they liked), sent in batches, with `/stop` to opt out.
- **Friendly start menu:** colored buttons for support, a how-to guide and pricing.

## How it works

```
Telegram ──updates──▶ tgcloud/handlers/*      (bot logic, runs on Telegram's servers)
Mini App ──POST /api/<name>──▶ tgcloud/endpoints/*   (panel's server side)
                  both use ▶ tgcloud/lib/* + built-in SQLite (tgcloud/schema.js)
```

The Mini App's front-end (`index.html` + `src/`) is built with Vite and served
next to the bot at `https://app<app_id>.tgcloud.ai/`. Endpoints get the caller's
Telegram identity, verified by the platform. Every endpoint checks it against the
owner and the channel memberships before returning data.

## Project structure

```
├─ tgcloud/                  ← the code Telegram runs (the only deployed code)
│  ├─ schema.js              ← database tables
│  ├─ handlers/              ← one file per Telegram update type
│  │  ├─ channel_post.js     ← new channel post: clean up, repost with buttons
│  │  ├─ callback_query.js   ← vote buttons and menu buttons
│  │  ├─ message.js          ← /start menu, invite and gift links, payments
│  │  ├─ my_chat_member.js   ← bot added to or removed from a channel
│  │  ├─ chat_member.js      ← someone joined or left a channel (growth stats)
│  │  └─ pre_checkout_query.js ← final check before a Stars payment
│  ├─ endpoints/             ← the Mini App's API (POST /api/<name>)
│  └─ lib/                   ← shared logic: likes, channels, billing, access, menu,
│                               growth (stats, invite links), listener (bot DM),
│                               weekly (report), broadcast, voteClass …
├─ index.html, src/          ← the Mini App (React + Vite), built into dist/
├─ scripts/sql.mjs           ← run SQL against the bot's database from the terminal
├─ .github/workflows/        ← deploy on push, scheduled backup and billing check
├─ docs/                     ← SDK reference and design notes (not deployed)
├─ AGENTS.md                 ← platform rules, for humans and AI assistants
├─ tgcloud.jsonc             ← project config (Mini App build folder)
├─ tgcloud-kit/              ← the reusable kit: skills, architecture, scaffold (not deployed)
└─ .claude-plugin/           ← makes this repo a Claude Code plugin marketplace
```

## Getting started

Requirements: Node.js 20.19+ or 22.12+ and a Telegram bot.

1. **Enable Serverless** for your bot. In [@BotFather](https://t.me/BotFather),
   open the bot, go to **Serverless** and turn it on. Then copy the CLI token from
   **CLI Access → Access token**. It looks like `app<id>:<secret>` and isn't the
   regular bot token.
2. **Configure** `tgcloud/lib/config.js`:
   - your Telegram user id as `ADMIN_ID`
   - your contact username
   - the Mini App URL
   - subscription plans and prices
   - whether paid channels activate automatically

   The same `ADMIN_ID` also appears in `.github/workflows/backup.yml` and
   `billing.yml`.
3. **Install, link, and deploy:**
   ```sh
   npm install
   npx tgcloud login     # paste the CLI token
   npm run update        # build the Mini App, deploy, and apply database changes
   ```
4. **Add the bot as an admin** of your channel, with permission to post, edit and
   delete messages. Also give it **"Add subscribers" (invite users via link)** for
   join tracking, campaign links and listeners' invite links.
5. In the bot, send `/setcommands` once so `/weekly` shows up in your command list.

The webhook is managed by the platform based on the files in `tgcloud/handlers/`,
and it's refreshed on every deploy. `npx tgcloud webhook` shows its status.

## Development

| Command | What it does |
|---|---|
| `npm run dev` | run the Mini App locally (endpoint calls only work inside Telegram) |
| `npm run build` | build the Mini App into `dist/` |
| `npm run update` | build, deploy code and Mini App, apply schema changes |
| `npm run sql -- "SELECT …"` | query the bot's database from the terminal |
| `npx tgcloud status` | what changed locally compared to the cloud |
| `npx tgcloud run endpoints/<name> '{}' --ctx '{ initData: { user: { id: 1 } } }'` | run an endpoint in the cloud without deploying |

**Database changes:** edit `tgcloud/schema.js`, then run `npm run update`. A
deploy never changes the database on its own; the migrate step applies the change.
Columns and tables are dropped only when they're marked `.deprecated('reason')`.

**Runtime rules:** code under `tgcloud/` runs in an isolated V8 environment. It
can't use npm packages, the filesystem or environment variables. Import project
files by relative path with the `.js` extension, and import the platform SDK as
`'sdk'` / `'sdk/db'`. The full reference is in [AGENTS.md](AGENTS.md) and
[docs/tgcloud-sdk.md](docs/tgcloud-sdk.md).

## Automation (GitHub Actions)

Add the CLI token as the repository secret **`TGCLOUD_TOKEN`**
(*Settings → Secrets and variables → Actions*). With it in place, these workflows run:

| Workflow | When | What |
|---|---|---|
| `deploy.yml` | every push to `main` that touches the bot or the Mini App | builds and deploys, applies safe schema changes |
| `backup.yml` | every 8 hours | sends a CSV backup of all tables to the owner |
| `billing.yml` | daily | renewal reminders and expiry notices |
| `weekly.yml` | Saturdays, 09:00 Tehran | weekly report and "top songs" draft to each channel's managers |

`main` is the source of truth. A deploy removes code that exists only in the cloud.
Schema changes that drop data are never applied automatically; run `npm run update`
for those.

## Reuse it: tgcloud-kit

Everything this bot was built with is packaged in [tgcloud-kit/](tgcloud-kit/):
- the skills;
- the architecture;
- a tested scaffold;
- the growth patterns.

It is packaged as a Claude Code plugin, so a new project starts from the same
structure. Install it once:

```
/plugin install tgcloud-kit --marketplace IsAmirMmd/serverless-tg-bot
```

(or `/plugin marketplace add IsAmirMmd/serverless-tg-bot` then `/plugin install tgcloud-kit@serverless-tg-bot`).
Then, in an empty folder: `/tgcloud-kit:tgcloud-bot <admin id> <what the bot does>`.
Details, in Persian and English: [tgcloud-kit/README.md](tgcloud-kit/README.md).

## Tech stack

Telegram Serverless (tgcloud) · Telegram Bot API · Telegram Mini Apps ·
Telegram Stars · SQLite · React 19 · Vite · GitHub Actions
