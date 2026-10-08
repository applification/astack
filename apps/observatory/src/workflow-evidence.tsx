import { useId, useRef, useState } from "react";
import { Badge, Button } from "@astack/ui";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import {
  buildWorkView,
  type WorkView,
} from "@astack/agent-observability/work-view";
import { WorkEvidenceDetails } from "./work-evidence-details";
import { WorkGraph } from "./work-graph";
import { WorkCard } from "./work-card";

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
          const branchId =
            child?.item.kind === "contribution"
              ? child.item.branch.delegation.id
              : null;
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
                        item.item.result.delegationId === branchId,
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

export function WorkflowEvidence({ detail }: { detail: EvaluationDetail }) {
  const [mode, setMode] = useState<"story" | "graph">("story");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const id = useId();
  const view = buildWorkView(
    detail.workflow,
    detail.runs.map(({ run }) => run),
  );
  const selected = view.nodes.find((node) => node.id === selectedId);
  const select = (nodeId: string) => {
    setSelectedId(nodeId);
    requestAnimationFrame(() => heading.current?.focus());
  };
  const back = () => {
    const target = [
      ...(content.current?.querySelectorAll<HTMLButtonElement>(
        "[data-work-id]",
      ) ?? []),
    ].find((button) => button.dataset.workId === selectedId);
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
            Follow the work, then inspect the evidence behind each step.
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
        <Badge>{detail.workflow.reads.length} skill reads</Badge>
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
            Parent conversation
          </div>
          {mode === "story" ? (
            <WorkStory view={view} selected={selectedId} onSelect={select} />
          ) : (
            <WorkGraph view={view} selected={selectedId} onSelect={select} />
          )}
          <p className="secondary">
            Position groups captured activity; spacing is not elapsed time.
            Completion, result receipt and declared use are separate facts.
          </p>
        </div>
        <aside className="work-inspector" aria-label="Work evidence">
          <div className="work-inspector-heading">
            <h3 tabIndex={-1} ref={heading}>
              {selected?.title ?? "Inspect a step"}
            </h3>
            {selected && (
              <Button variant="ghost" onClick={back}>
                Back to selected step
              </Button>
            )}
          </div>
          {selected ? (
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
