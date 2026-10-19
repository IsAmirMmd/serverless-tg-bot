// "پیام به کاربران" tab — the owner messages a segment of the people who
// started the bot (by channel, activity, or an artist they liked). The count
// updates as the segment changes; sending goes in batches (ownerBroadcastSend
// returns progress and is called until done). Owner only.
import { useEffect, useState } from 'react';
import { callEndpoint } from '../lib/serverless.js';
import { useEndpoint } from '../lib/useEndpoint.js';
import { fa, faDate } from '../lib/format.js';
import { alertDialog, confirmDialog } from '../lib/telegram.js';

const errorText = (e) => (e?.type === 'ENDPOINT_ERROR' ? e.message : `خطا (${e?.type ?? e?.message})`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ACTIVITIES = [
  { id: 'all', label: 'همه' },
  { id: 'active30', label: 'فعال در ۳۰ روز' },
  { id: 'inactive30', label: 'بی‌فعالیت ۳۰ روز' },
  { id: 'new7', label: 'جدید این هفته' },
];

function useDebounced(value, ms = 400) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Calls ownerBroadcastSend until the broadcast is done; waits when a batch
// made no progress (Telegram asked to slow down).
async function sendAll(first, onProgress) {
  let b = first;
  let stalls = 0;
  onProgress(b);
  while (b.status !== 'done') {
    const before = b.sent + b.failed;
    b = await callEndpoint('ownerBroadcastSend', { id: b.id });
    onProgress(b);
    if (b.sent + b.failed === before) {
      stalls += 1;
      if (stalls > 10) throw new Error('ارسال متوقف شد؛ بعداً از فهرست پایین ادامه دهید.');
      await sleep(3000);
    } else {
      stalls = 0;
    }
  }
  return b;
}

export default function BroadcastPanel({ channels, reloadKey }) {
  const [channelId, setChannelId] = useState('all');
  const [activity, setActivity] = useState('all');
  const [artist, setArtist] = useState('');
  const [text, setText] = useState('');
  const [tick, setTick] = useState(0);
  const [progress, setProgress] = useState(null);
  const [busy, setBusy] = useState(false);
  const segment = { channelId, activity, artist: useDebounced(artist.trim()) };
  const { data, loading, error } = useEndpoint('ownerBroadcastPreview', { segment, reloadKey, tick });
  const count = data?.count ?? 0;

  const run = async (start) => {
    setBusy(true);
    try {
      const b = await sendAll(await start(), setProgress);
      await alertDialog(`ارسال تمام شد: ${fa(b.sent)} موفق، ${fa(b.failed)} ناموفق`);
      setText('');
    } catch (e) {
      await alertDialog(e?.type ? errorText(e) : e.message);
    } finally {
      setBusy(false);
      setTick((t) => t + 1);
    }
  };

  const send = async () => {
    if (!(await confirmDialog(`این پیام برای ${fa(count)} نفر فرستاده شود؟`))) return;
    await run(() => callEndpoint('ownerBroadcastSend', { segment, text }));
  };

  return (
    <section className="mz-stack owner-panel">
      <section className="mz-card mz-stack">
        <h2 className="mz-subtitle">پیام به کاربران ربات</h2>
        <p className="mz-muted section-hint">
          فقط به کسانی می‌رسد که ربات را start کرده‌اند و /stop نزده‌اند. آخر هر پیام راه لغو (/stop) اضافه می‌شود.
          کم و هدفمند بفرستید؛ پیام زیاد باعث بلاک و گزارش اسپم می‌شود.
        </p>
        <div className="mz-row form-row">
          <label className="field">
            <span className="field__label">کانال</span>
            <select className="mz-select" value={channelId} onChange={(e) => setChannelId(e.target.value)}>
              <option value="all">همه کانال‌ها</option>
              {channels.map((c) => <option key={c.chat_id} value={c.chat_id}>{c.title ?? c.chat_id}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field__label">لایک کرده آهنگی از (اختیاری)</span>
            <input className="mz-input" maxLength={60} placeholder="اسم خواننده، مثلاً Eljaan" value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>
        </div>
        <div className="mz-row">
          {ACTIVITIES.map((a) => (
            <button key={a.id} type="button" className="mz-chip" aria-pressed={activity === a.id} onClick={() => setActivity(a.id)}>{a.label}</button>
          ))}
        </div>
        {error && <div className="mz-alert">{errorText(error)}</div>}
        <div className="mz-alert mz-alert--success">
          {loading ? 'در حال شمارش…' : <>این پیام به <b>{fa(count)}</b> نفر می‌رسد.</>}
        </div>
        <textarea
          className="mz-input broadcast-text"
          rows={5}
          maxLength={3500}
          placeholder="متن پیام…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mz-row">
          <button type="button" className="mz-btn mz-btn--primary" disabled={busy || loading || !count || !text.trim()} onClick={send}>
            📣 ارسال
          </button>
          {progress && busy && (
            <span className="mz-muted section-hint">در حال ارسال: {fa(progress.sent + progress.failed)} از {fa(progress.total)}</span>
          )}
        </div>
      </section>

      {data?.recent?.length > 0 && (
        <section className="mz-card mz-stack">
          <h2 className="mz-subtitle">ارسال‌های اخیر</h2>
          <ul className="growth-list broadcast-list">
            {data.recent.map((b) => (
              <li key={b.id}>
                <div className="mz-row section-head">
                  <span>
                    {faDate(b.created_at)} — {fa(b.sent)} از {fa(b.total)} رسید{b.failed ? `، ${fa(b.failed)} ناموفق` : ''}
                  </span>
                  {b.status !== 'done' && (
                    <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => run(() => callEndpoint('ownerBroadcastSend', { id: b.id }))}>
                      ادامه ارسال
                    </button>
                  )}
                </div>
                <div className="mz-muted cell-ids">{b.text.length > 120 ? `${b.text.slice(0, 119)}…` : b.text}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
