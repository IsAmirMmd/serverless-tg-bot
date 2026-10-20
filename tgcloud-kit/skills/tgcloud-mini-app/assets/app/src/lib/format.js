// Persian number/date formatting for the UI.

export const fa = (n) => Number(n ?? 0).toLocaleString('fa-IR');

const dateFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' });

// Unix seconds → "۲۴ مهر ۱۴۰۵، ۱۲:۳۰"
export const faDate = (unix) => (unix ? dateFmt.format(new Date(unix * 1000)) : '—');

// 0.1234 → "۱۲٫۳٪"; null → "—"
export const faPercent = (ratio) => (ratio == null || !Number.isFinite(ratio)
  ? '—'
  : `${Number((ratio * 100).toFixed(1)).toLocaleString('fa-IR')}٪`);
