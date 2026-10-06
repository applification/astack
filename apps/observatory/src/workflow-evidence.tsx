import { useId, useRef, useState } from "react";
import { Badge, Button } from "@astack/ui";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import { routeDefinitions } from "@astack/agent-observability/workflow";
import {
  workflowFlows,
  type WorkflowFlow,
  type WorkflowNode,
  type WorkflowRecord,
} from "@astack/agent-observability/workflow-view";
import { runLink } from "./evaluation-evidence";
import { SkillBadge, SkillIcon, skillLabel } from "./skill-badge";

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

function declaredSkills(node: Extract<WorkflowNode, { kind: "phase" }>) {
  return [
    ...new Set(
      node.records.flatMap((record) =>
        record.annotation.action === "phase" ? record.annotation.skills : [],
      ),
    ),
  ];
}

type SkillSelection =
  | { kind: "flow"; skill: string }
  | { kind: "phase"; skill: string; eventId: string };

function WorkflowPath({
  flow,
  projectId,
}: {
  flow: WorkflowFlow;
  projectId: string;
}) {
  const [mode, setMode] = useState<"phases" | "sequence">("phases");
  const [selection, setSelection] = useState<SkillSelection | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const evidenceId = useId();
  const phases = flow.nodes.flatMap((node) =>
    node.kind === "phase" ? [node] : [],
  );
  const skills = [...new Set(phases.flatMap(declaredSkills))];
  const selectedRecords = selection
    ? phases
        .filter(
          (node) =>
            selection.kind === "flow" ||
            node.records[0]?.eventId === selection.eventId,
        )
        .flatMap((node) => node.records)
        .filter(
          (record) =>
            record.annotation.action === "phase" &&
            record.annotation.skills.includes(selection.skill),
        )
    : [];
  const skillEvidence = selection && selectedRecords.length > 0 && (
    <section
      id={evidenceId}
      aria-label={skillLabel(selection.skill) + " skill evidence"}
      className="workflow-skill-evidence"
    >
      <div className="workflow-phase-heading">
        <h4 className="skill-evidence-title">
          <SkillIcon name={selection.skill} />
          {skillLabel(selection.skill)}
        </h4>
        <Button
          variant="ghost"
          onClick={() => {
            setSelection(null);
            if (trigger.current?.isConnected) trigger.current.focus();
          }}
          aria-label="Close skill evidence"
        >
          Close
        </Button>
      </div>
      <p className="secondary">
        Recorded name: {selection.skill}. Agent declarations; supporting links
        describe the phase and do not prove a skill invocation.
      </p>
      {selectedRecords.map((record) => (
        <div key={record.eventId}>
          {record.annotation.action === "phase" && (
            <p className="secondary">
              {phaseLabel(record.annotation.phase)} ·{" "}
              {statusLabel[record.annotation.status]}
            </p>
          )}
          <RecordEvidence record={record} projectId={projectId} />
        </div>
      ))}
    </section>
  );

  return (
    <>
      {skills.length > 0 && (
        <div className="workflow-skill-overview">
          <p className="secondary">Skills in this flow</p>
          <div className="skill-badges" aria-label="Flow skills">
            {skills.map((skill) => {
              const active =
                selection?.kind === "flow" && selection.skill === skill;
              return (
                <SkillBadge
                  key={skill}
                  name={skill}
                  aria-label={"View " + skillLabel(skill) + " across this flow"}
                  aria-expanded={active}
                  aria-controls={active ? evidenceId : undefined}
                  onClick={(event) => {
                    trigger.current = event.currentTarget;
                    setSelection(active ? null : { kind: "flow", skill });
                  }}
                />
              );
            })}
          </div>
          {selection?.kind === "flow" && skillEvidence}
        </div>
      )}
      {flow.nodes.length > 0 ? (
        <>
          <div
            role="group"
            aria-label="Flow view"
            className="workflow-view-toggle"
          >
            <Button
              variant="ghost"
              aria-pressed={mode === "phases"}
              onClick={() => setMode("phases")}
            >
              Work phases
            </Button>
            <Button
              variant="ghost"
              aria-pressed={mode === "sequence"}
              onClick={() => setMode("sequence")}
            >
              Skill sequence
            </Button>
          </div>
          {mode === "sequence" && (
            <p className="secondary">
              Recorded phase order. Skills declared together share a group;
              their order within it is unknown. Repeated phases remain visible.
            </p>
          )}
          <ol
            className={
              mode === "sequence" ? "astack-flow skill-sequence" : "astack-flow"
            }
            aria-label={
              mode === "sequence"
                ? "Recorded skill sequence"
                : "Recorded work phases"
            }
          >
            {flow.nodes.map((node, index) => {
              if (node.kind === "route") {
                const annotation = node.record.annotation;
                return annotation.action === "change" ? (
                  <li key={node.record.eventId} data-step={index + 1}>
                    <h4>
                      Changed route → {routeDefinitions[annotation.route].label}
                    </h4>
                    <p>{annotation.reason}</p>
                    <p className="secondary">
                      Revised plan:{" "}
                      {annotation.plannedPhases.map(phaseLabel).join(" → ")}
                    </p>
                    <details>
                      <summary>View route change</summary>
                      <RecordEvidence
                        record={node.record}
                        projectId={projectId}
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
              const nodeSkills = declaredSkills(node);
              return (
                <li key={first?.eventId} data-step={index + 1}>
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
                    {mode === "sequence" && first && (
                      <time
                        dateTime={new Date(first.recordedAt).toISOString()}
                        className="workflow-sequence-time"
                      >
                        {new Date(first.recordedAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    )}
                  </div>
                  {mode === "phases" && summary && <p>{summary}</p>}
                  <div
                    className="skill-badges"
                    aria-label={phaseLabel(node.phase) + " declared skills"}
                  >
                    {nodeSkills.map((skill) => {
                      const active =
                        selection?.kind === "phase" &&
                        selection.eventId === first?.eventId &&
                        selection.skill === skill;
                      return (
                        <SkillBadge
                          key={skill}
                          name={skill}
                          aria-label={
                            "View " +
                            skillLabel(skill) +
                            " in " +
                            phaseLabel(node.phase)
                          }
                          aria-expanded={active}
                          aria-controls={active ? evidenceId : undefined}
                          onClick={(event) => {
                            if (!first) return;
                            trigger.current = event.currentTarget;
                            setSelection(
                              active
                                ? null
                                : {
                                    kind: "phase",
                                    skill,
                                    eventId: first.eventId,
                                  },
                            );
                          }}
                        />
                      );
                    })}
                    {mode === "sequence" && nodeSkills.length === 0 && (
                      <span className="secondary">
                        No skills declared for this phase.
                      </span>
                    )}
                  </div>
                  {selection?.kind === "phase" &&
                    selection.eventId === first?.eventId &&
                    skillEvidence}
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
                          projectId={projectId}
                        />
                      ))}
                      <p className="secondary">
                        Declarations and skill reads do not establish
                        application. Inspect the linked actions, outputs and
                        verification results.
                      </p>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        </>
      ) : (
        <p className="subtitle">No phase transitions recorded yet.</p>
      )}
    </>
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
                <WorkflowPath
                  flow={flow}
                  projectId={detail.evaluation.projectId}
                />
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
