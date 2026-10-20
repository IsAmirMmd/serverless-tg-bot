# Reports and analytics

## Scheduled digest (weekly report)

1. An admin command (`/weekly`) builds the report.
2. A `scheduled.yml` job runs it on cron. Example: Saturday 09:00 Tehran is
   `'30 5 * * 6'` in UTC.
3. The same command works by hand. `/setcommands` lists it for the admin.

For each live tenant (channel), `weeklyDigest(channel)` returns
`{ text, draft, line }`:
- `text`: the managers' report, as HTML. It covers members and their change,
  joins and leaves by source, real votes against last week (`▲ 25٪`),
  engagement, best posting hour, top items, top referrers, and requests.
- `draft`: ready-to-post content, such as "top songs of the week". It is
  `null` when there's nothing to post.
- `line`: one summary line for the owner.

`weeklyReports()`:
1. goes through every live channel;
2. sends `text` to the channel's contacts (managers plus `added_by`), or to
   the owner when it has none;
3. stores `draft` in `settings` under `weekly_draft:<chat id>`;
4. sends a preview of the draft with publish buttons;
5. finally sends the owner one message holding every `line`.

### One-tap publish, exactly once

The preview carries two buttons:
- `{ text: '✅ انتشار در کانال', callback_data: `wk:pub:${shortId}` }`
- `{ text: '❌ نه', callback_data: `wk:no:${shortId}` }`

`handleWeeklyCallback(query)`:
1. checks `isManager(query.from.id, channel)`, and that the channel is live;
2. reads the draft from settings;
3. **deletes the key before sending**. Two managers, or a double tap, can't
   post twice. If sending fails, the key is restored;
4. sends the draft to the channel and removes the buttons.

A missing key means "already published or replaced". Answer with an alert.

### Comparisons

Compute this week against last week with the same query over
`[from - 7d, from)`. `faChange(cur, prev)` returns `''` when there's nothing to
compare. Persian digits and `٪` come from `html.js`.

## Engagement that means something

Raw vote counts mislead in three ways:
- **The owner's own team** votes.
- **Test or "fake" votes** may be injected. Mark them with negative user ids,
  so they're easy to exclude.
- **Bigger channels** get more votes anyway.

So classify every vote in SQL, and normalize by audience:

```js
// lib/voteClass.js — fragments over a votes alias (default `l`); a separate module avoids an import cycle.
const col = (a, name) => sql.raw(`${a}.${name}`);
export const isFake = (a = 'l') => sql`${col(a, 'user_id')} < 0`;
export const isTeam = (a = 'l') => sql`(${col(a, 'user_id')} = ${ADMIN_ID}
  OR ${col(a, 'user_id')} IN (SELECT m.user_id FROM channel_members m WHERE m.channel_id = ${col(a, 'channel_id')})
  OR ${col(a, 'user_id')} = coalesce((SELECT c.added_by FROM channels c WHERE c.chat_id = ${col(a, 'channel_id')}), 0))`;
export const isReal = (a = 'l') => sql`(${col(a, 'user_id')} > 0 AND NOT ${isTeam(a)})`;

// Quality split for the panel
SELECT coalesce(sum(${isReal()}), 0) AS real_votes, coalesce(sum(${isTeam()} AND l.user_id > 0), 0) AS team_votes,
       coalesce(sum(${isFake()}), 0) AS fake_votes, count(DISTINCT CASE WHEN ${isReal()} THEN l.user_id END) AS real_users
FROM likes l WHERE l.channel_id = ${cid}
```

- **Members at posting time.** When the bot publishes something, store a
  `posts` row with `getChatMemberCount` at that moment. Per-post engagement
  is then `real voters / members`. This is comparable across channels and
  over time.
- **Best hour.** Group posts by local posting hour (fixed UTC offset), take
  the average real voters, and keep only hours with at least 2 posts.
  Without that minimum, one lucky post wins.
- **Recommendations without ML.** "People who liked what you liked also
  liked…": co-likes **within the same channel**, excluding what the user
  already voted on, ordered by the count of co-likers.

## Showing it (Mini App)

- **One endpoint per card**, each a thin wrapper over `lib/growth.js`:
  - `growthOverview` returns the tiles, plus `canManage` so the UI hides
    actions;
  - `growthSources` takes `{ days }`;
  - `growthPosts` is paginated and sortable through `orderBy()` whitelists.
- **Every read** goes through `readableChannel(ctx, channelId)`. **Every
  change** goes through `managedChannel`.
- **Mirza UI**:
  - stat tiles for the headline numbers;
  - a stacked bar for real/team/fake;
  - a card-table for posts and sources;
  - `<bdi>` around usernames;
  - Persian list numbering (`list-style-type: persian`).

## Tests

- A digest for a channel with no activity → `draft: null` and a calm text.
- Publish twice → one `sendMessage` to the channel.
- A viewer pressing publish → refused.
- The team's and fake votes are excluded from "real".
- Best hour ignores hours with a single post.
