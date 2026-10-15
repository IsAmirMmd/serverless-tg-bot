// "پرداخت‌ها" tab — Stars payments and their totals. Owner only (ownerPayments refuses anyone else).
import { useEffect, useState } from 'react';
import { useEndpoint } from '../lib/useEndpoint.js';
import { fa, faDate } from '../lib/format.js';
import DataTable from './DataTable.jsx';
import Pagination from './Pagination.jsx';
import { UserCell } from './cells.jsx';

const PLAN_LABEL = { m1: 'یک‌ماهه', m3: 'سه‌ماهه' };

const TILES = [
  ['stars', 'کل درآمد (استارز)', 'mz-stat--green'],
  ['stars_30d', 'درآمد ۳۰ روز اخیر'],
  ['payments', 'تعداد خرید'],
  ['active_users', 'اشتراک فعال', 'mz-stat--coral'],
];

const COLUMNS = [
  { key: 'user', title: 'خریدار', className: 'mz-cell-nowrap', render: (r) => <UserCell name={r.user_name} id={r.user_id} /> },
  { key: 'plan', title: 'پلن', render: (r) => <span className="mz-badge mz-badge--neutral">{PLAN_LABEL[r.plan] ?? `${fa(r.months)} ماهه`}</span> },
  { key: 'stars', title: '⭐️ استارز', className: 'mz-cell-num', render: (r) => <strong>{fa(r.stars)}</strong> },
  { key: 'paid', title: 'تاریخ خرید', className: 'mz-cell-num', render: (r) => faDate(r.created_at) },
  { key: 'until', title: 'اعتبار تا', className: 'mz-cell-num', render: (r) => faDate(r.period_end) },
  { key: 'status', title: 'وضعیت', render: (r) => (r.active
    ? <span className="mz-badge mz-badge--like">فعال</span>
    : <span className="mz-badge mz-badge--dislike">تمام‌شده</span>) },
  { key: 'charge', title: 'شناسه پرداخت', className: 'mz-cell-num', render: (r) => <code dir="ltr" className="charge-id">{r.charge_id}</code> },
];

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
  const q = useDebounced(search.trim());
  useEffect(() => setPage(1), [q, size]);

  const { data, loading, error } = useEndpoint('ownerPayments', { page, size, q, reloadKey });
  const s = data?.summary;

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
            <DataTable columns={COLUMNS} rows={data?.rows ?? []} loading={loading} rowKey={(r) => r.id} skeletonRows={4} />
            <Pagination
              page={data?.page ?? page} pages={data?.pages ?? 1} total={data?.total ?? 0} size={size}
              disabled={loading} onPage={setPage} onSize={setSize}
            />
          </>
        )}
    </section>
  );
}
