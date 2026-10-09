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
import { buildWorkNetwork } from "@astack/agent-observability/work-network";
import { WorkNetworkDetails } from "./work-network-details";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const select = (nodeId: string) => {
    setSelectedId(nodeId);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const back = () => {
    const target = [
      ...(content.current?.querySelectorAll<HTMLButtonElement | SVGElement>(
        "[data-work-id]",
      ) ?? []),
    ].find(
      (button) =>
        button.dataset.workId ===
          (mode === "graph" ? networkSelected?.id : selected?.id) &&
        !button.closest("[hidden]"),
    );
    target?.focus();
  };
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
      <div className="work-layout">
        <div ref={content} id={id} className="work-content">
          <div className="work-root" data-map-root="">
            {mode === "graph"
              ? "Captured relationships"
              : "Parent conversation"}
          </div>
          <div hidden={mode !== "story"}>
            <WorkStory
              view={view}
              selected={selected?.id ?? null}
              onSelect={select}
            />
          </div>
          <div hidden={mode !== "graph"}>
            <WorkGraph
              network={network}
              selected={networkSelected?.id ?? null}
              onSelect={select}
              expanded={expanded}
              onExpanded={setExpanded}
            />
          </div>
          <p className="secondary">
            Position groups captured activity; spacing is not elapsed time.
            Completion, result receipt and declared use are separate facts.
          </p>
        </div>
        <aside className="work-inspector" aria-label="Work evidence">
          <div className="work-inspector-heading">
            <h3 tabIndex={-1} ref={heading}>
              {(mode === "graph" ? networkSelected?.title : selected?.title) ??
                "Inspect a step"}
            </h3>
            {(selected || networkSelected) && (
              <Button variant="ghost" onClick={back}>
                Back to selected step
              </Button>
            )}
          </div>
          {mode === "graph" && networkSelected ? (
            <WorkNetworkDetails
              node={networkSelected}
              network={network}
              detail={detail}
              onSelect={select}
              expanded={expanded}
              onExpanded={setExpanded}
            />
          ) : selected ? (
            <WorkEvidenceDetails node={selected} detail={detail} />
          ) : (
            <p className="secondary">
              {selectedId
                ? "This step is no longer available in the current bounded capture. Select another step."
                : "Select a parent step or child contribution to see its status, declarations and linked trace evidence."}
            </p>
          )}
        </aside>
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
