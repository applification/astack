import { useId, useMemo, useRef, useState } from "react";
import { Badge, Button } from "@astack/ui";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import {
  buildWorkView,
  type WorkView,
} from "@astack/agent-observability/work-view";
import { WorkEvidenceDetails } from "./work-evidence-details";
import { WorkGraph } from "./work-graph";
import { WorkCard } from "./work-card";
import { X } from "lucide-react";
import {
  networkItemLabels,
  type NetworkSelection,
} from "./work-network-presentation";
import {
  buildWorkNetwork,
  networkEdgeLabels,
} from "@astack/agent-observability/work-network";
import {
  WorkNetworkDetails,
  WorkRelationshipDetails,
} from "./work-network-details";
import { branchOwnsRun } from "@astack/agent-observability/workflow-view";

function WorkStory({
  view,
  selected,
  onSelect,
}: {
  view: WorkView;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const nodes = new Map(view.nodes.map((node) => [node.id, node]));
  const skills = view.nodes.filter((node) => node.item.kind === "skills");
  return (
    <>
      <ol className="work-story" aria-label="Captured work story">
        {view.main.map((id) => {
          const node = nodes.get(id);
          if (!node) return null;
          const childEdge = view.edges.find(
            (edge) => edge.from === id && edge.kind === "delegation",
          );
          const child = childEdge ? nodes.get(childEdge.to) : null;
          const branch =
            child?.item.kind === "contribution" ? child.item.branch : null;
          return (
            <li
              key={id}
              data-story-step={id}
              data-map-main=""
              className={
                child
                  ? "work-story-row work-story-delegation"
                  : "work-story-row"
              }
            >
              <WorkCard node={node} selected={selected} onSelect={onSelect} />
              {child && (
                <div className="work-contribution">
                  <WorkCard
                    node={child}
                    selected={selected}
                    onSelect={onSelect}
                  />
                  {view.nodes
                    .filter(
                      (item) =>
                        item.item.kind === "result" &&
                        branch &&
                        item.item.result.delegationId ===
                          branch.delegation.id &&
                        branchOwnsRun(branch, item.item.result.reference.runId),
                    )
                    .map((result) => (
                      <Button
                        key={result.id}
                        variant="ghost"
                        data-work-id={result.id}
                        data-work-kind="result"
                        aria-label={"Inspect " + result.title}
                        aria-pressed={selected === result.id}
                        onClick={() => onSelect(result.id)}
                      >
                        {result.title}
                      </Button>
                    ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {skills.map((node) => (
        <div className="work-skills-card" key={node.id}>
          <WorkCard node={node} selected={selected} onSelect={onSelect} />
        </div>
      ))}
    </>
  );
}

export function WorkflowEvidence({
  detail,
  initialMode = "story",
}: {
  detail: EvaluationDetail;
  initialMode?: "story" | "graph";
}) {
  const [mode, setMode] = useState<"story" | "graph">(initialMode);
  const [selection, setSelection] = useState<NetworkSelection | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const selectedId = selection?.kind === "node" ? selection.id : null;
  const [expanded, setExpanded] = useState(new Set<string>());
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const id = useId();
  const view = useMemo(
    () =>
      buildWorkView(
        detail.workflow,
        detail.runs.map(({ run }) => run),
      ),
    [detail.workflow, detail.runs],
  );
  const network = useMemo(
    () => buildWorkNetwork(detail.workflow, detail.runs),
    [detail.workflow, detail.runs],
  );
  const networkSelected = network.nodes.find(
    (node) => node.id === selectedId || node.storyId === selectedId,
  );
  const selected = view.nodes.find(
    (node) => node.id === selectedId || node.id === networkSelected?.storyId,
  );
  const edge =
    selection?.kind === "edge"
      ? network.edges.find((edge) => edge.id === selection.id)
      : null;
  const graphSelection: NetworkSelection | null = networkSelected
    ? { kind: "node", id: networkSelected.id }
    : selection;
  const select = (next: NetworkSelection) => {
    setSelection(next);
    setPanelOpen(true);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const selectNode = (id: string) => select({ kind: "node", id });
  const selectEdge = (id: string) => select({ kind: "edge", id });
  const back = () => {
    if (mode === "graph") setPanelOpen(false);
    requestAnimationFrame(() => {
      const target = [
        ...(content.current?.querySelectorAll<HTMLButtonElement | SVGElement>(
          "[data-work-id], [data-edge-id]",
        ) ?? []),
      ].find(
        (element) =>
          !element.closest("[hidden]") &&
          (selection?.kind === "edge"
            ? element.dataset.edgeId === selection.id
            : element.dataset.workId ===
              (mode === "graph" ? networkSelected?.id : selected?.id)),
      );
      if (target) target.focus();
      else if (mode === "graph")
        content.current?.querySelector<SVGSVGElement>(".work-network")?.focus();
      else content.current?.focus();
    });
  };
  const inspector = (
    <aside
      className={
        mode === "graph" ? "work-inspector graph-inspector" : "work-inspector"
      }
      aria-label="Work evidence"
      onKeyDown={(event) => {
        if (
          event.key === "Escape" &&
          !event.defaultPrevented &&
          mode === "graph"
        ) {
          event.preventDefault();
          back();
        }
      }}
    >
      <div className="work-inspector-heading">
        <div className="graph-inspector-topline">
          <span className="work-node-kind">
            {edge
              ? "Relationship"
              : networkSelected
                ? networkItemLabels[networkSelected.item.kind]
                : "Evidence"}
          </span>
          {mode === "graph" && (
            <Button
              variant="graphIcon"
              aria-label="Close inspection"
              onClick={back}
            >
              <X size={16} aria-hidden="true" />
            </Button>
          )}
        </div>
        <h3 tabIndex={-1} ref={heading}>
          {edge
            ? networkEdgeLabels[edge.kind]
            : mode === "story" && selected
              ? selected.title
              : (networkSelected?.title ?? selected?.title ?? "Inspect a step")}
        </h3>
        {mode === "story" && (selected || networkSelected || edge) && (
          <Button
            variant="ghost"
            onClick={back}
          >
            Back to selected step
          </Button>
        )}
      </div>
      {edge ? (
        <WorkRelationshipDetails
          edge={edge}
          network={network}
          detail={detail}
          onSelect={selectNode}
          onSelectEdge={selectEdge}
          expanded={expanded}
          onExpanded={setExpanded}
        />
      ) : networkSelected && (mode === "graph" || !selected) ? (
        <WorkNetworkDetails
          node={networkSelected}
          network={network}
          detail={detail}
          onSelect={selectNode}
          onSelectEdge={selectEdge}
          expanded={expanded}
          onExpanded={setExpanded}
        />
      ) : selected ? (
        <WorkEvidenceDetails node={selected} detail={detail} />
      ) : (
        <p className="secondary">
          {selection
            ? "This selection is no longer available in the current bounded capture. Select another item."
            : "Select a parent step or child contribution to see its status, declarations and linked trace evidence."}
        </p>
      )}
    </aside>
  );
  const phases = detail.workflow.records.some(
    (record) => record.annotation.action === "phase",
  );
  return (
    <section aria-label="Astack workflow" className="workflow-section">
      <div className="work-heading">
        <div>
          <h2>Captured work</h2>
          <p className="secondary">
            Read the work story or explore captured relationships and evidence.
          </p>
        </div>
        <div className="work-view-toggle" role="group" aria-label="Work view">
          <Button
            variant="outline"
            aria-pressed={mode === "story"}
            aria-controls={id}
            onClick={() => setMode("story")}
          >
            Work story
          </Button>
          <Button
            variant="outline"
            aria-pressed={mode === "graph"}
            aria-controls={id}
            onClick={() => setMode("graph")}
          >
            Graph
          </Button>
        </div>
      </div>
      <div className="work-overview">
        <Badge>{detail.workflow.branches.length} delegated tasks</Badge>
        <Badge>{detail.workflow.results.length} result observations</Badge>
        <Badge>
          {detail.workflow.reads.length +
            detail.workflow.branches.reduce(
              (count, branch) => count + branch.reads.length,
              0,
            )}{" "}
          skill reads
        </Badge>
      </div>
      {!detail.workflow.records.some(
        (record) => record.annotation.action === "select",
      ) && (
        <p className="secondary">
          Route and phases were not recorded in the linked capture.
          {phases &&
            " Phase declarations are shown below; route selection is unavailable."}
        </p>
      )}
      <div className="work-layout" data-view={mode}>
        <div ref={content} id={id} className="work-content" tabIndex={-1}>
          <div className="work-root" data-map-root="">
            {mode === "graph"
              ? "Captured relationships"
              : "Parent conversation"}
          </div>
          <div hidden={mode !== "story"}>
            <WorkStory
              view={view}
              selected={selected?.id ?? null}
              onSelect={selectNode}
            />
          </div>
          <div hidden={mode !== "graph"}>
            <WorkGraph
              network={network}
              selected={graphSelection}
              onSelect={select}
              inspector={mode === "graph" && panelOpen ? inspector : null}
              expanded={expanded}
              onExpanded={setExpanded}
            />
          </div>
          <p className="secondary">
            Position groups captured activity; spacing is not elapsed time.
            Completion, result receipt and declared use are separate facts.
          </p>
        </div>
        {mode === "story" && inspector}
      </div>
      {detail.workflow.truncated && (
        <p role="status" className="notice">
          Workflow capture or evidence previews reached the display limit.
          Inspect the linked full traces for the remaining activity.
        </p>
      )}
    </section>
  );
}
