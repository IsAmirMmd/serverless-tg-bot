import { faDigits } from '../lib/format.js';
import { tg } from '../lib/telegram.js';

const Dash = () => <span className="mz-muted">—</span>;

// A t.me link that opens inside Telegram (openTelegramLink) instead of a browser tab.
export function PostLink({ url, children }) {
  if (!url) return children;
  const open = (e) => {
    if (!tg?.openTelegramLink) return; // outside Telegram: let the browser follow it
    e.preventDefault();
    tg.openTelegramLink(url);
  };
  return (
    <a className="mz-link" href={url} target="_blank" rel="noreferrer" onClick={open}>
      {children}
    </a>
  );
}

export function UserCell({ name, id }) {
  return (
    <div className="cell-user">
      <strong>{name ? `@${name}` : <Dash />}</strong>
      <small className="mz-num">{faDigits(id)}</small>
    </div>
  );
}

export function MusicCell({ name, id, url }) {
  return (
    <div className="cell-user">
      <strong>{name || `آهنگ #${faDigits(id)}`}</strong>
      <small className="mz-num"><PostLink url={url}>#{faDigits(id)}</PostLink></small>
    </div>
  );
}

export function VoteBadge({ liked }) {
  return liked
    ? <span className="mz-badge mz-badge--like">❤️ لایک</span>
    : <span className="mz-badge mz-badge--dislike">🥀 دیس‌لایک</span>;
}

// A comma-joined list from group_concat.
export function ListCell({ value }) {
  return value ? <div className="cell-ids">{faDigits(value)}</div> : <Dash />;
}

// A comma-joined list of music ids, each linked to its post via channelBase.
export function MusicIdsCell({ value, channelBase }) {
  if (!value) return <Dash />;
  const ids = String(value).split('،').map((s) => s.trim()).filter(Boolean);
  return (
    <div className="cell-ids">
      {ids.map((id, i) => (
        <span key={`${id}-${i}`}>
          {i > 0 && '، '}
          <PostLink url={channelBase ? channelBase + id : null}>{faDigits(id)}</PostLink>
        </span>
      ))}
    </div>
  );
}
