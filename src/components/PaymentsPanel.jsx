// "پرداخت‌ها" tab — Stars payments and their totals, with refunds. Owner only
// (ownerPayments / ownerRefundPayment refuse anyone else).
import { useEffect, useState } from 'react';
import { callEndpoint } from '../lib/serverless.js';
import { useEndpoint } from '../lib/useEndpoint.js';
import { fa, faDate } from '../lib/format.js';
import { alertDialog, confirmDialog } from '../lib/telegram.js';
import DataTable from './DataTable.jsx';
import Pagination from './Pagination.jsx';
import { UserCell } from './cells.jsx';

const PLAN_LABEL = { m1: 'یک‌ماهه', m3: 'سه‌ماهه' };

const TILES = [
  ['stars', 'کل درآمد (استارز)', 'mz-stat--green'],
  ['stars_30d', 'درآمد ۳۰ روز اخیر'],
  ['active_users', 'کانال با اشتراک فعال', 'mz-stat--coral'],
  ['credits', 'اعتبار استفاده‌نشده'],
];

function StatusBadge({ r }) {
  if (r.refunded_at) return <span className="mz-badge mz-badge--neutral">برگشت‌خورده</span>;
  if (!r.channel_id) return <span className="mz-badge mz-badge--neutral">منتظر اضافه کردن کانال</span>;
  return r.active
    ? <span className="mz-badge mz-badge--like">فعال</span>
    : <span className="mz-badge mz-badge--dislike">تمام‌شده</span>;
}

// Search box value, debounced before it reaches the query.
function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function PaymentsPanel({ reloadKey }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [refreshKey, setRefreshKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const q = useDebounced(search.trim());
  useEffect(() => setPage(1), [q, size]);

  const { data, loading, error } = useEndpoint('ownerPayments', { page, size, q, reloadKey, refreshKey });
  const s = data?.summary;

  const refund = async (r) => {
    const who = r.user_name ? `@${r.user_name}` : r.user_id;
    const ok = await confirmDialog(
      `${fa(r.stars)} استارز به ${who} برگردانده شود؟${r.channel_id ? ` ${fa(r.months * 30)} روز هم از اشتراک کانالش کم می‌شود.` : ''}`,
    );
    if (!ok) return;
    setBusy(true);
    try {
      await callEndpoint('ownerRefundPayment', { paymentId: r.id });
      setRefreshKey((k) => k + 1);
    } catch (e) {
      await alertDialog(e.type === 'ENDPOINT_ERROR' ? e.message : `خطا (${e.type ?? e.message})`);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: 'user', title: 'خریدار', className: 'mz-cell-nowrap', render: (r) => <UserCell name={r.user_name} id={r.user_id} /> },
    { key: 'channel', title: 'کانال', className: 'mz-cell-nowrap', render: (r) => r.channel_title ?? (r.channel_id ? r.channel_id : <span className="mz-muted">—</span>) },
    { key: 'plan', title: 'پلن', render: (r) => <span className="mz-badge mz-badge--neutral">{PLAN_LABEL[r.plan] ?? `${fa(r.months)} ماهه`}</span> },
    { key: 'stars', title: '⭐️ استارز', className: 'mz-cell-num', render: (r) => <strong className={r.refunded_at ? 'struck' : ''}>{fa(r.stars)}</strong> },
    { key: 'paid', title: 'تاریخ خرید', className: 'mz-cell-num', render: (r) => faDate(r.created_at) },
    { key: 'until', title: 'دوره', className: 'mz-cell-num', render: (r) => (r.channel_id ? `${faDate(r.period_start)} تا ${faDate(r.period_end)}` : '—') },
    { key: 'status', title: 'وضعیت', className: 'mz-cell-nowrap', render: (r) => <StatusBadge r={r} /> },
    { key: 'charge', title: 'شناسه پرداخت', className: 'mz-cell-num', render: (r) => <code dir="ltr" className="charge-id">{r.charge_id}</code> },
    { key: 'actions', title: '', render: (r) => (r.refunded_at ? null : (
      <button type="button" className="mz-btn mz-btn--sm" disabled={busy} onClick={() => refund(r)}>↩️ برگشت</button>
    )) },
  ];

  return (
    <section className="mz-stack">
      <section className="mz-stats" aria-label="خلاصه پرداخت‌ها">
        {TILES.map(([key, label, mod = '']) => (
          <div key={key} className={`mz-stat ${mod}`}>
            <div className="mz-stat__label">{label}</div>
            <div className="mz-stat__value">{s ? fa(s[key]) : <div className="mz-skeleton stat-skeleton" />}</div>
          </div>
        ))}
      </section>

      <input
        className="mz-input"
        type="search"
        autoComplete="off"
        placeholder="جستجوی نام کاربری، شناسه کاربر یا شناسه پرداخت…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="mz-alert">{error.type === 'ENDPOINT_ERROR' ? error.message : `خطا (${error.type ?? error.message})`}</div>}

      {!loading && !error && data?.total === 0 && !q
        ? <div className="mz-card mz-empty">هنوز خریدی انجام نشده ⭐️</div>
        : (
          <>
            <DataTable columns={columns} rows={data?.rows ?? []} loading={loading} rowKey={(r) => r.id} skeletonRows={4} />
            <Pagination
              page={data?.page ?? page} pages={data?.pages ?? 1} total={data?.total ?? 0} size={size}
              disabled={loading} onPage={setPage} onSize={setSize}
            />
          </>
        )}
    </section>
  );
}
