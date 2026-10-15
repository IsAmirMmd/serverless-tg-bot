// "کاربران و کانال‌ها" tab — owner only (the owner* endpoints refuse anyone else).
import { useEffect, useState } from 'react';
import { callEndpoint } from '../lib/serverless.js';
import { useEndpoint } from '../lib/useEndpoint.js';
import { fa, faDate, faDigits } from '../lib/format.js';
import { alertDialog, confirmDialog, shareLink } from '../lib/telegram.js';
import DataTable from './DataTable.jsx';
import Pagination from './Pagination.jsx';
import { PostLink, UserCell } from './cells.jsx';
import { subscriptionState } from './SubscriptionBar.jsx';

const STATUS = {
  active: ['فعال', 'mz-badge--like'],
  pending: ['در انتظار فعال‌سازی', 'mz-badge--neutral'],
  paused: ['متوقف', 'mz-badge--dislike'],
};
const ROLES = { manager: 'مدیر', viewer: 'بیننده' };

const StatusBadge = ({ status }) => {
  const [label, cls] = STATUS[status] ?? [status, 'mz-badge--neutral'];
  return <span className={`mz-badge ${cls}`}>{label}</span>;
};

const errorText = (e) => (e?.type === 'ENDPOINT_ERROR' ? e.message : `خطا (${e?.type ?? e?.message})`);

// Runs an owner action, shows its error, then refreshes the lists.
function useAction(onDone) {
  const [busy, setBusy] = useState(false);
  const run = async (name, input) => {
    setBusy(true);
    try {
      const result = await callEndpoint(name, input);
      onDone();
      return result;
    } catch (e) {
      await alertDialog(errorText(e));
      return null;
    } finally {
      setBusy(false);
    }
  };
  return [run, busy];
}

function ChannelsCard({ channels, loading, run, busy }) {
  const setStatus = async (c, status) => {
    const verb = status === 'active' ? 'فعال' : 'متوقف';
    if (await confirmDialog(`کانال «${c.title ?? c.chat_id}» ${verb} شود؟`)) {
      await run('ownerSetChannelStatus', { channelId: c.chat_id, status });
    }
  };
  // Gift time: +days, or null to remove the limit (a channel with a limit is a paid one).
  const extend = async (c, days) => {
    const what = days == null ? 'بدون محدودیت زمانی شود'
      : c.expires_at == null ? `از «نامحدود» به اشتراک ${fa(days)} روزه تبدیل شود (بعدش باید تمدید شود)`
        : `${fa(days)} روز به اشتراکش اضافه شود`;
    if (await confirmDialog(`کانال «${c.title ?? c.chat_id}» ${what}؟`)) {
      await run('ownerExtendChannel', { channelId: c.chat_id, days });
    }
  };
  const columns = [
    { key: 'title', title: 'کانال', className: 'mz-cell-nowrap', render: (c) => (
      <div className="cell-user">
        <strong>{c.link ? <PostLink url={c.link}>{c.title ?? c.username}</PostLink> : (c.title ?? '—')}</strong>
        <small className="mz-num">{faDigits(c.chat_id)}</small>
      </div>
    ) },
    { key: 'status', title: 'وضعیت', render: (c) => <StatusBadge status={c.status} /> },
    { key: 'sub', title: 'اشتراک', className: 'mz-cell-nowrap', render: (c) => {
      const s = subscriptionState(c);
      return c.expires_at == null ? <span className="mz-muted">نامحدود</span> : <span className={`mz-badge mz-badge--${s.tone}`}>{s.label}</span>;
    } },
    { key: 'members', title: 'اعضا', className: 'mz-cell-num', render: (c) => fa(c.members) },
    { key: 'votes', title: 'رأی‌ها', className: 'mz-cell-num', render: (c) => fa(c.votes) },
    { key: 'added', title: 'اضافه‌کننده', className: 'mz-cell-num', render: (c) => faDigits(c.added_by ?? '—') },
    { key: 'actions', title: '', className: 'mz-cell-nowrap', render: (c) => (
      <div className="mz-row tag-row">
        {c.status === 'active'
          ? <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => setStatus(c, 'paused')}>توقف</button>
          : <button type="button" className="mz-btn mz-btn--sm mz-btn--primary" disabled={busy} onClick={() => setStatus(c, 'active')}>فعال‌سازی</button>}
        <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => extend(c, 30)}>
          {c.expires_at == null ? 'اشتراکی کن (۳۰ روز)' : '+۳۰ روز'}
        </button>
        {c.expires_at != null && (
          <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => extend(c, null)}>بدون محدودیت</button>
        )}
      </div>
    ) },
  ];
  return (
    <section className="mz-stack">
      <h2 className="mz-subtitle">کانال‌ها</h2>
      <p className="mz-muted section-hint">
        هر کانالی که ربات را ادمین کند اینجا «در انتظار» می‌آید. تا فعالش نکنید، پست‌ها و رأی‌هایش پردازش نمی‌شوند.
        با فعال‌سازی، کسی که ربات را اضافه کرده مدیر همان کانال می‌شود. اگر او قبلاً پرداخت کرده باشد، کانال خودکار فعال می‌شود.
        کانالی که اشتراکش تمام شود خودکار متوقف می‌شود. «نامحدود» یعنی تاریخ انقضا ندارد.
      </p>
      <DataTable columns={columns} rows={channels} loading={loading} rowKey={(c) => c.chat_id} skeletonRows={2} />
    </section>
  );
}

function NewMemberCard({ channels, run, busy }) {
  const [channelId, setChannelId] = useState('');
  const [role, setRole] = useState('manager');
  const [userId, setUserId] = useState('');
  const [invite, setInvite] = useState(null);

  useEffect(() => {
    if (!channelId && channels.length) setChannelId(channels[0].chat_id);
  }, [channels, channelId]);

  const createInvite = async () => {
    const result = await run('ownerCreateInvite', { channelId, role });
    if (result) setInvite(result);
  };

  const addById = async () => {
    const result = await run('ownerAddMember', { channelId, userId: userId.trim(), role });
    if (!result) return;
    setUserId('');
    await alertDialog(result.reachable
      ? 'کاربر اضافه شد و پیام دسترسی برایش ارسال شد.'
      : 'کاربر اضافه شد، ولی هنوز ربات را start نکرده؛ دکمه پنل بعد از start کردن ربات و ارسال /panel ظاهر می‌شود.');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invite.link);
      await alertDialog('لینک کپی شد');
    } catch {
      await alertDialog(invite.link);
    }
  };

  if (!channels.length) return null;

  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">افزودن کاربر جدید</h2>
      <div className="mz-row form-row">
        <label className="field">
          <span className="field__label">کانال</span>
          <select className="mz-select" value={channelId} onChange={(e) => { setChannelId(e.target.value); setInvite(null); }}>
            {channels.map((c) => <option key={c.chat_id} value={c.chat_id}>{c.title ?? c.chat_id}{c.status !== 'active' ? ' (غیرفعال)' : ''}</option>)}
          </select>
        </label>
        <label className="field">
          <span className="field__label">نقش</span>
          <select className="mz-select" value={role} onChange={(e) => { setRole(e.target.value); setInvite(null); }}>
            {Object.entries(ROLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="mz-stack invite-box">
        <div className="mz-row">
          <button type="button" className="mz-btn mz-btn--primary" disabled={busy || !channelId} onClick={createInvite}>
            🔗 ساخت لینک دعوت
          </button>
          <span className="mz-muted section-hint">یک‌بارمصرف، اعتبار ۷ روز. کاربر با باز کردن لینک، ربات را start می‌کند و دسترسی‌اش فعال می‌شود.</span>
        </div>
        {invite && (
          <div className="mz-alert mz-alert--success mz-stack">
            <input className="mz-input mz-num" readOnly value={invite.link} dir="ltr" onFocus={(e) => e.target.select()} />
            <div className="mz-row">
              <button type="button" className="mz-btn mz-btn--sm" onClick={copy}>کپی</button>
              <button type="button" className="mz-btn mz-btn--sm" onClick={() => shareLink(invite.link, `دعوت به پنل آمار کانال «${invite.channel_title ?? ''}»`)}>ارسال در تلگرام</button>
              <span className="mz-muted section-hint">تا {faDate(invite.expires_at)}</span>
            </div>
          </div>
        )}
      </div>

      <details className="by-id">
        <summary>افزودن با شناسه عددی تلگرام</summary>
        <div className="mz-row form-row">
          <input
            className="mz-input mz-num"
            inputMode="numeric"
            dir="ltr"
            placeholder="مثلاً 123456789"
            value={userId}
            onChange={(e) => setUserId(e.target.value.replace(/[^\d]/g, ''))}
          />
          <button type="button" className="mz-btn" disabled={busy || !userId || !channelId} onClick={addById}>افزودن</button>
        </div>
      </details>
    </section>
  );
}

// Fake likes/dislikes on any channel post, named by its link (the link carries the channel).
function FakeVotesCard({ run, busy }) {
  const [link, setLink] = useState('');
  const [count, setCount] = useState('10');
  const [liked, setLiked] = useState(true);
  const [last, setLast] = useState(null);

  const submit = async () => {
    const n = Number(count);
    const label = liked ? 'لایک' : 'دیس‌لایک';
    if (!(await confirmDialog(`${fa(n)} ${label} ساختگی به این پست اضافه شود؟`))) return;
    const result = await run('ownerFakeVotes', { link: link.trim(), liked, count: n });
    if (result) setLast(result);
  };

  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">لایک ساختگی</h2>
      <p className="mz-muted section-hint">
        لینک پست را از تلگرام کپی کنید (روی پست: Copy Post Link). کانال از روی لینک تشخیص داده می‌شود.
      </p>
      <input
        className="mz-input"
        dir="ltr"
        placeholder="https://t.me/channel/123"
        value={link}
        onChange={(e) => { setLink(e.target.value); setLast(null); }}
      />
      <div className="mz-row form-row">
        <div className="mz-row">
          <button type="button" className="mz-chip" aria-pressed={liked} onClick={() => setLiked(true)}>❤️ لایک</button>
          <button type="button" className="mz-chip" aria-pressed={!liked} onClick={() => setLiked(false)}>🥀 دیس‌لایک</button>
        </div>
        <input
          className="mz-input mz-num count-input"
          inputMode="numeric"
          dir="ltr"
          aria-label="تعداد"
          value={count}
          onChange={(e) => setCount(e.target.value.replace(/[^\d]/g, ''))}
        />
        <button
          type="button"
          className="mz-btn mz-btn--primary"
          disabled={busy || !link.trim() || !Number(count)}
          onClick={submit}
        >
          افزودن
        </button>
      </div>
      {last && (
        <div className="mz-alert mz-alert--success">
          {fa(last.added)} رأی به پست #{faDigits(last.musicId)} در «{last.channel_title}» اضافه شد.
          الان: ❤️ {fa(last.liked)} · 🥀 {fa(last.disliked)}
        </div>
      )}
    </section>
  );
}

function MembersCard({ channels, reloadKey, run, busy }) {
  const [channelId, setChannelId] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  useEffect(() => setPage(1), [channelId, size]);
  const { data, loading, error } = useEndpoint('ownerMembers', { channelId, page, size, reloadKey });

  const remove = async (m) => {
    const who = m.user_name ? `@${m.user_name}` : m.user_id;
    if (await confirmDialog(`دسترسی ${who} به «${m.channel_title ?? m.channel_id}» حذف شود؟`)) {
      await run('ownerRemoveMember', { channelId: m.channel_id, userId: m.user_id });
    }
  };

  const columns = [
    { key: 'user', title: 'کاربر', className: 'mz-cell-nowrap', render: (m) => <UserCell name={m.user_name} id={m.user_id} /> },
    { key: 'channel', title: 'کانال', className: 'mz-cell-nowrap', render: (m) => m.channel_title ?? m.channel_id },
    { key: 'role', title: 'نقش', render: (m) => <span className="mz-badge mz-badge--neutral">{ROLES[m.role] ?? m.role}</span> },
    { key: 'added', title: 'تاریخ', className: 'mz-cell-num', render: (m) => faDate(m.added_at) },
    { key: 'actions', title: '', render: (m) => <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => remove(m)}>حذف</button> },
  ];

  return (
    <section className="mz-stack">
      <div className="mz-row section-head">
        <h2 className="mz-subtitle">کاربران</h2>
        <select className="mz-select mz-btn--sm" value={channelId} onChange={(e) => setChannelId(e.target.value)} aria-label="فیلتر کانال">
          <option value="all">همه کانال‌ها</option>
          {channels.map((c) => <option key={c.chat_id} value={c.chat_id}>{c.title ?? c.chat_id}</option>)}
        </select>
      </div>
      {error && <div className="mz-alert">{errorText(error)}</div>}
      <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} rowKey={(m) => m.id} skeletonRows={3} />
      <Pagination
        page={data?.page ?? page} pages={data?.pages ?? 1} total={data?.total ?? 0} size={size}
        disabled={loading} onPage={setPage} onSize={setSize}
      />
    </section>
  );
}

function InvitesCard({ reloadKey, run, busy }) {
  const { data, loading } = useEndpoint('ownerInvites', { reloadKey });
  const rows = data?.rows ?? [];
  if (!loading && !rows.length) return null;

  const revoke = async (i) => {
    if (await confirmDialog('این لینک دعوت باطل شود؟')) await run('ownerRevokeInvite', { code: i.code });
  };
  const columns = [
    { key: 'channel', title: 'کانال', className: 'mz-cell-nowrap', render: (i) => i.channel_title ?? i.channel_id },
    { key: 'role', title: 'نقش', render: (i) => ROLES[i.role] ?? i.role },
    { key: 'code', title: 'کد', className: 'mz-cell-num', render: (i) => <code dir="ltr">{i.code}</code> },
    { key: 'expires', title: 'انقضا', className: 'mz-cell-num', render: (i) => faDate(i.expires_at) },
    { key: 'actions', title: '', className: 'mz-cell-nowrap', render: (i) => (
      <div className="mz-row">
        <button type="button" className="mz-btn mz-btn--sm" onClick={() => shareLink(i.link)}>ارسال</button>
        <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => revoke(i)}>باطل</button>
      </div>
    ) },
  ];
  return (
    <section className="mz-stack">
      <h2 className="mz-subtitle">لینک‌های دعوت فعال</h2>
      <DataTable columns={columns} rows={rows} loading={loading} rowKey={(i) => i.code} skeletonRows={2} />
    </section>
  );
}

export default function OwnerPanel({ onChannelsChanged }) {
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => {
    setReloadKey((k) => k + 1);
    onChannelsChanged?.();
  };
  const [run, busy] = useAction(refresh);
  const { data, loading, error } = useEndpoint('ownerChannels', { reloadKey });
  const channels = data?.rows ?? [];

  return (
    <div className="mz-stack owner-panel">
      {error && <div className="mz-alert">{errorText(error)}</div>}
      <ChannelsCard channels={channels} loading={loading && !data} run={run} busy={busy} />
      <NewMemberCard channels={channels} run={run} busy={busy} />
      <FakeVotesCard run={run} busy={busy} />
      <MembersCard channels={channels} reloadKey={reloadKey} run={run} busy={busy} />
      <InvitesCard reloadKey={reloadKey} run={run} busy={busy} />
    </div>
  );
}
