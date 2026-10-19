// Persian number/date formatting for the tables.

export const fa = (n) => Number(n ?? 0).toLocaleString('fa-IR');

export const faDigits = (s) => String(s ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

const dateFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' });

// Unix seconds → "۲۴ مهر ۱۴۰۵، ۱۲:۳۰"
export const faDate = (unix) => (unix ? dateFmt.format(new Date(unix * 1000)) : '—');

// 0.1234 → "۱۲٫۳٪"; null → "—"
export const faPercent = (ratio) => (ratio == null || !Number.isFinite(ratio)
  ? '—'
  : `${Number((ratio * 100).toFixed(1)).toLocaleString('fa-IR')}٪`);

// Change against the period before: "▲ ۲۵٪", "▼ ۱۰٪", or '' with nothing to compare.
export function faChange(current, previous) {
  if (!previous) return '';
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) return '';
  return `${change > 0 ? '▲' : '▼'} ${Math.round(Math.abs(change) * 100).toLocaleString('fa-IR')}٪`;
}
