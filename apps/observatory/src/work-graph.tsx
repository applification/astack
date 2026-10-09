import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Button, PreviewCard, PreviewProvider } from "@astack/ui";
import { Info, Maximize2, Minus, Plus } from "lucide-react";
import {
  WorkGraphControls,
  defaultNetworkFilters,
} from "./work-graph-controls";
import {
  networkItemLabels,
  relationshipDescriptions,
  type NetworkSelection,
} from "./work-network-presentation";
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

export function WorkGraph({
  network,
  selected,
  onSelect,
  inspector,
  expanded,
  onExpanded,
}: {
  network: WorkNetwork;
  selected: NetworkSelection | null;
  onSelect: (selection: NetworkSelection) => void;
  inspector: ReactNode;
  expanded: ReadonlySet<string>;
  onExpanded: (expanded: Set<string>) => void;
}) {
  const [layout, setLayout] = useState<NetworkLayout>("force");
  const [seed, setSeed] = useState(1);
  const [resolution, setResolution] = useState(1);
  const [filters, setFilters] = useState<NetworkFilters>(defaultNetworkFilters);
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
  const selectedNode = selected?.kind === "node" ? selected.id : null;
  const selectedEdge =
    selected?.kind === "edge"
      ? view.edges.find((edge) => edge.id === selected.id)
      : null;
  const selectedVisible =
    !!selectedEdge || view.nodes.some((node) => node.id === selectedNode);
  const neighbors = new Set(
    selectedEdge
      ? [selectedEdge.from, selectedEdge.to]
      : view.edges
          .filter(
            (edge) => edge.from === selectedNode || edge.to === selectedNode,
          )
          .flatMap((edge) => [edge.from, edge.to]),
  );
  if (selectedVisible && selectedNode) neighbors.add(selectedNode);
  const labelPositions = positionNetworkLabels(
    view.nodes
      .filter(
        (node) =>
          labels ||
          node.id === selectedNode ||
          neighbors.has(node.id) ||
          ["conversation", "contribution", "result"].includes(node.item.kind),
      )
      .sort(
        (a, b) =>
          Number(b.id === selectedNode) - Number(a.id === selectedNode) ||
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
      (event.target instanceof Element &&
        event.target.closest("[data-work-id], [data-edge-id]"))
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
  const revealFocusedItem = (event: FocusEvent<SVGSVGElement>) => {
    const target = event.target;
    if (
      !(target instanceof SVGGElement) ||
      !target.matches("[data-work-id], [data-edge-id]") ||
      !target.matches(":focus-visible")
    )
      return;
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const panel = canvas.parentElement
      ?.querySelector(".graph-inspector")
      ?.getBoundingClientRect();
    // Narrow inspection stacks below the graph and does not cover its targets.
    if (!panel || panel.top >= bounds.bottom || panel.left >= bounds.right)
      return;
    const circle = target.querySelector("circle");
    const path = target.querySelector<SVGPathElement>(".work-network-edge");
    const matrix = canvas.getScreenCTM();
    if (!matrix) return;
    let item: { left: number; right: number; top: number; bottom: number };
    if (circle) item = circle.getBoundingClientRect();
    else if (path) {
      const point = path.getPointAtLength(path.getTotalLength() / 2);
      const pathMatrix = path.getScreenCTM();
      if (!pathMatrix) return;
      const center = new DOMPoint(point.x, point.y).matrixTransform(pathMatrix);
      item = {
        left: center.x - 12,
        right: center.x + 12,
        top: center.y - 12,
        bottom: center.y + 12,
      };
    } else return;
    const header = canvas.ownerDocument
      .querySelector(".app-header")
      ?.getBoundingClientRect();
    const viewportWindow = canvas.ownerDocument.defaultView;
    const left = Math.max(0, bounds.left) + 16,
      right = Math.min(panel.left, viewportWindow?.innerWidth ?? panel.left) - 16,
      top = Math.max(0, bounds.top, header?.bottom ?? 0) + 16,
      bottom =
        Math.min(bounds.bottom, viewportWindow?.innerHeight ?? bounds.bottom) - 16;
    const dx =
      item.right > right
        ? item.right - right
        : item.left < left
          ? item.left - left
          : 0;
    const dy =
      item.bottom > bottom
        ? item.bottom - bottom
        : item.top < top
          ? item.top - top
          : 0;
    // Move the focused target into the exposed canvas without changing zoom.
    if (dx || dy)
      updateBox({ ...box, x: box.x + dx / matrix.a, y: box.y + dy / matrix.d });
  };
  const groups = network.nodes.filter(
    (node) => node.item.kind === "conversation",
  );
  const kinds = new Set(view.nodes.map((node) => node.item.kind));
  return (
    <PreviewProvider>
      <div className="work-network-panel">
        <WorkGraphControls
          layout={layout}
          onLayout={setLayout}
          filters={filters}
          onFilters={setFilters}
          labels={labels}
          onLabels={setLabels}
          focus={focus}
          onFocus={setFocus}
          canFocus={selectedVisible}
          resolution={resolution}
          onResolution={setResolution}
          onSeed={() => setSeed(seed + 1)}
          onExpandAll={() => onExpanded(new Set(groups.map((node) => node.id)))}
          onOverview={() => onExpanded(new Set())}
        />
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
            onFocusCapture={revealFocusedItem}
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
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  className="work-network-arrow"
                />
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
              const source = network.nodes.find(
                (node) => node.id === edge.from,
              );
              const destination = network.nodes.find(
                (node) => node.id === edge.to,
              );
              const path = `M ${startX} ${startY} Q ${(startX + endX) / 2 - (dy / distance) * bend} ${(startY + endY) / 2 + (dx / distance) * bend} ${endX} ${endY}`;
              return (
                <PreviewCard
                  key={edge.id}
                  content={
                    <>
                      <span className="graph-preview-kind">Relationship</span>
                      <strong>{networkEdgeLabels[edge.kind]}</strong>
                      <p>
                        {source?.title} → {destination?.title}
                      </p>
                      <p className="graph-preview-summary">
                        {relationshipDescriptions[edge.kind]}
                      </p>
                      <span className="graph-preview-hint">
                        Select to inspect supporting capture
                      </span>
                    </>
                  }
                >
                  <g
                    role="button"
                    tabIndex={0}
                    className="work-network-relationship"
                    aria-label={`Inspect relationship: ${networkEdgeLabels[edge.kind]} · ${source?.title ?? "Source"} → ${destination?.title ?? "Destination"}`}
                    aria-pressed={selectedEdge?.id === edge.id}
                    data-edge-id={edge.id}
                    data-work-edge={edge.kind}
                    data-work-from={edge.from}
                    data-work-to={edge.to}
                    onClick={() => onSelect({ kind: "edge", id: edge.id })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect({ kind: "edge", id: edge.id });
                      }
                    }}
                  >
                    <path
                      className="work-network-hit"
                      d={path}
                      vectorEffect="non-scaling-stroke"
                    />
                    <path
                      className="work-network-edge"
                      vectorEffect="non-scaling-stroke"
                      data-edge-kind={edge.kind}
                      data-muted={muted(edge.from) || muted(edge.to)}
                      data-highlighted={
                        selectedVisible &&
                        (selectedEdge
                          ? selectedEdge.id === edge.id
                          : edge.from === selectedNode ||
                            edge.to === selectedNode)
                      }
                      d={path}
                      markerEnd={`url(#${id}-arrow)`}
                    />
                  </g>
                </PreviewCard>
              );
            })}
            {view.nodes.map((node) => {
              const point = geometry.positions.get(node.id);
              if (!point) return null;
              const label = labelPositions.get(node.id);
              return (
                <PreviewCard
                  key={node.id}
                  content={
                    <>
                      <span className="graph-preview-kind">
                        {networkItemLabels[node.item.kind]}
                      </span>
                      <strong>{node.title}</strong>
                      <p>{node.status}</p>
                      <p className="graph-preview-summary">{node.summary}</p>
                      <span className="graph-preview-hint">
                        Select to inspect evidence and connected capture
                      </span>
                    </>
                  }
                >
                  <g
                    transform={`translate(${point.x} ${point.y})`}
                    role="button"
                    tabIndex={0}
                    aria-label={"Inspect " + node.title}
                    aria-pressed={selectedNode === node.id}
                    className="work-network-node"
                    data-work-id={node.id}
                    data-work-kind={node.item.kind}
                    data-status={node.status}
                    data-color={
                      layout === "communities" ? point.community % 6 : undefined
                    }
                    data-muted={muted(node.id)}
                    onClick={() => onSelect({ kind: "node", id: node.id })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect({ kind: "node", id: node.id });
                      }
                    }}
                  >
                    <circle
                      className="work-network-node-hit"
                      r={Math.max(radii.get(node.id) ?? 12, 12 * units)}
                    />
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
                </PreviewCard>
              );
            })}
          </svg>
          <div
            className="graph-canvas-dock"
            role="group"
            aria-label="Graph navigation"
          >
            <PreviewCard content="Zoom in · +">
              <Button
                variant="graphIcon"
                aria-label="Zoom in"
                onClick={() => zoom(0.8)}
              >
                <Plus size={16} aria-hidden="true" />
              </Button>
            </PreviewCard>
            <PreviewCard content="Zoom out · −">
              <Button
                variant="graphIcon"
                aria-label="Zoom out"
                onClick={() => zoom(1.25)}
              >
                <Minus size={16} aria-hidden="true" />
              </Button>
            </PreviewCard>
            <PreviewCard content="Fit graph · 0">
              <Button
                variant="graphIcon"
                aria-label="Fit graph"
                onClick={() => setViewport(null)}
              >
                <Maximize2 size={16} aria-hidden="true" />
              </Button>
            </PreviewCard>
            <PreviewCard
              content={
                <>
                  <strong>Explore captured work</strong>
                  <p>
                    Drag the background to pan. Arrow keys pan the focused
                    canvas; +/− zoom and 0 fits.
                  </p>
                  <p>
                    Tab to a node or relationship for a preview. Enter or Space
                    opens its evidence.
                  </p>
                  <p>
                    Position and node size do not measure time or quality.
                    Community colors group undirected connectivity, not teams or
                    causality.
                  </p>
                </>
              }
            >
              <Button variant="graphIcon" aria-label="Graph help">
                <Info size={16} aria-hidden="true" />
              </Button>
            </PreviewCard>
          </div>
          {inspector}
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
        <p className="graph-canvas-hint" id={id + "-help"}>
          Hover or focus for a preview. Select a node or relationship for
          evidence. Drag to pan.
        </p>
        {layout === "communities" && (
          <p className="graph-canvas-hint">
            Colors group visible connectivity. They do not establish teams or
            causal dependencies.
          </p>
        )}
        {!view.nodes.length && (
          <p role="status" className="notice">
            No nodes match the current view. Reset filters or expand a
            conversation.
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
            The selected item is hidden by the current filters, overview or
            graph limit.{" "}
            {inspector
              ? "Its evidence remains in the inspector."
              : "Show it again to reopen its evidence."}
          </p>
        )}
      </div>
    </PreviewProvider>
  );
}
