import { Button, Input } from "@astack/ui";
import {
  fixedFilterOptions,
  mergeFilterOptions,
  type FilterOption,
  type RunFilter,
} from "@astack/agent-observability/filters";

const dimensions = [
  ["repo", "Repository"],
  ["work", "Work reference"],
  ["agent", "Agent"],
  ["version", "Agent version"],
  ["machine", "Machine"],
  ["branch", "Branch"],
  ["status", "Status"],
  ["outcome", "Work outcome"],
  ["skill", "Skill / workflow"],
  ["tool", "Tool / MCP"],
] satisfies readonly (readonly [FilterOption["dimension"], string])[];

export function RunFilters({
  options,
  loading = false,
  filters,
  after,
  before,
  change,
  changeAfter,
  changeBefore,
  clear,
}: {
  options: readonly FilterOption[] | undefined;
  loading?: boolean;
  filters: readonly RunFilter[];
  after: string;
  before: string;
  change: (dimension: FilterOption["dimension"], value: string) => void;
  changeAfter: (value: string) => void;
  changeBefore: (value: string) => void;
  clear: () => void;
}) {
  const choices = mergeFilterOptions([
    ...fixedFilterOptions,
    ...(options ?? []),
  ]);
  return (
    <>
      <form className="filters" onSubmit={(e) => e.preventDefault()}>
        {dimensions.map(([dimension, label]) => {
          const selected =
            filters.find((f) => f.dimension === dimension)?.value ?? "";
          const items = choices.filter((item) => item.dimension === dimension);
          return (
            <label key={dimension}>
              {label}
              <select
                aria-label={label}
                value={selected}
                disabled={
                  options === undefined &&
                  !["status", "outcome"].includes(dimension)
                }
                onChange={(e) => change(dimension, e.target.value)}
              >
                <option value="">Any</option>
                {selected && !items.some((item) => item.value === selected) && (
                  <option value={selected}>
                    {selected} · {loading ? "loading" : "unavailable"}
                  </option>
                )}
                {items.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label>
          From date
          <Input
            aria-label="From date"
            type="date"
            value={after}
            onChange={(e) => changeAfter(e.target.value)}
          />
        </label>
        <label>
          Through date
          <Input
            aria-label="Through date"
            type="date"
            value={before}
            min={after || undefined}
            onChange={(e) => changeBefore(e.target.value)}
          />
        </label>
      </form>
      {loading && (
        <p role="status" className="subtitle">
          Loading filter choices…
        </p>
      )}
      {!!(filters.length || after || before) && (
        <Button variant="ghost" onClick={clear}>
          Clear filters
        </Button>
      )}
    </>
  );
}
