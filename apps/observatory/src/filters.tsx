import { Button, Input } from "@astack/ui";
import { useId, useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import {
  fixedFilterOptions,
  mergeFilterOptions,
  type FilterOption,
  type RunFilter,
} from "@astack/agent-observability/filters";

const dimensions = [
  ["repo", "Repository"],
  ["work", "Work reference"],
  ["scheduled", "Run type"],
  ["automation", "Scheduled task"],
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
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();
  const choices = mergeFilterOptions([
    ...fixedFilterOptions,
    ...(options ?? []),
  ]);
  const active = filters.map((filter) => ({
    label:
      dimensions.find(([dimension]) => dimension === filter.dimension)?.[1] ??
      filter.dimension,
    value:
      choices.find(
        (item) =>
          item.dimension === filter.dimension && item.value === filter.value,
      )?.label ?? filter.value,
  }));
  if (after) active.push({ label: "From", value: after });
  if (before) active.push({ label: "Through", value: before });
  return (
    <section className="filter-disclosure" aria-label="Run filters">
      <div className="filter-toolbar">
        <Button
          variant="outline"
          aria-label="Filters"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((previous) => !previous)}
        >
          <SlidersHorizontal size={16} aria-hidden="true" />
          Filters
          {active.length > 0 && (
            <span className="filter-count">{active.length}</span>
          )}
          <ChevronDown
            size={14}
            aria-hidden="true"
            className={
              expanded ? "disclosure-chevron expanded" : "disclosure-chevron"
            }
          />
        </Button>
        {!active.length && (
          <span className="secondary">No filters applied</span>
        )}
        {active.length > 0 && (
          <Button variant="ghost" onClick={clear}>
            Clear filters
          </Button>
        )}
      </div>
      {active.length > 0 && (
        <ul className="active-filters" aria-label="Active filters">
          {active.map((item) => (
            <li key={item.label}>
              <span>{item.label}:</span> {item.value}
            </li>
          ))}
        </ul>
      )}
      <form
        id={panelId}
        hidden={!expanded}
        className="filters"
        onSubmit={(e) => e.preventDefault()}
      >
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
                  !["status", "outcome", "scheduled"].includes(dimension)
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
    </section>
  );
}
