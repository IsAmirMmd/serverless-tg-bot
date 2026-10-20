import { useEffect, useState } from 'react';
import { useTelegramTheme } from './lib/telegram.js';
import { useEndpoint } from './lib/useEndpoint.js';
import { fa, faDate } from './lib/format.js';
import Tabs from './components/Tabs.jsx';
import DataTable from './components/DataTable.jsx';
import Pagination from './components/Pagination.jsx';

// Endpoint errors: an EndpointError's message is written for the user; anything
// else gets a generic text.
const errorText = (e) => (e.type === 'ENDPOINT_ERROR' ? e.message : `خطا در دریافت اطلاعات (${e.type ?? e.message})`);

function Notice({ icon, text }) {
  return (
    <main className="mz-container">
      <div className="mz-card mz-empty">
        <p className="mz-title">{icon}</p>
        <p className="mz-subtitle">{text}</p>
      </div>
    </main>
  );
}

function StatsTab() {
  const { data, error, loading } = useEndpoint('adminStats');
  if (error) return <div className="mz-alert">{errorText(error)}</div>;
  const tiles = [
    { label: 'کل کاربران', value: data?.users },
    { label: 'استارت‌کرده', value: data?.started, tone: 'green' },
    { label: 'بلاک‌کرده', value: data?.blocked, tone: 'coral' },
    { label: 'جدید (۷ روز)', value: data?.new_7d },
  ];
  return (
    <section className="mz-stats">
      {tiles.map((t) => (
        <div key={t.label} className={`mz-stat${t.tone ? ` mz-stat--${t.tone}` : ''}`}>
          <div className="mz-stat__label">{t.label}</div>
          <div className="mz-stat__value">{loading ? <div className="mz-skeleton stat-skeleton" /> : fa(t.value)}</div>
        </div>
      ))}
    </section>
  );
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

const USER_COLUMNS = [
  {
    key: 'user',
    title: 'کاربر',
    render: (u) => (
      <span className="cell-user">
        <bdi>{u.username ? `@${u.username}` : u.first_name || '—'}</bdi>
        <small className="mz-num">{u.user_id}</small>
      </span>
    ),
  },
  { key: 'starts', title: 'استارت', className: 'mz-cell-num', render: (u) => fa(u.start_count) },
  {
    key: 'status',
    title: 'وضعیت',
    render: (u) => (u.blocked
      ? <span className="mz-badge mz-badge--dislike">بلاک</span>
      : u.unsubscribed ? <span className="mz-badge mz-badge--neutral">لغو اشتراک</span>
        : <span className="mz-badge mz-badge--like">فعال</span>),
  },
  { key: 'first', title: 'اولین بازدید', hideOnMobile: true, render: (u) => faDate(u.first_seen_at) },
];

function UsersTab() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useDebounced(search.trim());
  useEffect(() => setPage(1), [q, size]);
  const { data, error, loading } = useEndpoint('adminUsers', { page, size, q });
  return (
    <section className="mz-stack">
      <input
        className="mz-input"
        type="search"
        placeholder="جستجو: نام، یوزرنیم یا آیدی"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {error
        ? <div className="mz-alert">{errorText(error)}</div>
        : (
          <>
            <DataTable columns={USER_COLUMNS} rows={data?.rows ?? []} loading={loading && !data} rowKey={(u) => u.user_id} />
            {data && (
              <Pagination
                page={data.page} pages={data.pages} total={data.total} size={size}
                onPage={setPage} onSize={setSize} disabled={loading}
              />
            )}
          </>
        )}
    </section>
  );
}

const TABS = [{ id: 'stats', label: '📊 آمار' }, { id: 'users', label: '👥 کاربران' }];

export default function App() {
  useTelegramTheme();
  const me = useEndpoint('me');
  const [tab, setTab] = useState('stats');

  if (me.loading) return <Notice icon="⏳" text="در حال بارگذاری…" />;
  if (me.error?.type === 'NOT_IN_TELEGRAM') return <Notice icon="📱" text="این صفحه رو از داخل تلگرام باز کن." />;
  if (me.error) return <Notice icon="⚠️" text={errorText(me.error)} />;
  if (!me.data.isAdmin) return <Notice icon="👋" text={`سلام ${me.data.first_name ?? ''}!`} />;

  return (
    <main className="mz-container mz-stack">
      <header className="mz-row app-header">
        <div>
          <h1 className="mz-title">پنل مدیریت</h1>
          <p className="mz-muted app-hello">سلام {me.data.first_name} 👋</p>
        </div>
      </header>
      <Tabs items={TABS} value={tab} onChange={setTab} />
      {tab === 'stats' ? <StatsTab /> : <UsersTab />}
    </main>
  );
}
