---
name: tgcloud-growth
description: Production building blocks for tgcloud (Telegram Serverless) bots, each with schema, lib code and the lessons learned — multi-tenant bots serving many channels/groups (registration via my_chat_member, activation, managers/viewers, one-time invite links, per-caller access scope), Telegram Stars payments and subscriptions (invoices, pre_checkout_query, successful_payment, credits, refunds, renewal reminders, gift codes), attribution (deep-link payloads, per-campaign channel invite links, chat_member join/leave tracking with source and retention, referral links, share links), segmented broadcasts in batches with opt-out, and scheduled reports (weekly digest with a one-tap publish, engagement and real-vs-fake vote analytics). Use when a tgcloud bot needs any of these, or when the user asks for marketing, growth, monetization, subscriptions, payments, analytics, campaigns, referrals or broadcasts in a Telegram bot.
---

# tgcloud growth: production building blocks

These patterns come from a multi-channel bot in production. Each reference has:
- the tables;
- the lib functions;
- the handler and endpoint wiring;
- the traps that already cost a bug.

They assume the tgcloud-bot layout and conventions (`docs/ARCHITECTURE.md`):
- `lib/users.js`
- `lib/access.js`
- `lib/query.js`
- `adminCommand()`
- callback prefixes
- `askFor`/`takePending`
- the mock-SDK tests

Pick what the bot needs:

| Need | Read | Adds |
|---|---|---|
| One bot serving many channels or groups, each with its own managers and stats | [references/multi-tenant.md](references/multi-tenant.md) | `channels`, `channel_members`, `invites` · `handlers/my_chat_member.js` · `channelScope()` |
| Selling access with Telegram Stars | [references/payments.md](references/payments.md) | `payments`, `gift_codes` · `handlers/pre_checkout_query.js` · invoices, credits, refunds, a renewal cron |
| Knowing where users and members come from | [references/attribution.md](references/attribution.md) | `invite_links`, `member_events` · `handlers/chat_member.js` · deep-link payloads, referral links |
| Messaging a segment of users | [references/broadcasts.md](references/broadcasts.md) | `broadcasts` · batched sending with a cursor, 429 pause, blocked marking, `/stop` |
| Weekly numbers and ready-to-post content | [references/reports.md](references/reports.md) | a digest cron, a draft plus publish button, engagement and real-vs-fake vote analytics |

## Order of work

1. **Schema first.**
   - New tables go in `schema.js`.
   - New columns on existing tables are nullable or have a default.
   - Chat ids of channels and groups are stored as TEXT.
2. **The lib module.**
   - Pure functions over `db` and `api`.
   - It never imports handlers or endpoints.
   - It exports `handleXCallback(query)` when it has buttons.
3. **Wiring.**
   - Handlers for the new update types (`my_chat_member`, `chat_member`,
     `pre_checkout_query`). A file in `handlers/` is what makes Telegram send
     that type.
   - A route in `message.js` / `callback_query.js`.
   - Thin endpoints.
   - A job in `scheduled.yml` for anything periodic.
4. **Tests.**
   - Build the updates with the helpers.
   - `failNext` for 403/429.
   - `mockApi` for `getChatMemberCount`, `createChatInviteLink`, etc.
5. **Deploy.**
   - CI runs `migrate --safe` and `webhook sync`.
   - Check the webhook's allowed updates with `npx tgcloud webhook`.

## Telegram prerequisites (tell the user)

- **The bot must be an admin of each channel/group** to receive its posts and
  `chat_member` updates.
- **Invite links need the "Add subscribers" (invite users) right.**
  `createChatInviteLink` fails without it. Catch the `BotApiError` and explain
  it in the UI.
- **Stars payments need no provider token** (`currency: 'XTR'`,
  `provider_token: ''`). Telegram expects a `/paysupport` command for payment
  questions.
- Commands appear in the `/` list only after `setMyCommands`. Send
  `/setcommands` after adding any.
