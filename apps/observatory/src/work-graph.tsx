import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { Button } from "@astack/ui";
import {
  visibleWorkNetwork,
  networkEdgeLabels,
  type WorkNetwork,
  type NetworkFilters,
} from "@astack/agent-observability/work-network";
import {
  layoutWorkNetwork,
  positionNetworkLabels,
  type NetworkLayout,
  type ViewBox,
} from "./work-network-layout";

const layouts = [
  { id: "force", label: "Force" },
  { id: "communities", label: "Communities" },
  { id: "layered", label: "Layered" },
] as const;
export function WorkGraph({
  network,
  selected,
  onSelect,
  expanded,
  onExpanded,
}: {
  network: WorkNetwork;
  selected: string | null;
  onSelect: (id: string) => void;
  expanded: ReadonlySet<string>;
  onExpanded: (expanded: Set<string>) => void;
}) {
  const [layout, setLayout] = useState<NetworkLayout>("force");
  const [seed, setSeed] = useState(1);
  const [resolution, setResolution] = useState(1);
  const [filters, setFilters] = useState<NetworkFilters>({
    activity: true,
    skills: true,
    evidence: true,
    lens: "all",
  });
  const [labels, setLabels] = useState(false);
  const [focus, setFocus] = useState(false);
  const [viewport, setViewport] = useState<{
    key: string;
    box: ViewBox;
  } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ width: 800, height: 610 });
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0)
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const gesture = useRef<{ x: number; y: number; box: ViewBox } | null>(null);
  const id = useId();
  const view = useMemo(
    () => visibleWorkNetwork(network, expanded, filters),
    [network, expanded, filters],
  );
  const geometry = useMemo(
    () => layoutWorkNetwork(view, layout, seed, resolution),
    [view, layout, seed, resolution],
  );
  const key = useMemo(
    () =>
      JSON.stringify([
        view.nodes.map((node) => node.id),
        layout,
        seed,
        resolution,
      ]),
    [view, layout, seed, resolution],
  );
  const box = viewport?.key === key ? viewport.box : geometry.fit;
  const units = Math.max(box.width / size.width, box.height / size.height);
  const radii = new Map(
    view.nodes.map((node) => [
      node.id,
      Math.max(
        geometry.positions.get(node.id)?.radius ?? 12,
        units *
          (node.item.kind === "conversation"
            ? 16
            : node.item.kind === "contribution"
              ? 13
              : 7),
      ),
    ]),
  );
  const selectedVisible = view.nodes.some((node) => node.id === selected);
  const neighbors = new Set(
    view.edges
      .filter((edge) => edge.from === selected || edge.to === selected)
      .flatMap((edge) => [edge.from, edge.to]),
  );
  if (selectedVisible && selected) neighbors.add(selected);
  const labelPositions = positionNetworkLabels(
    view.nodes
      .filter(
        (node) =>
          labels ||
          node.id === selected ||
          neighbors.has(node.id) ||
          ["conversation", "contribution", "result"].includes(node.item.kind),
      )
      .sort(
        (a, b) =>
          Number(b.id === selected) - Number(a.id === selected) ||
          Number(neighbors.has(b.id)) - Number(neighbors.has(a.id)),
      ),
    geometry.positions,
    radii,
    units,
    box,
  );
  const muted = (nodeId: string) =>
    focus && selectedVisible && !neighbors.has(nodeId);
  const updateBox = (next: ViewBox) => setViewport({ key, box: next });
  const zoom = (factor: number) => {
    const width = Math.min(
      geometry.fit.width * 3,
      Math.max(geometry.fit.width / 8, box.width * factor),
    );
    const ratio = width / box.width;
    updateBox({
      x: box.x + (box.width * (1 - ratio)) / 2,
      y: box.y + (box.height * (1 - ratio)) / 2,
      width,
      height: box.height * ratio,
    });
  };
  const startPan = (event: PointerEvent<SVGSVGElement>) => {
    if (
      event.button !== 0 ||
      (event.target as Element).closest("[data-work-id]")
    )
      return;
    gesture.current = { x: event.clientX, y: event.clientY, box };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pan = (event: PointerEvent<SVGSVGElement>) => {
    const start = gesture.current,
      element = svg.current;
    if (!start || !element) return;
    const rect = element.getBoundingClientRect();
    const scale = Math.max(
      start.box.width / rect.width,
      start.box.height / rect.height,
    );
    updateBox({
      ...start.box,
      x: start.box.x - (event.clientX - start.x) * scale,
      y: start.box.y - (event.clientY - start.y) * scale,
    });
  };
  const groups = network.nodes.filter(
    (node) => node.item.kind === "conversation",
  );
  const selectedGroup = groups.find((node) => node.id === selected);
  const kinds = new Set(view.nodes.map((node) => node.item.kind));
  return (
    <div className="work-network-panel">
      <div className="work-network-toolbar">
        <div
          role="group"
          aria-label="Graph layout"
          className="work-view-toggle"
        >
          {layouts.map((option) => (
            <Button
              key={option.id}
              variant="outline"
              aria-pressed={layout === option.id}
              onClick={() => setLayout(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <label>
          Relationships
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
                setFilters({ ...filters, lens: value });
            }}
          >
            <option value="all">All captured links</option>
            <option value="delegation">Delegation</option>
            <option value="results">Results and declared use</option>
          </select>
        </label>
        {layout === "communities" && (
          <label>
            Community resolution
            <select
              aria-label="Community resolution"
              value={resolution}
              onChange={(event) => setResolution(Number(event.target.value))}
            >
              <option value={0.5}>Coarse · 0.5</option>
              <option value={1}>Balanced · 1</option>
              <option value={2}>Fine · 2</option>
            </select>
          </label>
        )}
      </div>
      <div
        className="work-network-toolbar"
        role="group"
        aria-label="Graph detail"
      >
        {(["activity", "skills", "evidence"] as const).map((filter) => (
          <Button
            key={filter}
            variant="outline"
            aria-pressed={filters[filter]}
            onClick={() =>
              setFilters({ ...filters, [filter]: !filters[filter] })
            }
          >
            {filter === "activity"
              ? "Activity"
              : filter === "skills"
                ? "Skills"
                : "Evidence"}
          </Button>
        ))}
        <Button
          variant="ghost"
          onClick={() => onExpanded(new Set(groups.map((node) => node.id)))}
        >
          Expand all
        </Button>
        <Button variant="ghost" onClick={() => onExpanded(new Set())}>
          Overview
        </Button>
        {selectedGroup && (
          <Button
            variant="outline"
            aria-expanded={expanded.has(selectedGroup.id)}
            onClick={() => {
              const next = new Set(expanded);
              if (!next.delete(selectedGroup.id)) next.add(selectedGroup.id);
              onExpanded(next);
            }}
          >
            {expanded.has(selectedGroup.id)
              ? "Collapse conversation"
              : "Expand conversation"}
          </Button>
        )}
      </div>
      <div className="work-network-stats" aria-live="polite">
        <span>
          <strong>{view.nodes.length}</strong> visible nodes /{" "}
          {network.nodes.length} captured
        </span>
        <span>
          <strong>{view.edges.length}</strong> links
        </span>
        <span>
          <strong>
            {groups.filter((group) => expanded.has(group.id)).length}
          </strong>{" "}
          expanded scopes
        </span>
        {layout === "communities" && (
          <span>
            <strong>{geometry.communities}</strong> calculated groups
          </span>
        )}
      </div>
      <div className="work-network-canvas" data-network-layout={layout}>
        <svg
          ref={svg}
          className="work-network"
          viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`}
          aria-label="Captured work graph"
          role="group"
          tabIndex={0}
          aria-describedby={id + "-help"}
          onPointerDown={startPan}
          onPointerMove={pan}
          onPointerUp={() => {
            gesture.current = null;
          }}
          onPointerCancel={() => {
            gesture.current = null;
          }}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            const moves: Record<string, [number, number]> = {
              ArrowLeft: [-1, 0],
              ArrowRight: [1, 0],
              ArrowUp: [0, -1],
              ArrowDown: [0, 1],
            };
            const move = moves[event.key];
            if (move) {
              event.preventDefault();
              updateBox({
                ...box,
                x: box.x + (move[0] * box.width) / 10,
                y: box.y + (move[1] * box.height) / 10,
              });
            } else if (event.key === "+" || event.key === "=") {
              event.preventDefault();
              zoom(0.8);
            } else if (event.key === "-") {
              event.preventDefault();
              zoom(1.25);
            } else if (event.key === "0") {
              event.preventDefault();
              setViewport(null);
            }
          }}
        >
          <defs>
            <marker
              id={id + "-arrow"}
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" className="work-network-arrow" />
            </marker>
          </defs>
          {view.edges.map((edge) => {
            const from = geometry.positions.get(edge.from),
              to = geometry.positions.get(edge.to);
            if (!from || !to) return null;
            const dx = to.x - from.x,
              dy = to.y - from.y,
              distance = Math.max(1, Math.hypot(dx, dy));
            const startX =
                from.x +
                (dx / distance) *
                  ((radii.get(edge.from) ?? from.radius) + 3 * units),
              startY =
                from.y +
                (dy / distance) *
                  ((radii.get(edge.from) ?? from.radius) + 3 * units);
            const endX =
                to.x -
                (dx / distance) *
                  ((radii.get(edge.to) ?? to.radius) + 7 * units),
              endY =
                to.y -
                (dy / distance) *
                  ((radii.get(edge.to) ?? to.radius) + 7 * units);
            const bend =
              edge.kind === "declared_use" || edge.kind === "unresolved_use"
                ? 20
                : 0;
            return (
              <path
                key={edge.id}
                className="work-network-edge"
                vectorEffect="non-scaling-stroke"
                data-work-edge={edge.kind}
                data-work-from={edge.from}
                data-work-to={edge.to}
                data-muted={muted(edge.from) || muted(edge.to)}
                data-highlighted={
                  selectedVisible &&
                  (edge.from === selected || edge.to === selected)
                }
                d={`M ${startX} ${startY} Q ${(startX + endX) / 2 - (dy / distance) * bend} ${(startY + endY) / 2 + (dx / distance) * bend} ${endX} ${endY}`}
                markerEnd={`url(#${id}-arrow)`}
              >
                <title>{networkEdgeLabels[edge.kind]}</title>
              </path>
            );
          })}
          {view.nodes.map((node) => {
            const point = geometry.positions.get(node.id);
            if (!point) return null;
            const label = labelPositions.get(node.id);
            return (
              <g
                key={node.id}
                transform={`translate(${point.x} ${point.y})`}
                role="button"
                tabIndex={0}
                aria-label={"Inspect " + node.title}
                aria-pressed={selected === node.id}
                className="work-network-node"
                data-work-id={node.id}
                data-work-kind={node.item.kind}
                data-status={node.status}
                data-color={
                  layout === "communities" ? point.community % 6 : undefined
                }
                data-muted={muted(node.id)}
                onClick={() => onSelect(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(node.id);
                  }
                }}
              >
                <title>
                  {node.title + " · " + node.status + " · " + node.summary}
                </title>
                <circle
                  r={radii.get(node.id)}
                  vectorEffect="non-scaling-stroke"
                />
                {node.item.kind === "conversation" && (
                  <text
                    className="work-network-glyph"
                    textAnchor="middle"
                    dy={5 * units}
                    fontSize={14 * units}
                  >
                    {expanded.has(node.id) ? "−" : "+"}
                  </text>
                )}
                {label && (
                  <text
                    className="work-network-label"
                    textAnchor={label.anchor}
                    x={label.x}
                    y={label.y}
                    fontSize={11 * units}
                    strokeWidth={3 * units}
                  >
                    {label.text}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div
        className="work-network-toolbar"
        role="group"
        aria-label="Graph navigation"
      >
        <Button
          variant="outline"
          onClick={() => zoom(0.8)}
          aria-label="Zoom in"
        >
          +
        </Button>
        <Button
          variant="outline"
          onClick={() => zoom(1.25)}
          aria-label="Zoom out"
        >
          −
        </Button>
        <Button variant="ghost" onClick={() => setViewport(null)}>
          Fit graph
        </Button>
        <Button
          variant="ghost"
          disabled={layout === "layered"}
          onClick={() => setSeed(seed + 1)}
        >
          New seed
        </Button>
        <Button
          variant="outline"
          aria-pressed={labels}
          onClick={() => setLabels(!labels)}
        >
          More labels
        </Button>
        <Button
          variant="outline"
          aria-pressed={focus}
          disabled={!selectedVisible}
          onClick={() => setFocus(!focus)}
        >
          Focus neighbors
        </Button>
      </div>
      <div
        className="work-network-legend"
        aria-label="Graph legend"
        data-community={layout === "communities"}
      >
        {[...kinds].map((kind) => (
          <span key={kind} data-work-kind={kind}>
            {kind === "record"
              ? "Declaration"
              : kind.replace(/^./, (letter) => letter.toUpperCase())}
          </span>
        ))}
        <span data-link-kind="use">Dashed: declared use</span>
        <span data-link-kind="observation">
          Dotted: host observation / receipt
        </span>
      </div>
      <p className="secondary" id={id + "-help"}>
        Drag the background to pan. Tab to inspect nodes; use arrow keys on the
        canvas to pan, +/− to zoom and 0 to fit. Expand a selected conversation
        to reveal its captured activity. Position and node size do not measure
        time or quality.
      </p>
      {layout === "communities" && (
        <p className="secondary">
          Colors group visible connectivity, treating links as undirected.
          Calculated groups do not establish teams, ownership or causal
          dependencies.
        </p>
      )}
      {view.displayLimited && (
        <p role="status" className="notice">
          Graph display is limited to 360 nodes. Use fewer expanded
          conversations or hide detail categories to explore the rest. Full
          traces retain the remaining captured activity.
        </p>
      )}
      {selected && !selectedVisible && (
        <p role="status" className="notice">
          The selected node is hidden by the current filters, overview or graph
          limit. Its evidence remains in the inspector.
        </p>
      )}
    </div>
  );
}
