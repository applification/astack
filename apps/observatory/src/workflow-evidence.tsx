import { Badge } from "@astack/ui";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import { routeDefinitions } from "@astack/agent-observability/workflow";
import {
  workflowFlows,
  type WorkflowRecord,
} from "@astack/agent-observability/workflow-view";
import { runLink } from "./evaluation-evidence";

const phaseLabel = (phase: string) =>
  phase.replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
const statusLabel = {
  started: "Started · no finish recorded",
  completed: "Completed · agent reported",
  failed: "Failed · agent reported",
  omitted: "Omitted",
};

function RecordEvidence({
  record,
  projectId,
}: {
  record: WorkflowRecord;
  projectId: string;
}) {
  const annotation = record.annotation;
  return (
    <section className="workflow-record">
      <p className="secondary">
        {annotation.action === "phase"
          ? phaseLabel(annotation.status)
          : annotation.action === "select"
            ? "Route selected"
            : "Route changed"}
        {" · "}
        {new Date(record.recordedAt).toLocaleString()}
      </p>
      <p>
        {annotation.action === "phase" ? annotation.summary : annotation.reason}
      </p>
      <a href={runLink(record.runId, projectId, record.eventId)}>
        Declaration in trace
      </a>
      {record.evidence.length > 0 ? (
        <ul className="workflow-evidence-links">
          {record.evidence.map((item) => (
            <li key={item.reference.eventId}>
              {item.state === "available" ? (
                <>
                  <a
                    href={runLink(
                      item.reference.runId,
                      projectId,
                      item.reference.eventId,
                    )}
                  >
                    {item.title || item.kind}
                  </a>
                  <span className="secondary">
                    {item.kind.replace(/_/g, " ")} · capture revision{" "}
                    {item.revision}
                  </span>
                </>
              ) : (
                <span className="secondary">{item.reason}</span>
              )}
            </li>
          ))}
        </ul>
      ) : annotation.action === "phase" ? (
        <p className="secondary">
          No supporting trace references supplied for this transition.
        </p>
      ) : null}
    </section>
  );
}

export function WorkflowEvidence({
  detail,
  view,
}: {
  detail: EvaluationDetail;
  view: "selection" | "path";
}) {
  const flows = workflowFlows(detail.workflow.records);
  return (
    <section
      aria-label={view === "selection" ? "Astack approach" : "Astack workflow"}
      className="workflow-section"
    >
      <h2>{view === "selection" ? "Astack approach" : "Path taken"}</h2>
      {!flows.length && view === "selection" && (
        <p className="subtitle">
          Flow not recorded in the linked readable capture. Recorded skill reads
          are available in the turn details below.
        </p>
      )}
      {flows.map((flow) => {
        const selected = flow.selection?.annotation;
        const changes = flow.nodes.flatMap((node) =>
          node.kind === "route" && node.record.annotation.action === "change"
            ? [node.record.annotation]
            : [],
        );
        const latest =
          changes.at(-1) ?? (selected?.action === "select" ? selected : null);
        return (
          <section key={flow.id}>
            {view === "selection" ? (
              <div className="workflow-selection">
                <div className="tag-list">
                  <Badge>
                    astack →{" "}
                    {selected?.action === "select"
                      ? routeDefinitions[selected.route].label
                      : "Route not recorded"}
                  </Badge>
                  {changes.length > 0 && latest && (
                    <Badge>Now: {routeDefinitions[latest.route].label}</Badge>
                  )}
                </div>
                <p>
                  {selected?.action === "select"
                    ? selected.reason
                    : "The selection is missing from this capture; the recorded phases follow."}
                </p>
                {selected?.action === "select" && (
                  <p className="secondary">
                    Planned:{" "}
                    {selected.plannedPhases.map(phaseLabel).join(" → ")}
                  </p>
                )}
                {flow.selection && (
                  <details>
                    <summary>Route selection evidence</summary>
                    <RecordEvidence
                      record={flow.selection}
                      projectId={detail.evaluation.projectId}
                    />
                  </details>
                )}
              </div>
            ) : (
              <>
                {flows.length > 1 && (
                  <h3>
                    {selected?.action === "select"
                      ? routeDefinitions[selected.route].label
                      : "Route not recorded"}
                  </h3>
                )}
                {!flow.nodes.length && (
                  <p className="subtitle">No phase transitions recorded yet.</p>
                )}
                <ol className="astack-flow">
                  {flow.nodes.map((node) => {
                    if (node.kind === "route") {
                      const annotation = node.record.annotation;
                      return annotation.action === "change" ? (
                        <li key={node.record.eventId}>
                          <h4>
                            Changed route →{" "}
                            {routeDefinitions[annotation.route].label}
                          </h4>
                          <p>{annotation.reason}</p>
                          <p className="secondary">
                            Revised plan:{" "}
                            {annotation.plannedPhases
                              .map(phaseLabel)
                              .join(" → ")}
                          </p>
                          <details>
                            <summary>View route change</summary>
                            <RecordEvidence
                              record={node.record}
                              projectId={detail.evaluation.projectId}
                            />
                          </details>
                        </li>
                      ) : null;
                    }
                    const first = node.records[0];
                    const last = node.records.at(-1);
                    const summary =
                      last?.annotation.action === "phase"
                        ? last.annotation.summary
                        : null;
                    const skills = [
                      ...new Set(
                        node.records.flatMap((record) =>
                          record.annotation.action === "phase"
                            ? record.annotation.skills
                            : [],
                        ),
                      ),
                    ];
                    return (
                      <li key={first?.eventId}>
                        <div className="workflow-phase-heading">
                          <h4>{phaseLabel(node.phase)}</h4>
                          <span
                            className={
                              node.status === "failed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            <Badge>{statusLabel[node.status]}</Badge>
                          </span>
                        </div>
                        {summary && <p>{summary}</p>}
                        {skills.length > 0 && (
                          <p className="secondary">
                            Declared skills: {skills.join(" · ")}
                          </p>
                        )}
                        <details>
                          <summary>View phase evidence</summary>
                          <div className="evaluation-step-evidence">
                            {node.route && (
                              <p className="secondary">
                                Route at this phase:{" "}
                                {routeDefinitions[node.route].label}
                              </p>
                            )}
                            {node.records.map((record) => (
                              <RecordEvidence
                                key={record.eventId}
                                record={record}
                                projectId={detail.evaluation.projectId}
                              />
                            ))}
                            <p className="secondary">
                              Declarations and skill reads do not establish
                              application. Inspect the linked actions, outputs
                              and verification results.
                            </p>
                          </div>
                        </details>
                      </li>
                    );
                  })}
                </ol>
              </>
            )}
          </section>
        );
      })}
      {view === "path" && detail.workflow.truncated && (
        <p role="status" className="notice">
          Workflow capture or evidence previews reached the display limit.
          Inspect the linked full traces for the remaining activity.
        </p>
      )}
      {view === "path" && flows.length > 0 && (
        <p className="secondary">
          Agent declarations and supporting references from current capture.
          Flow assessment and outcome checks remain separate.
        </p>
      )}
    </section>
  );
}
