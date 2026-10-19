// POST /api/growthPosts { channelId, page, size, sort, dir } — per post: real
// ❤️ / 🥀, team and fake votes, members when posted, and engagement.
import { readableChannel } from '../lib/access.js';
import { postReport } from '../lib/growth.js';

export default async function (input, ctx) {
  return postReport(await readableChannel(ctx, input.channelId), input);
}
