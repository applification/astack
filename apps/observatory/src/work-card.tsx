import { Button } from "@astack/ui";
import type { WorkNode } from "@astack/agent-observability/work-view";
export function WorkCard({
  node,
  selected,
  onSelect,
  graph = false,
}: {
  node: WorkNode;
  selected: string | null;
  onSelect: (id: string) => void;
  graph?: boolean;
}) {
  return (
    <Button
      variant={graph ? "workGraph" : "workCard"}
      data-work-id={node.id}
      data-work-kind={node.item.kind}
      aria-label={"Inspect " + node.title}
      aria-pressed={selected === node.id}
      onClick={() => onSelect(node.id)}
    >
      <span className="work-node-kind">
        {node.item.kind === "contribution"
          ? "Child conversation"
          : node.item.kind === "result"
            ? "Result observation"
            : node.item.kind === "skills"
              ? "Observed reads"
              : "Parent conversation"}
      </span>
      <span className="work-node-title">{node.title}</span>
      <span className="work-node-status">{node.status}</span>
      <span className="work-node-summary">{node.summary}</span>
    </Button>
  );
}
