// Who may call which panel endpoint. The caller is always ctx.initData.user
// (verified by the platform) — never an id from the input.

import { EndpointError } from 'sdk';
import { ADMIN_ID } from './config.js';
import { memberChannelIds } from './channels.js';

export const callerId = (ctx) => ctx.initData?.user?.id;
export const isOwner = (ctx) => callerId(ctx) === ADMIN_ID;

const forbidden = (msg = 'دسترسی ندارید') => new EndpointError(msg, { code: 'FORBIDDEN' });

export function requireOwner(ctx) {
  if (!isOwner(ctx)) throw forbidden('این بخش فقط برای مالک ربات است');
}

// The channels a stats query may read: null = every channel (owner asking for
// 'all'), otherwise a list of chat ids. Throws FORBIDDEN for anything else.
export async function channelScope(ctx, channelId) {
  const requested = channelId == null || channelId === '' || channelId === 'all' ? 'all' : String(channelId);
  if (isOwner(ctx)) return requested === 'all' ? null : [requested];

  const allowed = await memberChannelIds(callerId(ctx));
  if (!allowed.length) throw forbidden('دسترسی به هیچ کانالی برای شما فعال نشده است');
  if (requested === 'all') return allowed;
  if (!allowed.includes(requested)) throw forbidden();
  return [requested];
}
