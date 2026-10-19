// handlers/chat_member.js — someone joined or left a channel the bot serves.
// Recorded with where the join came from (invite link, folder, or directly),
// for the panel's growth tab and the weekly report. Needs the bot to be an admin
// of the channel; the platform asks Telegram for these updates because this
// file exists.

import { getChannel, isLive } from '../lib/channels.js';
import { recordMemberUpdate } from '../lib/growth.js';

export default async function (update, ctx) {
  if (update.chat?.type !== 'channel') return;
  if (!isLive(await getChannel(update.chat.id))) return;
  await recordMemberUpdate(update);
}
