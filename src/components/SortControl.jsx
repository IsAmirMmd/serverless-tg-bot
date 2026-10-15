// Sort picker for a table: what to sort by + a descending/ascending toggle.
// options = [{ id, label, desc, asc }] — desc/asc name the order in words
// ("most first" / "least first"); ids match the endpoint's allowed sort keys.
export default function SortControl({ options, sort, dir, onChange }) {
  const current = options.find((o) => o.id === sort) ?? options[0];
  const next = dir === 'asc' ? 'desc' : 'asc';
  return (
    <div className="sort-control" role="group" aria-label="مرتب‌سازی">
      <select
        className="mz-select"
        aria-label="مرتب‌سازی بر اساس"
        value={current.id}
        onChange={(e) => onChange(e.target.value, 'desc')}
      >
        {options.map((o) => <option key={o.id} value={o.id}>↕ {o.label}</option>)}
      </select>
      <button
        type="button"
        className="mz-btn sort-control__dir"
        title={dir === 'asc' ? 'صعودی' : 'نزولی'}
        aria-label={`ترتیب: ${dir === 'asc' ? current.asc : current.desc}، برای تغییر بزنید`}
        onClick={() => onChange(current.id, next)}
      >
        {dir === 'asc' ? '↑' : '↓'} {dir === 'asc' ? current.asc : current.desc}
      </button>
    </div>
  );
}
