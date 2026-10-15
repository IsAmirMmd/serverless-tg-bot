import { fa } from '../lib/format.js';

const SIZES = [10, 20, 50];

// RTL: "first/previous" sit on the right, "next/last" on the left.
export default function Pagination({ page, pages, total, size, onPage, onSize, disabled }) {
  const atStart = disabled || page <= 1;
  const atEnd = disabled || page >= pages;
  return (
    <nav className="mz-pagination" aria-label="صفحه‌بندی">
      <div className="mz-row">
        <button type="button" className="mz-btn mz-btn--sm" disabled={atStart} onClick={() => onPage(1)}>اول</button>
        <button type="button" className="mz-btn mz-btn--sm" disabled={atStart} onClick={() => onPage(page - 1)}>→ قبلی</button>
      </div>
      <div className="mz-row">
        <span className="mz-pagination__info">
          صفحه {fa(page)} از {fa(pages)} · {fa(total)} ردیف
        </span>
        <select
          className="mz-select mz-btn--sm"
          aria-label="تعداد در صفحه"
          value={size}
          onChange={(e) => onSize(Number(e.target.value))}
        >
          {SIZES.map((s) => <option key={s} value={s}>{fa(s)} ردیف</option>)}
        </select>
      </div>
      <div className="mz-row">
        <button type="button" className="mz-btn mz-btn--sm" disabled={atEnd} onClick={() => onPage(page + 1)}>بعدی ←</button>
        <button type="button" className="mz-btn mz-btn--sm" disabled={atEnd} onClick={() => onPage(pages)}>آخر</button>
      </div>
    </nav>
  );
}
