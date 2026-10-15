// POST /api/adminLikes { channelId, page, size, q, filter: 'all'|'liked'|'disliked' } — the votes, paginated.
import { channelScope } from '../lib/access.js';
import { listLikes } from '../lib/dashboard.js';

export default async function (input, ctx) {
  return listLikes(await channelScope(ctx, input.channelId), input);
}
