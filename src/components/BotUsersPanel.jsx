// "اعضای ربات" tab — everyone who started the bot. Owner only (ownerBotUsers refuses anyone else).
import { useEffect, useState } from 'react';
import { useEndpoint } from '../lib/useEndpoint.js';
import { fa, faDate } from '../lib/format.js';
import DataTable from './DataTable.jsx';
import Pagination from './Pagination.jsx';
import { UserCell } from './cells.jsx';

const TILES = [
  ['users', 'کل اعضا', 'mz-stat--green'],
  ['new_1d', 'جدید امروز (۲۴ ساعت)'],
  ['new_7d', 'جدید این هفته'],
  ['premium', 'پریمیوم ⭐️', 'mz-stat--coral'],
];

const fullName = (r) => [r.first_name, r.last_name].filter(Boolean).join(' ');

const COLUMNS = [
  { key: 'user', title: 'کاربر', className: 'mz-cell-nowrap', render: (r) => <UserCell name={r.username} id={r.user_id} /> },
  { key: 'name', title: 'نام', className: 'mz-cell-nowrap', render: (r) => fullName(r) || '—' },
  { key: 'tags', title: '', className: 'mz-cell-nowrap', render: (r) => (
    <div className="mz-row tag-row">
      {r.is_owner && <span className="mz-badge mz-badge--neutral">مالک</span>}
      {r.channels > 0 && <span className="mz-badge mz-badge--like">دسترسی پنل</span>}
      {r.stars > 0 && <span className="mz-badge mz-badge--dislike">خریدار ⭐️ {fa(r.stars)}</span>}
      {r.is_premium && <span className="mz-badge mz-badge--neutral">پریمیوم</span>}
    </div>
  ) },
  { key: 'lang', title: 'زبان', className: 'mz-cell-num', render: (r) => r.language_code ?? '—' },
  { key: 'first', title: 'اولین استارت', className: 'mz-cell-num', render: (r) => faDate(r.first_seen_at) },
  { key: 'last', title: 'آخرین استارت', className: 'mz-cell-num', render: (r) => faDate(r.last_seen_at) },
  { key: 'count', title: 'دفعات', className: 'mz-cell-num', render: (r) => fa(r.start_count) },
  { key: 'param', title: 'ورود از', className: 'mz-cell-num', render: (r) => (r.start_param ? <code dir="ltr">{r.start_param}</code> : '—') },
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

export default function BotUsersPanel({ reloadKey }) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useDebounced(search.trim());
  useEffect(() => setPage(1), [q, size]);

  const { data, loading, error } = useEndpoint('ownerBotUsers', { page, size, q, reloadKey });
  const s = data?.summary;

  return (
    <section className="mz-stack">
      <section className="mz-stats" aria-label="خلاصه اعضا">
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
        placeholder="جستجوی نام، نام کاربری یا شناسه…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {error && <div className="mz-alert">{error.type === 'ENDPOINT_ERROR' ? error.message : `خطا (${error.type ?? error.message})`}</div>}

      <DataTable columns={COLUMNS} rows={data?.rows ?? []} loading={loading} rowKey={(r) => r.user_id} skeletonRows={4} />
      <Pagination
        page={data?.page ?? page} pages={data?.pages ?? 1} total={data?.total ?? 0} size={size}
        disabled={loading} onPage={setPage} onSize={setSize}
      />
    </section>
  );
}
