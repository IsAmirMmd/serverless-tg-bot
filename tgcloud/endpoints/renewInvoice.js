// POST /api/renewInvoice { channelId, plan } — a Stars invoice link to extend a
// channel's subscription; the Mini App opens it with Telegram.WebApp.openInvoice.
// Allowed for the owner and the channel's members. → { link }
import { EndpointError } from 'sdk';
import { channelScope } from '../lib/access.js';
import { getChannel } from '../lib/channels.js';
import { planInvoiceLink } from '../lib/billing.js';
import { PLANS } from '../lib/config.js';

export default async function ({ channelId, plan: planId } = {}, ctx) {
  if (!channelId || channelId === 'all') throw new EndpointError('کانال را انتخاب کنید', { code: 'BAD_INPUT' });
  await channelScope(ctx, channelId); // FORBIDDEN unless owner or member of this channel
  const plan = PLANS.find((p) => p.id === planId);
  if (!plan) throw new EndpointError('پلن نامعتبر است', { code: 'BAD_INPUT' });
  const channel = await getChannel(String(channelId));
  if (!channel) throw new EndpointError('کانال پیدا نشد', { code: 'NOT_FOUND' });
  return { link: await planInvoiceLink(plan, channel) };
}
