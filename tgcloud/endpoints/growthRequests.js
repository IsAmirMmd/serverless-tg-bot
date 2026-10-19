// POST /api/growthRequests { channelId, page, size } — songs listeners asked for, most asked first.
import { readableChannel } from '../lib/access.js';
import { requestReport } from '../lib/growth.js';

export default async function (input, ctx) {
  return requestReport(await readableChannel(ctx, input.channelId), input);
}
