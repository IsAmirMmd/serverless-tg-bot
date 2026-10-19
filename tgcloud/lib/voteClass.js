// Votes split three ways, as SQL on a likes alias (default `l`):
//   real  the audience
//   team  the owner, the channel's panel members and whoever added the bot
//   fake  made-up voters from the fake-votes tool (negative user ids)
// Kept apart from growth.js so dashboard.js can use it without an import cycle.

import { sql } from 'sdk/db';
import { ADMIN_ID } from './config.js';

const col = (alias, name) => sql.raw(`${alias}.${name}`);

export const isFake = (a = 'l') => sql`${col(a, 'user_id')} < 0`;
export const isTeam = (a = 'l') => sql`(${col(a, 'user_id')} = ${ADMIN_ID}
  OR ${col(a, 'user_id')} IN (SELECT m.user_id FROM channel_members m WHERE m.channel_id = ${col(a, 'channel_id')})
  OR ${col(a, 'user_id')} = coalesce((SELECT c.added_by FROM channels c WHERE c.chat_id = ${col(a, 'channel_id')}), 0))`;
export const isReal = (a = 'l') => sql`(${col(a, 'user_id')} > 0 AND NOT ${isTeam(a)})`;

// "Title - Performer" from the post the bot published (clean tags), else the
// name saved with the votes (the audio file's own tags). For GROUP BY queries
// grouped by the alias's channel_id and music_id.
export const songName = (a = 'l') => sql`coalesce(
  (SELECT p.title || coalesce(' - ' || p.performer, '') FROM posts p
    WHERE p.channel_id = ${col(a, 'channel_id')} AND p.music_id = ${col(a, 'music_id')}),
  nullif(max(${col(a, 'music_name')}), ''))`;
