---
name: tgcloud-mini-app
description: Build, add or update a Telegram Mini App hosted on Telegram Serverless (tgcloud) — the front-end build served at app<id>.tgcloud.ai, its server side as tgcloud/endpoints/<name>.js (POST /api/<name>), calls via Telegram.WebApp.Serverless.call, the tgcloud.jsonc "static" config (source, spa, immutable, headers, redirects), and build + deploy. Use whenever the user wants to create, implement, change, debug or deploy a serverless Mini App, web app or endpoint for a tgcloud bot.
---

# tgcloud-mini-app (from tgcloud-kit)

The skill lives in this repo's reusable kit: **read `tgcloud-kit/skills/tgcloud-mini-app/SKILL.md`
and follow it.** Its relative links are relative to `tgcloud-kit/skills/tgcloud-mini-app/`, and
the skill-directory variable in it (`CLAUDE_SKILL_DIR`) stands for that folder.
Request: $ARGUMENTS

This bot (LikeTune) is the production code the kit was extracted from (`tgcloud/`,
`src/`). It predates two template names: the users table is `bot_users`, and
admin access is `requireOwner`/`isOwner` in `tgcloud/lib/access.js`. Follow this
repo's existing code where it differs from the template.
