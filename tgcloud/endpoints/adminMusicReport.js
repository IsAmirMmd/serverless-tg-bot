// POST /api/adminMusicReport { channelId, page, size, q } — votes grouped by (channel, music), paginated.
import { channelScope } from '../lib/access.js';
import { musicReport } from '../lib/dashboard.js';

export default async function (input, ctx) {
  return musicReport(await channelScope(ctx, input.channelId), input);
}
