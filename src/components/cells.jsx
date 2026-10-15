import { faDigits } from '../lib/format.js';

const Dash = () => <span className="mz-muted">—</span>;

export function UserCell({ name, id }) {
  return (
    <div className="cell-user">
      <strong>{name ? `@${name}` : <Dash />}</strong>
      <small className="mz-num">{faDigits(id)}</small>
    </div>
  );
}

export function MusicCell({ name, id }) {
  return (
    <div className="cell-user">
      <strong>{name || `آهنگ #${faDigits(id)}`}</strong>
      <small className="mz-num">#{faDigits(id)}</small>
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
