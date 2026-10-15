import { useEffect, useState } from 'react';
import { tg, useTelegramTheme } from './lib/telegram.js';
import { useEndpoint } from './lib/useEndpoint.js';
import { VIEWS, FILTERS } from './views.jsx';
import StatTiles from './components/StatTiles.jsx';
import Tabs from './components/Tabs.jsx';
import DataTable from './components/DataTable.jsx';
import Pagination from './components/Pagination.jsx';

const TAB_ITEMS = Object.entries(VIEWS).map(([id, v]) => ({ id, label: v.label }));

function errorText(e) {
  return e.type === 'ENDPOINT_ERROR' ? e.message : `خطا در دریافت اطلاعات (${e.type ?? e.message})`;
}

function Denied({ text }) {
  return (
    <main className="mz-container">
      <div className="mz-card mz-empty">
        <p className="mz-title">⛔️</p>
        <p className="mz-subtitle">{text}</p>
      </div>
    </main>
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

function TableView({ tab, reloadKey }) {
  const view = VIEWS[tab];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const q = useDebounced(search.trim());

  useEffect(() => setPage(1), [q, filter, size]);

  // reloadKey is part of the input, so pressing ↻ refetches.
  const { data, error, loading, reload } = useEndpoint(view.endpoint, { page, size, q, filter, reloadKey });

  const goTo = (p) => {
    setPage(p);
    tg?.HapticFeedback?.selectionChanged();
  };

  return (
    <section className="mz-stack">
      <div className="mz-row toolbar">
        <input
          className="mz-input"
          type="search"
          autoComplete="off"
          placeholder={view.search}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {view.filters && (
          <div className="mz-row">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className="mz-chip"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="mz-alert mz-row alert-row">
          <span>{errorText(error)}</span>
          <button type="button" className="mz-btn mz-btn--sm" onClick={reload}>تلاش دوباره</button>
        </div>
      )}

      <DataTable
        columns={view.columns}
        rows={data?.rows ?? []}
        rowKey={view.rowKey}
        loading={loading}
        skeletonRows={Math.min(size, 8)}
      />

      <Pagination
        page={data?.page ?? page}
        pages={data?.pages ?? 1}
        total={data?.total ?? 0}
        size={size}
        disabled={loading}
        onPage={goTo}
        onSize={setSize}
      />
    </section>
  );
}

export default function App() {
  useTelegramTheme();
  const [tab, setTab] = useState('likes');
  const [reloadKey, setReloadKey] = useState(0);
  const summary = useEndpoint('adminSummary', { reloadKey });

  const e = summary.error;
  if (e?.type === 'NOT_IN_TELEGRAM') return <Denied text="این صفحه را از داخل تلگرام باز کنید" />;
  if (e?.code === 'FORBIDDEN') return <Denied text={e.message} />;

  const me = tg?.initDataUnsafe?.user;

  return (
    <main className="mz-container mz-stack">
      <header className="mz-row app-header">
        <div>
          <h1 className="mz-title">پنل لایک‌ها</h1>
          {me && <p className="mz-muted app-hello">سلام {me.first_name} 👋</p>}
        </div>
        <button
          type="button"
          className="mz-btn mz-btn--icon"
          aria-label="به‌روزرسانی"
          title="به‌روزرسانی"
          onClick={() => setReloadKey((k) => k + 1)}
        >
          ↻
        </button>
      </header>

      {e && <div className="mz-alert">{errorText(e)}</div>}
      <StatTiles data={summary.data} />

      <Tabs items={TAB_ITEMS} value={tab} onChange={setTab} />
      {/* key: a new tab starts with a fresh search, filter and page */}
      <TableView key={tab} tab={tab} reloadKey={reloadKey} />
    </main>
  );
}
