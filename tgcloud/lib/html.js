// Text for parse_mode HTML messages.

export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const link = (url, text) => (url ? `<a href="${esc(url)}">${esc(text)}</a>` : esc(text));

export const fa = (n) => Number(n ?? 0).toLocaleString('fa-IR');

// 0.1234 → "۱۲٫۳٪"
export const faPercent = (ratio) => `${Number((ratio * 100).toFixed(1)).toLocaleString('fa-IR')}٪`;

// Change against the week before: "▲ ۲۵٪", "▼ ۱۰٪", "بدون تغییر", or "" with nothing to compare.
export function faChange(current, previous) {
  if (!previous) return '';
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.005) return 'بدون تغییر';
  return `${change > 0 ? '▲' : '▼'} ${Math.round(Math.abs(change) * 100).toLocaleString('fa-IR')}٪`;
}

export const userLabel = (u) => (u?.username ? `@${u.username}` : u?.first_name || String(u?.user_id ?? ''));

// Short enough for a list line.
export const clip = (s, n = 60) => {
  const t = String(s ?? '').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};
