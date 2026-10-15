import { fa } from '../lib/format.js';

const TILES = [
  ['votes', 'کل رأی‌ها'],
  ['likes', 'لایک', 'mz-stat--green'],
  ['dislikes', 'دیس‌لایک', 'mz-stat--coral'],
  ['users', 'کاربران'],
  ['musics', 'آهنگ‌ها'],
];

export default function StatTiles({ data }) {
  return (
    <section className="mz-stats" aria-label="خلاصه">
      {TILES.map(([key, label, mod = '']) => (
        <div key={key} className={`mz-stat ${mod}`}>
          <div className="mz-stat__label">{label}</div>
          <div className="mz-stat__value">
            {data ? fa(data[key]) : <div className="mz-skeleton stat-skeleton" />}
          </div>
        </div>
      ))}
    </section>
  );
}
