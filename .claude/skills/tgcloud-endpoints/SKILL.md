---
name: tgcloud-endpoints
description: Complete reference for writing Telegram Serverless (tgcloud) endpoints — tgcloud/endpoints/<name>.js answering POST /api/<name> for a Mini App — signature (input, ctx), verified ctx.initData, EndpointError, client errors, Serverless.call, admin-only access, pagination/search/filter patterns with the db SDK, testing with `tgcloud run`, deploy. Use whenever creating, changing, debugging or reviewing an endpoint or the Mini App's server side, so the official docs (core.telegram.org/bots/serverless#endpoints) don't need to be re-read.
---

# tgcloud-endpoints (from tgcloud-kit)

The skill lives in this repo's reusable kit: **read `tgcloud-kit/skills/tgcloud-endpoints/SKILL.md`
and follow it.** Its relative links are relative to `tgcloud-kit/skills/tgcloud-endpoints/`, and
the skill-directory variable in it (`CLAUDE_SKILL_DIR`) stands for that folder.
Request: $ARGUMENTS

This bot (LikeTune) is the production code the kit was extracted from (`tgcloud/`,
`src/`). It predates two template names: the users table is `bot_users`, and
admin access is `requireOwner`/`isOwner` in `tgcloud/lib/access.js`. Follow this
repo's existing code where it differs from the template.
