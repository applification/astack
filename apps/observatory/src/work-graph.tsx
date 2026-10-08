import { useId } from "react";
import type { WorkView } from "@astack/agent-observability/work-view";
import { WorkCard } from "./work-card";

type Position = { x: number; y: number };
const width = 830,
  cardWidth = 310,
  cardHeight = 142,
  rowHeight = 190;
const labels = {
  sequence: "Parent activity order",
  delegation: "Task dispatched",
  result: "Host result observation",
  use: "Parent declared use",
  unresolved_use: "Use declared; evidence unavailable",
};

export function WorkGraph({
  view,
  selected,
  onSelect,
}: {
  view: WorkView;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const marker = useId().replace(/:/g, "");
  const positions = new Map<string, Position>();
  let row = 0;
  for (const id of view.main) {
    positions.set(id, { x: 35, y: 55 + row++ * rowHeight });
    const dispatch = view.nodes.find((node) => node.id === id);
    if (dispatch?.item.kind === "dispatch") {
      const taskId = dispatch.item.branch.delegation.id;
      positions.set("child:" + taskId, {
        x: 465,
        y: positions.get(id)?.y ?? 55,
      });
      for (const node of view.nodes) {
        if (
          node.item.kind === "result" &&
          node.item.result.delegationId === taskId
        )
          positions.set(node.id, { x: 35, y: 55 + row++ * rowHeight });
      }
    }
  }
  let extra = row;
  view.nodes.forEach((node) => {
    if (positions.has(node.id)) return;
    const dispatch = view.edges.find(
      (edge) => edge.kind === "delegation" && edge.to === node.id,
    );
    const origin = dispatch ? positions.get(dispatch.from) : null;
    positions.set(node.id, {
      x: 465,
      y: origin?.y ?? 55 + extra++ * rowHeight,
    });
  });
  const height = Math.max(260, 55 + extra * rowHeight);
  return (
    <>
      <p className="secondary" id={marker + "help"}>
        Parent activity runs down the left. Child conversations sit beside their
        own dispatch. Solid return lines mark host result observations; dashed
        lines mark declared use. Observations are grouped with their task; their
        placement does not date delivery. Scroll to explore; select any card for
        evidence.
      </p>
      <div
        className="work-graph-scroll workflow-map-scroll"
        role="region"
        aria-label="Work graph"
        aria-describedby={marker + "help"}
        tabIndex={0}
      >
        <svg
          className="work-graph"
          width={width}
          height={height}
          role="group"
          aria-label="Captured work graph"
        >
          <defs>
            <marker
              id={marker}
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" className="work-arrow" />
            </marker>
          </defs>
          <g aria-hidden="true">
            <text x="35" y="25" className="work-graph-label">
              PARENT CONVERSATION
            </text>
            <text x="465" y="25" className="work-graph-label">
              DELEGATED CONVERSATIONS
            </text>
            {view.edges.map((edge) => {
              const from = positions.get(edge.from),
                to = positions.get(edge.to);
              if (!from || !to) return null;
              const a =
                edge.kind === "sequence"
                  ? { x: from.x + cardWidth / 2, y: from.y + cardHeight }
                  : {
                      x: from.x + (from.x < to.x ? cardWidth : 0),
                      y: from.y + cardHeight / 2,
                    };
              const b =
                edge.kind === "sequence"
                  ? { x: to.x + cardWidth / 2, y: to.y }
                  : {
                      x: to.x + (to.x < from.x ? cardWidth : 0),
                      y: to.y + cardHeight / 2,
                    };
              const d =
                edge.kind === "sequence"
                  ? b.y - a.y > rowHeight
                    ? `M ${a.x} ${a.y} L 15 ${a.y + 12} L 15 ${b.y - 12} L ${b.x} ${b.y}`
                    : `M ${a.x} ${a.y} L ${b.x} ${b.y}`
                  : `M ${a.x} ${a.y} C 405 ${a.y}, 405 ${b.y}, ${b.x} ${b.y}`;
              return (
                <path
                  key={edge.id}
                  d={d}
                  className="work-graph-edge"
                  data-work-edge={edge.kind}
                  data-from={edge.from}
                  data-to={edge.to}
                  data-muted={
                    selected && edge.from !== selected && edge.to !== selected
                      ? "true"
                      : undefined
                  }
                  markerEnd={"url(#" + marker + ")"}
                >
                  <title>{labels[edge.kind]}</title>
                </path>
              );
            })}
          </g>
          {view.nodes.map((node) => {
            const position = positions.get(node.id);
            return position ? (
              <foreignObject
                key={node.id}
                x={position.x}
                y={position.y}
                width={cardWidth}
                height={cardHeight}
                data-map-main={view.main.includes(node.id) ? "" : undefined}
              >
                <WorkCard
                  node={node}
                  selected={selected}
                  onSelect={onSelect}
                  graph
                />
              </foreignObject>
            ) : null;
          })}
        </svg>
      </div>
    </>
  );
}
