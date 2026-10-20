import { fa } from '../lib/format.js';

const SIZES = [10, 20, 50];

// RTL: "first/previous" sit on the right, "next/last" on the left. On phones
// first/last hide (.mz-pagination__edge) and prev · page · next share one row.
export default function Pagination({ page, pages, total, size, onPage, onSize, disabled }) {
  const atStart = disabled || page <= 1;
  const atEnd = disabled || page >= pages;
  return (
    <nav className="mz-pagination" aria-label="صفحه‌بندی">
      <div className="mz-pagination__nav">
        <div className="mz-row">
          <button type="button" className="mz-btn mz-btn--sm mz-pagination__edge" disabled={atStart} onClick={() => onPage(1)}>اول</button>
          <button type="button" className="mz-btn mz-btn--sm" disabled={atStart} onClick={() => onPage(page - 1)}>→ قبلی</button>
        </div>
        <span className="mz-pagination__info">
          <b>صفحه {fa(page)} از {fa(pages)}</b>
          {fa(total)} ردیف
        </span>
        <div className="mz-row">
          <button type="button" className="mz-btn mz-btn--sm" disabled={atEnd} onClick={() => onPage(page + 1)}>بعدی ←</button>
          <button type="button" className="mz-btn mz-btn--sm mz-pagination__edge" disabled={atEnd} onClick={() => onPage(pages)}>آخر</button>
        </div>
      </div>
      <select
        className="mz-select mz-btn--sm page-size"
        aria-label="تعداد در صفحه"
        value={size}
        onChange={(e) => onSize(Number(e.target.value))}
      >
        {SIZES.map((s) => <option key={s} value={s}>{fa(s)} ردیف در صفحه</option>)}
      </select>
    </nav>
  );
}
