// Who may call which panel endpoint. The caller is always ctx.initData.user
// (verified by the platform) — never an id from the input.

import { EndpointError } from 'sdk';
import { ADMIN_ID } from './config.js';
import { memberChannelIds, getChannel, isManager } from './channels.js';

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

// One channel the caller may read (owner, manager or viewer) — for the growth
// tab, which works on a single channel. 'all' is refused with NEED_CHANNEL.
export async function readableChannel(ctx, channelId) {
  if (channelId == null || channelId === '' || channelId === 'all') {
    throw new EndpointError('یک کانال را انتخاب کنید', { code: 'NEED_CHANNEL' });
  }
  const [id] = await channelScope(ctx, channelId);
  const channel = await getChannel(id);
  if (!channel) throw new EndpointError('کانال پیدا نشد', { code: 'NOT_FOUND' });
  return channel;
}

// The same, for changes: the owner or one of the channel's managers (viewers only read).
export async function managedChannel(ctx, channelId) {
  const channel = await readableChannel(ctx, channelId);
  if (!(await isManager(callerId(ctx), channel))) throw forbidden('این کار فقط از مدیر کانال برمی‌آید');
  return channel;
}
