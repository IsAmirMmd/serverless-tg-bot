---
name: tgcloud-bot
description: Start, scaffold or grow a Telegram bot on Telegram Serverless (tgcloud) with a proven architecture — tgcloud/ layout (schema, lib per feature, thin handlers and endpoints), users tracking, admin commands with error reports, a /start menu, deep links, multi-step input, offline tests on a mock SDK, `npm run sql`, and auto-deploy + scheduled jobs on GitHub Actions; optionally a React Mini App in the Mirza design system. Use when the user wants to create, scaffold, start or set up a new Telegram serverless / tgcloud bot (or Mini App), asks to "use tgcloud-kit", or wants an existing tgcloud project brought to this structure.
argument-hint: "[admin telegram id] [what the bot should do]"
---

# tgcloud-bot (from tgcloud-kit)

The skill lives in this repo's reusable kit: **read `tgcloud-kit/skills/tgcloud-bot/SKILL.md`
and follow it.** Its relative links are relative to `tgcloud-kit/skills/tgcloud-bot/`, and
the skill-directory variable in it (`CLAUDE_SKILL_DIR`) stands for that folder.
Request: $ARGUMENTS

This bot (LikeTune) is the production code the kit was extracted from (`tgcloud/`,
`src/`). It predates two template names: the users table is `bot_users`, and
admin access is `requireOwner`/`isOwner` in `tgcloud/lib/access.js`. Follow this
repo's existing code where it differs from the template.
