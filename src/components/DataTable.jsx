// columns = [{ key, title, render(row, meta), className }] — meta: whatever the
// caller passes (here the endpoint result, for page-wide values like channelBase).
export default function DataTable({ columns, rows, loading, rowKey, meta, skeletonRows = 8 }) {
  return (
    <div className="mz-table-wrap">
      <table className="mz-table">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col">{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={i} className="mz-skeleton-row">
                {columns.map((c) => <td key={c.key}><div className="mz-skeleton" /></td>)}
              </tr>
            ))
            : rows.length === 0
              ? <tr><td colSpan={columns.length}><div className="mz-empty">موردی پیدا نشد</div></td></tr>
              : rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => <td key={c.key} className={c.className}>{c.render(row, meta)}</td>)}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
