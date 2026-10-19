import { useEffect, useMemo, useState } from 'react';
import { tg, useTelegramTheme } from './lib/telegram.js';
import { useEndpoint } from './lib/useEndpoint.js';
import { VIEWS, FILTERS, CHANNEL_COLUMN } from './views.jsx';
import StatTiles from './components/StatTiles.jsx';
import Tabs from './components/Tabs.jsx';
import DataTable from './components/DataTable.jsx';
import Pagination from './components/Pagination.jsx';
import OwnerPanel from './components/OwnerPanel.jsx';
import PaymentsPanel from './components/PaymentsPanel.jsx';
import BotUsersPanel from './components/BotUsersPanel.jsx';
import SubscriptionBar from './components/SubscriptionBar.jsx';
import SortControl from './components/SortControl.jsx';
import GrowthPanel from './components/GrowthPanel.jsx';
import BroadcastPanel from './components/BroadcastPanel.jsx';

const OWNER_TAB = 'manage';
const PAYMENTS_TAB = 'payments';
const BOT_USERS_TAB = 'botUsers';
const BROADCAST_TAB = 'broadcast';
const OWNER_TABS = [OWNER_TAB, PAYMENTS_TAB, BOT_USERS_TAB, BROADCAST_TAB];
// One channel at a time, with the channel picker but not the vote tables.
const GROWTH_TAB = 'growth';

function errorText(e) {
  return e.type === 'ENDPOINT_ERROR' ? e.message : `خطا در دریافت اطلاعات (${e.type ?? e.message})`;
}

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

// Search box value, debounced before it reaches the query.
function useDebounced(value, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function TableView({ tab, channelId, showChannel, reloadKey }) {
  const view = VIEWS[tab];
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [order, setOrder] = useState({ sort: view.sorts[0].id, dir: 'desc' });
  const q = useDebounced(search.trim());

  useEffect(() => setPage(1), [q, filter, size, channelId, order]);

  // reloadKey is part of the input, so pressing ↻ refetches.
  const { data, error, loading, reload } = useEndpoint(view.endpoint, {
    channelId, page, size, q, filter, sort: order.sort, dir: order.dir, reloadKey,
  });
  const columns = useMemo(
    () => (showChannel ? [CHANNEL_COLUMN, ...view.columns] : view.columns),
    [showChannel, view],
  );

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
        <SortControl
          options={view.sorts}
          sort={order.sort}
          dir={order.dir}
          onChange={(sort, dir) => setOrder({ sort, dir })}
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
        columns={columns}
        rows={data?.rows ?? []}
        meta={data}
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

const STATUS_LABEL = { pending: 'در انتظار', paused: 'متوقف' };

function ChannelPicker({ channels, value, onChange, allowAll }) {
  if (channels.length < 2 && !allowAll) return null;
  return (
    <label className="field channel-picker">
      <span className="field__label">کانال</span>
      <select className="mz-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {allowAll && <option value="all">همه کانال‌ها</option>}
        {channels.map((c) => (
          <option key={c.chat_id} value={c.chat_id}>
            {c.title ?? c.username ?? c.chat_id}{STATUS_LABEL[c.status] ? ` (${STATUS_LABEL[c.status]})` : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function App() {
  useTelegramTheme();
  const [meKey, setMeKey] = useState(0);
  const me = useEndpoint('me', { meKey });
  const [tab, setTab] = useState('likes');
  const [channelId, setChannelId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const isOwner = Boolean(me.data?.isOwner);
  const channels = me.data?.channels ?? [];
  const allowAll = isOwner || channels.length > 1;

  // Default channel: everything for the owner, otherwise the first channel.
  useEffect(() => {
    if (!me.data || channelId) return;
    setChannelId(allowAll ? 'all' : channels[0]?.chat_id ?? null);
  }, [me.data, channelId, allowAll, channels]);

  const summary = useEndpoint('adminSummary', { channelId: channelId ?? 'all', reloadKey });

  const tabItems = useMemo(() => [
    ...Object.entries(VIEWS).map(([id, v]) => ({ id, label: v.label })),
    { id: GROWTH_TAB, label: 'رشد و بازاریابی' },
    ...(isOwner ? [
      { id: OWNER_TAB, label: 'کاربران و کانال‌ها' },
      { id: PAYMENTS_TAB, label: 'پرداخت‌ها' },
      { id: BOT_USERS_TAB, label: 'اعضای ربات' },
      { id: BROADCAST_TAB, label: 'پیام به کاربران' },
    ] : []),
  ], [isOwner]);

  if (me.error?.type === 'NOT_IN_TELEGRAM') return <Notice icon="📱" text="این صفحه را از داخل تلگرام باز کنید" />;
  if (me.error) return <Notice icon="⚠️" text={errorText(me.error)} />;
  if (me.loading && !me.data) return <Notice icon="⏳" text="در حال بارگذاری…" />;
  if (!isOwner && !channels.length) return <Notice icon="⛔️" text="دسترسی به هیچ کانالی برای شما فعال نشده است" />;
  if (!channelId) return null;

  const user = tg?.initDataUnsafe?.user;
  const selected = channelId !== 'all' ? channels.find((c) => c.chat_id === channelId) : null;
  const showChannel = channelId === 'all' && (isOwner ? channels.length > 1 : true);

  return (
    <main className="mz-container mz-stack">
      <header className="mz-row app-header">
        <div>
          <h1 className="mz-title">پنل آمار کانال</h1>
          {user && <p className="mz-muted app-hello">سلام {user.first_name} 👋{isOwner ? ' · مالک' : ''}</p>}
        </div>
        <button
          type="button"
          className="mz-btn mz-btn--icon"
          aria-label="به‌روزرسانی"
          title="به‌روزرسانی"
          onClick={() => { setReloadKey((k) => k + 1); setMeKey((k) => k + 1); }}
        >
          ↻
        </button>
      </header>

      {!OWNER_TABS.includes(tab) && (
        <>
          <ChannelPicker channels={channels} value={channelId} onChange={setChannelId} allowAll={allowAll} />
          {selected && (
            <SubscriptionBar
              key={selected.chat_id}
              channel={selected}
              plans={me.data?.plans}
              onPaid={() => { setMeKey((k) => k + 1); setReloadKey((k) => k + 1); }}
            />
          )}
          {summary.error && <div className="mz-alert">{errorText(summary.error)}</div>}
          <StatTiles data={summary.loading ? null : summary.data} />
        </>
      )}

      <Tabs items={tabItems} value={tab} onChange={setTab} />

      {tab === OWNER_TAB && <OwnerPanel onChannelsChanged={() => setMeKey((k) => k + 1)} />}
      {tab === PAYMENTS_TAB && <PaymentsPanel reloadKey={reloadKey} />}
      {tab === BOT_USERS_TAB && <BotUsersPanel reloadKey={reloadKey} />}
      {tab === BROADCAST_TAB && <BroadcastPanel channels={channels} reloadKey={reloadKey} />}
      {tab === GROWTH_TAB && <GrowthPanel channelId={channelId} reloadKey={reloadKey} />}
      {/* key: a new tab starts with a fresh search, filter and page */}
      {!OWNER_TABS.includes(tab) && tab !== GROWTH_TAB && (
        <TableView key={tab} tab={tab} channelId={channelId} showChannel={showChannel} reloadKey={reloadKey} />
      )}
    </main>
  );
}
