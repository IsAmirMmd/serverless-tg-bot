// "رشد و بازاریابی" tab — one channel's growth: where members come from and how
// many stay, real engagement, best posting hours, top inviters, posts and song
// requests. Managers (and the owner) also make campaign links, post polls and
// switch the buttons under posts. Endpoints: tgcloud/endpoints/growth*.js.
import { useEffect, useState } from 'react';
import { callEndpoint } from '../lib/serverless.js';
import { useEndpoint } from '../lib/useEndpoint.js';
import { fa, faDate, faPercent, faChange } from '../lib/format.js';
import { alertDialog, confirmDialog, copyText, shareLink } from '../lib/telegram.js';
import DataTable from './DataTable.jsx';
import Pagination from './Pagination.jsx';
import SortControl from './SortControl.jsx';
import { MusicCell } from './cells.jsx';

const errorText = (e) => (e?.type === 'ENDPOINT_ERROR' ? e.message : `خطا (${e?.type ?? e?.message})`);
const round1 = (x) => Math.round(x * 10) / 10;

// The same labels as the weekly report (tgcloud/lib/weekly.js).
const SOURCE_LABEL = {
  direct: 'مستقیم (جستجو، یوزرنیم، فوروارد)',
  folder: 'پوشه تلگرام',
  primary: 'لینک اصلی کانال',
  other: 'لینک‌های دیگر',
  share: 'اشتراک آهنگ از ربات',
  bot: 'دکمه کانال در ربات',
  ref: 'دعوت شنونده‌ها (لینک اختصاصی)',
  unknown: 'نامشخص',
};
const sourceLabel = (r) => (r.source === 'campaign' || r.source.startsWith('link:') ? r.name : SOURCE_LABEL[r.source] ?? r.source);

function Tiles({ d }) {
  const tiles = [
    ['اعضای کانال', d && (d.members == null ? '—' : fa(d.members))],
    ['ورود (۷ روز)', d && fa(d.week.joins), 'mz-stat--green', d && faChange(d.week.joins, d.prevWeek.joins)],
    ['خروج (۷ روز)', d && fa(d.week.leaves), 'mz-stat--coral'],
    ['رأی واقعی (۷ روز)', d && fa(d.votes.votes), '', d && faChange(d.votes.votes, d.prevVotes.votes)],
    ['نرخ تعامل (۳۰ روز)', d && faPercent(d.engagement.rate)],
    ['میانگین رأی هر پست', d && (d.engagement.avg_voters == null ? '—' : fa(round1(d.engagement.avg_voters)))],
  ];
  return (
    <section className="mz-stats" aria-label="خلاصه رشد">
      {tiles.map(([label, value, mod = '', change]) => (
        <div key={label} className={`mz-stat ${mod}`}>
          <div className="mz-stat__label">{label}</div>
          <div className="mz-stat__value">
            {value ?? <div className="mz-skeleton stat-skeleton" />}
            {change && <small className="stat-change">{change}</small>}
          </div>
        </div>
      ))}
    </section>
  );
}

function QualityCard({ q }) {
  if (!q) return null;
  const total = q.real_votes + q.team_votes + q.fake_votes;
  const parts = [
    ['real', 'واقعی', q.real_votes],
    ['team', 'تیم کانال', q.team_votes],
    ['fake', 'فیک', q.fake_votes],
  ];
  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">کیفیت رأی‌ها</h2>
      {total > 0 && (
        <div className="quality-bar" role="img" aria-label="سهم رأی واقعی، تیم و فیک">
          {parts.map(([k, , n]) => n > 0 && <span key={k} className={`quality-bar__${k}`} style={{ width: `${(n / total) * 100}%` }} />)}
        </div>
      )}
      <div className="mz-row quality-legend">
        {parts.map(([k, label, n]) => (
          <span key={k}><i className={`quality-dot quality-bar__${k}`} />{label}: <b>{fa(n)}</b>{total ? ` (${faPercent(n / total)})` : ''}</span>
        ))}
        <span>شنونده‌های واقعی: <b>{fa(q.real_users)}</b></span>
      </div>
      <p className="mz-muted section-hint">
        «تیم کانال» یعنی مالک ربات، مدیرها و کسی که ربات را اضافه کرده. «فیک» یعنی رأی‌های ساختگی.
        بقیه آمار این صفحه و گزارش هفتگی فقط رأی‌های واقعی را می‌شمارند.
      </p>
    </section>
  );
}

const PERIODS = [{ id: 7, label: '۷ روز' }, { id: 30, label: '۳۰ روز' }, { id: 0, label: 'همه' }];

function SourcesCard({ channelId, canManage, reloadKey }) {
  const [days, setDays] = useState(30);
  const [tick, setTick] = useState(0);
  const { data, loading, error } = useEndpoint('growthSources', { channelId, days, reloadKey, tick });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const link = await callEndpoint('growthCreateLink', { channelId, name });
      setName('');
      setTick((t) => t + 1);
      await copyText(link.url);
    } catch (e) {
      await alertDialog(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'source', title: 'منبع', className: 'mz-cell-wrap', render: (r) => (
      <div className="cell-user">
        <strong>{sourceLabel(r)}</strong>
        {r.url && <small className="mz-num" dir="ltr">{r.url}</small>}
      </div>
    ) },
    { key: 'joins', title: 'ورود', className: 'mz-cell-num', render: (r) => <strong>{fa(r.joins)}</strong> },
    { key: 'stayed', title: 'هنوز عضو', className: 'mz-cell-num', render: (r) => fa(r.stayed) },
    { key: 'left7', title: 'ماندگاری ۷ روزه', className: 'mz-cell-num', render: (r) => (r.joins ? faPercent(1 - r.left_7d / r.joins) : '—') },
    { key: 'actions', title: '', className: 'mz-cell-nowrap', render: (r) => r.url && (
      <div className="mz-row tag-row">
        <button type="button" className="mz-btn mz-btn--sm" onClick={() => copyText(r.url)}>کپی</button>
        <button type="button" className="mz-btn mz-btn--sm" onClick={() => shareLink(r.url)}>ارسال</button>
      </div>
    ) },
  ];

  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">از کجا عضو می‌شوند؟</h2>
      <div className="mz-row">
        {PERIODS.map((p) => (
          <button key={p.id} type="button" className="mz-chip" aria-pressed={days === p.id} onClick={() => setDays(p.id)}>{p.label}</button>
        ))}
      </div>
      <p className="mz-muted section-hint">
        برای هر تبلیغ یا همکاری یک لینک دعوت جدا بسازید و به‌جای لینک کانال همان را منتشر کنید؛ اینجا معلوم می‌شود هر لینک چند عضو آورده و چندتایشان ماندند.
      </p>
      {canManage && (
        <div className="mz-row form-row">
          <input
            className="mz-input"
            maxLength={32}
            placeholder="اسم لینک، مثلاً «اینستاگرام» یا «تبلیغ کانال X»"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="button" className="mz-btn mz-btn--primary" disabled={busy || !name.trim()} onClick={create}>🔗 ساخت لینک</button>
        </div>
      )}
      {error && <div className="mz-alert">{errorText(error)}</div>}
      <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} rowKey={(r) => r.key} skeletonRows={3} />
    </section>
  );
}

function HoursCard({ hours }) {
  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">بهترین ساعت پست</h2>
      {hours?.length
        ? <ol className="growth-list">{hours.map((h) => (
          <li key={h.hour}>ساعت <b>{fa(h.hour)}</b> — میانگین {fa(round1(h.avg_voters))} رأی واقعی ({fa(h.posts)} پست)</li>
        ))}</ol>
        : <p className="mz-muted section-hint">هنوز داده کافی نیست؛ وقتی در یک ساعت حداقل ۲ پست منتشر شود، اینجا نشان داده می‌شود.</p>}
    </section>
  );
}

function ReferrersCard({ rows }) {
  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">بهترین دعوت‌کننده‌ها (۳۰ روز)</h2>
      {rows?.length
        ? <ol className="growth-list">{rows.map((r) => (
          <li key={r.user_id}><b><bdi>{r.username ? `@${r.username}` : r.first_name ?? r.user_id}</bdi></b> — {fa(r.stayed)} عضو ماندگار ({fa(r.joins)} ورود)</li>
        ))}</ol>
        : <p className="mz-muted section-hint">شنونده‌ها از دکمه «🎧 آهنگ‌های من» زیر پست‌ها لینک دعوت اختصاصی می‌گیرند؛ هر کس با لینکشان عضو شود اینجا حساب می‌شود.</p>}
    </section>
  );
}

const POST_SORTS = [
  { id: 'date', label: 'تاریخ', desc: 'جدیدترین', asc: 'قدیمی‌ترین' },
  { id: 'likes', label: 'لایک واقعی', desc: 'بیشترین', asc: 'کمترین' },
  { id: 'voters', label: 'رأی واقعی', desc: 'بیشترین', asc: 'کمترین' },
  { id: 'rate', label: 'نرخ تعامل', desc: 'بیشترین', asc: 'کمترین' },
  { id: 'fake', label: 'رأی فیک', desc: 'بیشترین', asc: 'کمترین' },
];

function PostsCard({ channelId, reloadKey }) {
  const [order, setOrder] = useState({ sort: 'date', dir: 'desc' });
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  useEffect(() => setPage(1), [order, size]);
  const { data, loading, error } = useEndpoint('growthPosts', { channelId, page, size, sort: order.sort, dir: order.dir, reloadKey });
  const columns = [
    { key: 'music', title: 'آهنگ', className: 'mz-cell-wrap', render: (r) => <MusicCell name={r.name} id={r.music_id} url={r.music_url} /> },
    { key: 'at', title: 'انتشار', className: 'mz-cell-num', render: (r) => (r.posted_at ? faDate(r.posted_at) : <span className="mz-muted">قبل از ردیابی</span>) },
    { key: 'members', title: 'اعضا', className: 'mz-cell-num', hideOnMobile: true, render: (r) => (r.members == null ? '—' : fa(r.members)) },
    { key: 'likes', title: '❤️ واقعی', className: 'mz-cell-num', render: (r) => <strong>{fa(r.real_likes)}</strong> },
    { key: 'dislikes', title: '🥀 واقعی', className: 'mz-cell-num', render: (r) => fa(r.real_dislikes) },
    { key: 'team', title: 'تیم', className: 'mz-cell-num', hideOnMobile: true, render: (r) => fa(r.team_votes) },
    { key: 'fake', title: 'فیک', className: 'mz-cell-num', render: (r) => fa(r.fake_votes) },
    { key: 'rate', title: 'تعامل', className: 'mz-cell-num', render: (r) => faPercent(r.rate) },
  ];
  return (
    <section className="mz-card mz-stack">
      <div className="mz-row section-head">
        <h2 className="mz-subtitle">پست‌ها</h2>
        <SortControl options={POST_SORTS} sort={order.sort} dir={order.dir} onChange={(sort, dir) => setOrder({ sort, dir })} />
      </div>
      <p className="mz-muted section-hint">تعامل = سهم اعضایی که در زمان انتشار عضو بودند و به پست رأی واقعی دادند.</p>
      {error && <div className="mz-alert">{errorText(error)}</div>}
      <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} rowKey={(r) => r.music_id} skeletonRows={4} />
      <Pagination page={data?.page ?? page} pages={data?.pages ?? 1} total={data?.total ?? 0} size={size} disabled={loading} onPage={setPage} onSize={setSize} />
    </section>
  );
}

function RequestsCard({ channelId, reloadKey }) {
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(10);
  const { data, loading, error } = useEndpoint('growthRequests', { channelId, page, size, reloadKey });
  const columns = [
    { key: 'text', title: 'آهنگ درخواستی', className: 'mz-cell-wrap', render: (r) => <strong>{r.text}</strong> },
    { key: 'n', title: 'تعداد', className: 'mz-cell-num', render: (r) => fa(r.requests) },
    { key: 'who', title: 'درخواست‌دهنده‌ها', className: 'mz-cell-wrap', hideOnMobile: true, render: (r) => <div className="cell-ids">{r.who}</div> },
    { key: 'at', title: 'آخرین', className: 'mz-cell-num', render: (r) => faDate(r.last_at) },
  ];
  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">درخواست‌های آهنگ</h2>
      <p className="mz-muted section-hint">شنونده‌ها از دکمه «🎶 درخواست آهنگ» در ربات می‌فرستند. پرتکرارها بالاترند.</p>
      {error && <div className="mz-alert">{errorText(error)}</div>}
      <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} rowKey={(r) => r.k} skeletonRows={3} />
      <Pagination page={data?.page ?? page} pages={data?.pages ?? 1} total={data?.total ?? 0} size={size} disabled={loading} onPage={setPage} onSize={setSize} />
    </section>
  );
}

function PollCard({ channelId }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const filled = options.map((o) => o.trim()).filter(Boolean);
  const setOption = (i, v) => setOptions((list) => list.map((o, j) => (j === i ? v : o)));

  const send = async () => {
    if (!(await confirmDialog('نظرسنجی در کانال منتشر شود؟'))) return;
    setBusy(true);
    try {
      await callEndpoint('growthSendPoll', { channelId, question, options: filled });
      setQuestion('');
      setOptions(['', '']);
      await alertDialog('نظرسنجی در کانال منتشر شد ✅');
    } catch (e) {
      await alertDialog(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">نظرسنجی در کانال</h2>
      <p className="mz-muted section-hint">مثلاً «آهنگ بعدی کدوم باشه؟». نظرسنجی تلگرام مستقیم در کانال منتشر می‌شود.</p>
      <input className="mz-input" maxLength={300} placeholder="سؤال" value={question} onChange={(e) => setQuestion(e.target.value)} />
      {options.map((o, i) => (
        <div key={i} className="mz-row form-row poll-option">
          <input className="mz-input" maxLength={100} placeholder={`گزینه ${fa(i + 1)}`} value={o} onChange={(e) => setOption(i, e.target.value)} />
          {options.length > 2 && (
            <button type="button" className="mz-btn mz-btn--sm" aria-label="حذف گزینه" onClick={() => setOptions((list) => list.filter((_, j) => j !== i))}>✕</button>
          )}
        </div>
      ))}
      <div className="mz-row">
        {options.length < 10 && <button type="button" className="mz-btn mz-btn--sm" onClick={() => setOptions((list) => [...list, ''])}>＋ گزینه</button>}
        <button type="button" className="mz-btn mz-btn--primary" disabled={busy || !question.trim() || filled.length < 2} onClick={send}>📊 انتشار نظرسنجی</button>
      </div>
    </section>
  );
}

function SettingsCard({ channelId, on, onChange }) {
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    try {
      await callEndpoint('growthSettings', { channelId, growthButtons: !on });
      onChange();
    } catch (e) {
      await alertDialog(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="mz-card mz-stack">
      <h2 className="mz-subtitle">دکمه‌های زیر پست</h2>
      <p className="mz-muted section-hint">
        ردیف «🎧 آهنگ‌های من» و «📤 بفرست برای دوستت» زیر دکمه‌های لایک. شنونده‌ها از آن‌جا آهنگ‌های لایک‌شده‌شان، پیشنهاد آهنگ،
        لینک دعوت اختصاصی و درخواست آهنگ را در ربات می‌گیرند. تغییر روی پست‌های قدیمی با اولین رأی بعدی اعمال می‌شود.
      </p>
      <div className="mz-row">
        <button type="button" className="mz-chip" aria-pressed={on} disabled={busy} onClick={toggle}>{on ? '✅ روشن' : '⏸ خاموش'}</button>
      </div>
    </section>
  );
}

function GrowthBody({ channelId, reloadKey }) {
  const [tick, setTick] = useState(0);
  const { data: d, error } = useEndpoint('growthOverview', { channelId, reloadKey, tick });
  return (
    <section className="mz-stack growth">
      {error && <div className="mz-alert">{errorText(error)}</div>}
      <Tiles d={d} />
      <QualityCard q={d?.quality} />
      <SourcesCard channelId={channelId} canManage={Boolean(d?.canManage)} reloadKey={reloadKey} />
      <div className="growth-grid">
        <HoursCard hours={d?.bestHours} />
        <ReferrersCard rows={d?.referrers} />
      </div>
      <PostsCard channelId={channelId} reloadKey={reloadKey} />
      <RequestsCard channelId={channelId} reloadKey={reloadKey} />
      {d?.canManage && <PollCard channelId={channelId} />}
      {d?.canManage && <SettingsCard channelId={channelId} on={d.growthButtons} onChange={() => setTick((t) => t + 1)} />}
      {d && (
        <p className="mz-muted section-hint">
          {d.trackingSince
            ? `ورود و خروج اعضا از ${faDate(d.trackingSince)} ثبت می‌شود.`
            : 'ورود و خروج اعضا از همین حالا ثبت می‌شود.'}
          {' '}برای ساخت لینک دعوت، ربات باید در کانال اجازه «افزودن مشترک» (دعوت با لینک) داشته باشد.
        </p>
      )}
    </section>
  );
}

export default function GrowthPanel({ channelId, reloadKey }) {
  if (!channelId || channelId === 'all') {
    return <div className="mz-card mz-empty">برای دیدن آمار رشد، بالای صفحه یک کانال را انتخاب کنید.</div>;
  }
  return <GrowthBody key={channelId} channelId={channelId} reloadKey={reloadKey} />;
}
