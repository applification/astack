import type { RecordItem } from '../records';
export function RecordList({ items, selectedId, onSelect, error }: {
  items: RecordItem[]; selectedId?: string; onSelect: (id: string) => void; error?: string;
}) {
  return <section aria-label="Records">
    <h1>Reference records</h1>
    {error && <p role="alert">{error}</p>}
    {!items.length && <p>No records found.</p>}
    <ul>{items.map(item => <li key={item.id}>
      <button type="button" aria-pressed={selectedId === item.id} onClick={() => onSelect(item.id)}>
        <strong>{item.title}</strong><span>{item.summary}</span>
      </button>
    </li>)}</ul>
  </section>;
}
