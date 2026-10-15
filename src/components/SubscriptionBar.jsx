// Subscription status of the selected channel, with renewal buttons that open
// a Telegram Stars invoice right inside the Mini App (Telegram.WebApp.openInvoice).
import { useState } from 'react';
import { callEndpoint } from '../lib/serverless.js';
import { fa, faDate } from '../lib/format.js';
import { tg, alertDialog } from '../lib/telegram.js';

const DAY = 86400;

// → { label, tone } for a channel's expires_at.
export function subscriptionState(channel, now = Math.floor(Date.now() / 1000)) {
  if (!channel) return null;
  if (channel.status !== 'active') {
    return { tone: 'neutral', label: channel.status === 'pending' ? 'در انتظار فعال‌سازی' : 'متوقف' };
  }
  if (channel.expires_at == null) return { tone: 'like', label: 'بدون محدودیت زمانی' };
  const left = channel.expires_at - now;
  if (left <= 0) return { tone: 'dislike', label: `منقضی شده (${faDate(channel.expires_at)})`, expired: true };
  const days = Math.ceil(left / DAY);
  return {
    tone: days <= 3 ? 'dislike' : 'like',
    label: `تا ${faDate(channel.expires_at)}، ${fa(days)} روز مانده`,
    soon: days <= 3,
  };
}

export default function SubscriptionBar({ channel, plans, onPaid }) {
  const [busy, setBusy] = useState(null);
  const state = subscriptionState(channel);
  if (!state) return null;

  const buy = async (plan) => {
    setBusy(plan.id);
    try {
      const { link } = await callEndpoint('renewInvoice', { channelId: channel.chat_id, plan: plan.id });
      if (tg?.openInvoice) {
        tg.openInvoice(link, (status) => {
          if (status === 'paid') {
            tg.HapticFeedback?.notificationOccurred('success');
            // The bot records the payment on its own update; give it a moment.
            setTimeout(onPaid, 1500);
          }
        });
      } else {
        window.open(link, '_blank', 'noopener');
      }
    } catch (e) {
      await alertDialog(e.type === 'ENDPOINT_ERROR' ? e.message : `خطا (${e.type ?? e.message})`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className={`mz-card subscription ${state.expired || state.soon ? 'subscription--warn' : ''}`}>
      <div className="mz-row subscription__head">
        <span className="mz-subtitle">⭐️ اشتراک «{channel.title ?? channel.chat_id}»</span>
        <span className={`mz-badge mz-badge--${state.tone}`}>{state.label}</span>
      </div>
      {state.expired && (
        <p className="mz-muted section-hint">اشتراک تمام شده؛ پست‌های جدید پردازش نمی‌شوند و دکمه‌ها رأی ثبت نمی‌کنند. با تمدید، همه‌چیز همان لحظه برمی‌گردد.</p>
      )}
      {channel.status === 'active' && plans?.length > 0 && (
        <div className="mz-row">
          {plans.map((p, i) => (
            <button
              key={p.id}
              type="button"
              className={`mz-btn mz-btn--sm ${i === plans.length - 1 ? 'mz-btn--primary' : ''}`}
              disabled={busy != null}
              onClick={() => buy(p)}
            >
              {busy === p.id ? '…' : `تمدید ${p.title.replace('اشتراک ', '')} — ${fa(p.stars)} ⭐️`}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
