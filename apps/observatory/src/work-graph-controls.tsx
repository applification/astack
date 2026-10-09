import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button, PreviewCard } from "@astack/ui";
import {
  ChevronDown,
  Expand,
  Eye,
  RotateCcw,
  SlidersHorizontal,
} from "lucide-react";
import type { NetworkFilters } from "@astack/agent-observability/work-network";
import type { NetworkLayout } from "./work-network-layout";

function GraphDisclosure({
  label,
  icon,
  count,
  children,
}: {
  label: string;
  icon: ReactNode;
  count?: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  return (
    <div
      className="graph-disclosure"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <Button
        ref={trigger}
        variant="graphTool"
        aria-label={label + (count ? ` · ${count} active` : "")}
        aria-expanded={open}
        aria-controls={id}
        onClick={(event) => {
          setOpen(!open);
          if (!open && event.detail === 0)
            requestAnimationFrame(() =>
              panel.current
                ?.querySelector<HTMLElement>("select, input, button")
                ?.focus(),
            );
        }}
      >
        {icon}
        {label}
        {!!count && <span className="graph-filter-count">{count}</span>}
        <ChevronDown aria-hidden="true" size={13} />
      </Button>
      {open && (
        <div
          className="graph-disclosure-panel"
          id={id}
          ref={panel}
          role="region"
          aria-label={"Graph " + label.toLowerCase()}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export const defaultNetworkFilters: NetworkFilters = {
  activity: true,
  skills: true,
  evidence: true,
  lens: "all",
};

export function WorkGraphControls({
  layout,
  onLayout,
  filters,
  onFilters,
  labels,
  onLabels,
  focus,
  onFocus,
  canFocus,
  resolution,
  onResolution,
  onSeed,
  onExpandAll,
  onOverview,
}: {
  layout: NetworkLayout;
  onLayout: (layout: NetworkLayout) => void;
  filters: NetworkFilters;
  onFilters: (filters: NetworkFilters) => void;
  labels: boolean;
  onLabels: (labels: boolean) => void;
  focus: boolean;
  onFocus: (focus: boolean) => void;
  canFocus: boolean;
  resolution: number;
  onResolution: (resolution: number) => void;
  onSeed: () => void;
  onExpandAll: () => void;
  onOverview: () => void;
}) {
  const filterCount =
    Number(filters.lens !== "all") +
    Number(!filters.activity) +
    Number(!filters.skills) +
    Number(!filters.evidence);
  return (
    <div className="graph-command-bar" aria-label="Graph controls" role="group">
      <label className="graph-layout-control">
        <span>Layout</span>
        <select
          aria-label="Graph layout"
          value={layout}
          onChange={(event) => {
            const value = event.target.value;
            if (
              value === "force" ||
              value === "communities" ||
              value === "layered"
            )
              onLayout(value);
          }}
        >
          <option value="force">Force</option>
          <option value="communities">Communities</option>
          <option value="layered">Layered</option>
        </select>
      </label>
      <GraphDisclosure
        label="Filters"
        icon={<SlidersHorizontal size={15} aria-hidden="true" />}
        count={filterCount}
      >
        <fieldset>
          <legend>Relationships</legend>
          <select
            aria-label="Graph relationships"
            value={filters.lens}
            onChange={(event) => {
              const value = event.target.value;
              if (
                value === "all" ||
                value === "delegation" ||
                value === "results"
              )
                onFilters({ ...filters, lens: value });
            }}
          >
            <option value="all">All captured links</option>
            <option value="delegation">Delegation</option>
            <option value="results">Results and declared use</option>
          </select>
        </fieldset>
        <fieldset>
          <legend>Include detail</legend>
          {(["activity", "skills", "evidence"] as const).map((kind) => (
            <label className="graph-check-option" key={kind}>
              <input
                type="checkbox"
                checked={filters[kind]}
                onChange={(event) =>
                  onFilters({ ...filters, [kind]: event.target.checked })
                }
              />
              <span>
                {kind === "activity"
                  ? "Activity"
                  : kind === "skills"
                    ? "Skill references"
                    : "Supporting evidence"}
              </span>
            </label>
          ))}
        </fieldset>
        <Button
          variant="graphTool"
          aria-disabled={!filterCount}
          onClick={() => onFilters(defaultNetworkFilters)}
        >
          <RotateCcw size={14} aria-hidden="true" />
          Reset filters
        </Button>
        <p className="secondary">
          Detail appears when its conversation is expanded.
        </p>
      </GraphDisclosure>
      <GraphDisclosure label="View" icon={<Eye size={15} aria-hidden="true" />}>
        <fieldset>
          <legend>Presentation</legend>
          <label className="graph-check-option">
            <input
              type="checkbox"
              checked={labels}
              onChange={(event) => onLabels(event.target.checked)}
            />
            More labels
          </label>
          <label className="graph-check-option">
            <input
              type="checkbox"
              disabled={!canFocus}
              checked={focus}
              onChange={(event) => onFocus(event.target.checked)}
            />
            Focus neighbors
          </label>
        </fieldset>
        {layout === "communities" && (
          <label>
            Community resolution
            <select
              aria-label="Community resolution"
              value={resolution}
              onChange={(event) => onResolution(Number(event.target.value))}
            >
              <option value={0.5}>Coarse · 0.5</option>
              <option value={1}>Balanced · 1</option>
              <option value={2}>Fine · 2</option>
            </select>
          </label>
        )}
        <Button
          variant="graphTool"
          disabled={layout === "layered"}
          onClick={onSeed}
        >
          <RotateCcw size={14} aria-hidden="true" />
          New seed
        </Button>
      </GraphDisclosure>
      <div className="graph-expansion-actions">
        <PreviewCard content="Reveal activity from all captured conversations.">
          <Button variant="graphTool" onClick={onExpandAll}>
            <Expand size={15} aria-hidden="true" />
            Expand all
          </Button>
        </PreviewCard>
        <Button variant="graphTool" onClick={onOverview}>
          Overview
        </Button>
      </div>
    </div>
  );
}
