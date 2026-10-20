---
name: tgcloud-growth
description: Production building blocks for tgcloud (Telegram Serverless) bots, each with schema, lib code and the lessons learned — multi-tenant bots serving many channels/groups (registration via my_chat_member, activation, managers/viewers, one-time invite links, per-caller access scope), Telegram Stars payments and subscriptions (invoices, pre_checkout_query, successful_payment, credits, refunds, renewal reminders, gift codes), attribution (deep-link payloads, per-campaign channel invite links, chat_member join/leave tracking with source and retention, referral links, share links), segmented broadcasts in batches with opt-out, and scheduled reports (weekly digest with a one-tap publish, engagement and real-vs-fake vote analytics). Use when a tgcloud bot needs any of these, or when the user asks for marketing, growth, monetization, subscriptions, payments, analytics, campaigns, referrals or broadcasts in a Telegram bot.
---

# tgcloud-growth (from tgcloud-kit)

The skill lives in this repo's reusable kit: **read `tgcloud-kit/skills/tgcloud-growth/SKILL.md`
and follow it.** Its relative links are relative to `tgcloud-kit/skills/tgcloud-growth/`, and
the skill-directory variable in it (`CLAUDE_SKILL_DIR`) stands for that folder.
Request: $ARGUMENTS

This bot (LikeTune) is the production code the kit was extracted from (`tgcloud/`,
`src/`). It predates two template names: the users table is `bot_users`, and
admin access is `requireOwner`/`isOwner` in `tgcloud/lib/access.js`. Follow this
repo's existing code where it differs from the template.
