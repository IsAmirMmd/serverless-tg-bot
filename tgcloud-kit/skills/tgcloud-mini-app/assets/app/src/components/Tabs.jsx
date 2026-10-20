// Segmented tabs: items = [{ id, label }].
export default function Tabs({ items, value, onChange }) {
  return (
    <nav className="mz-tabs" role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          className="mz-tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
