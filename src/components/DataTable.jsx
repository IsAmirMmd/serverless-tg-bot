// columns = [{ key, title, render(row, meta), className, hideOnMobile }] — meta:
// whatever the caller passes (here the endpoint result, for page-wide values).
// hideOnMobile leaves a minor column out of the phone cards.
// On phones each row turns into a card ("title … value", see .mz-table--cards in
// styles/mirza.css); every cell carries its column title as data-label for that.
export default function DataTable({ columns, rows, loading, rowKey, meta, skeletonRows = 8 }) {
  const label = (c) => (typeof c.title === 'string' ? c.title : '');
  const cls = (c) => [c.className, c.hideOnMobile && 'mz-hide-mobile'].filter(Boolean).join(' ') || undefined;
  return (
    <div className="mz-table-wrap mz-table-wrap--cards">
      <table className="mz-table mz-table--cards">
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col">{c.title}</th>)}</tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: skeletonRows }, (_, i) => (
              <tr key={i} className="mz-skeleton-row">
                {columns.map((c) => <td key={c.key} className={cls(c)} data-label={label(c)}><div className="mz-skeleton" /></td>)}
              </tr>
            ))
            : rows.length === 0
              ? <tr><td colSpan={columns.length}><div className="mz-empty">موردی پیدا نشد</div></td></tr>
              : rows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.key} className={cls(c)} data-label={label(c)}>{c.render(row, meta)}</td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
