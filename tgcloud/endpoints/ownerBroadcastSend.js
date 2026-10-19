// POST /api/ownerBroadcastSend { segment, text } to start, then { id } until
// status is 'done' — each call sends one batch and returns the broadcast row
// ({ id, total, sent, failed, status }). Owner only.
import { requireOwner, callerId } from '../lib/access.js';
import { parseSegment, createBroadcast, sendBatch } from '../lib/broadcast.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  const id = Number.isSafeInteger(Number(input.id)) && Number(input.id) > 0
    ? Number(input.id)
    : await createBroadcast(callerId(ctx), await parseSegment(input.segment), input.text);
  return sendBatch(id);
}
