// Persian number/date formatting for the tables.

export const fa = (n) => Number(n ?? 0).toLocaleString('fa-IR');

export const faDigits = (s) => String(s ?? '').replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d]);

const dateFmt = new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'medium', timeStyle: 'short' });

// Unix seconds → "۲۴ مهر ۱۴۰۵، ۱۲:۳۰"
export const faDate = (unix) => (unix ? dateFmt.format(new Date(unix * 1000)) : '—');
