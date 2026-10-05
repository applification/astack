# State and adapters

Keep a selected identity, not a second authoritative copy of the record:

```tsx
type Item = { id: string; title: string };
type ItemListProps = {
  items: readonly Item[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ItemList({ items, selectedId, onSelect }: ItemListProps) {
  const selected = items.find((item) => item.id === selectedId);
  return (
    <section aria-label="Items">
      {items.map((item) => (
        <button key={item.id} aria-pressed={item.id === selectedId}
          onClick={() => onSelect(item.id)}>{item.title}</button>
      ))}
      <p>{selected ? `Selected: ${selected.title}` : 'No current selection'}</p>
    </section>
  );
}
```

The consuming adapter obtains current data and owns selection. A new subscription result updates the selected title automatically; removal exposes the missing selection instead of keeping a stale editable object. An editor's draft is a different value: keep it separate and decide whether changing identity discards it, confirms discard, or preserves drafts per ID.

For web, the adapter can call `useQuery`/`useMutation` after authenticated Convex readiness. For MCP UI, the adapter receives validated tool results and calls the host bridge. Both pass data/actions to the same presentation component. Neither adapter belongs in shared UI. A prop such as `onSave` returns a promise when the component needs to show pending/failure; await it before clearing the draft. Do not render a success toast in a `finally` block.

Test props changing while mounted, selected-record removal, rejection followed by retry, repeated click while pending, and unmount/remount when an external subscription is involved. Select relevant cases; a pure title render does not need every lifecycle test.
