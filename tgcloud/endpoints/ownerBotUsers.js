// POST /api/ownerBotUsers { page, size, q } — everyone who started the bot, with totals. Owner only.
import { requireOwner } from '../lib/access.js';
import { listBotUsers } from '../lib/botUsers.js';

export default async function (input, ctx) {
  requireOwner(ctx);
  return listBotUsers(input);
}
