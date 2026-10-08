import { useId, useRef, useState } from "react";
import { Button } from "@astack/ui";
import type { WorkNode } from "@astack/agent-observability/work-view";
import {
  contributionUse,
  contributionUseLabel,
} from "@astack/agent-observability/work-view";
import {
  workflowFlows,
  type WorkflowRecord,
  type WorkflowNode,
  type WorkflowRead,
  type WorkflowBranch,
} from "@astack/agent-observability/workflow-view";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import { CopyValue } from "./run-metadata";
import { SkillBadge, SkillIcon, skillLabel } from "./skill-badge";
import { runLink } from "./evaluation-evidence";
const phaseLabel = (value: string) =>
  value.replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());
function MapDescription({ text }: { text: string }) {
  const parts = text.split(/(\b(?:[a-f0-9]{64}|[a-f0-9]{40})\b)/gi);
  return (
    <p className="map-description">
      {parts.map((part, index) =>
        index % 2 === 1 ? (
          <span className="map-revision" key={index}>
            <code title={part} aria-label={"Revision " + part}>
              {part.slice(0, 8)}
            </code>
            <CopyValue value={part} label="revision" showValueOnFailure />
          </span>
        ) : (
          part
        ),
      )}
    </p>
  );
}

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
            : annotation.action === "join"
              ? "Parent join declared"
              : "Route changed"}
        {" · "}
        {new Date(record.recordedAt).toLocaleString()}
      </p>
      <MapDescription
        text={
          annotation.action === "phase" || annotation.action === "join"
            ? annotation.summary
            : annotation.reason
        }
      />
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

function Reads({
  reads,
  projectId,
}: {
  reads: WorkflowRead[];
  projectId: string;
}) {
  return (
    <ul className="work-reads">
      {reads.map((read) => (
        <li key={read.reference.eventId}>
          <a
            className="skill-badge-content"
            href={runLink(
              read.reference.runId,
              projectId,
              read.reference.eventId,
            )}
          >
            <SkillIcon name={read.skill.name} />
            <span>{skillLabel(read.skill.name)}</span>
          </a>
          <span className="secondary">
            {read.skill.evidence.replace(/_/g, " ")} ·{" "}
            {read.skill.provenance.replace(/_/g, " ")} · capture revision{" "}
            {read.revision}
          </span>
        </li>
      ))}
    </ul>
  );
}
function PhaseDetails({
  phase,
  projectId,
}: {
  phase: Extract<WorkflowNode, { kind: "phase" }>;
  projectId: string;
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const id = useId();
  const skills = [
    ...new Set(
      phase.records.flatMap((record) =>
        record.annotation.action === "phase" ? record.annotation.skills : [],
      ),
    ),
  ];
  return (
    <section aria-label={phaseLabel(phase.phase) + " phase evidence"}>
      <div
        className="skill-badges"
        aria-label={phaseLabel(phase.phase) + " declared skills"}
      >
        {skills.map((skill) => (
          <SkillBadge
            key={skill}
            name={skill}
            aria-label={
              "View " + skillLabel(skill) + " in " + phaseLabel(phase.phase)
            }
            aria-expanded={selection === skill}
            aria-controls={selection === skill ? id : undefined}
            onClick={(event) => {
              trigger.current = event.currentTarget;
              setSelection(selection === skill ? null : skill);
            }}
          />
        ))}
      </div>
      {!skills.length && (
        <p className="secondary">No skills declared for this phase.</p>
      )}
      {selection && (
        <section
          id={id}
          aria-label={skillLabel(selection) + " skill evidence"}
          className="workflow-skill-evidence"
        >
          <div className="workflow-phase-heading">
            <h4>{skillLabel(selection)}</h4>
            <Button
              variant="ghost"
              aria-label="Close skill evidence"
              onClick={() => {
                setSelection(null);
                trigger.current?.focus();
              }}
            >
              Close
            </Button>
          </div>
          <p className="secondary">
            Recorded name: {selection}. Agent declarations; supporting links
            describe the phase and do not prove a skill invocation.
          </p>
          {phase.records
            .filter(
              (record) =>
                record.annotation.action === "phase" &&
                record.annotation.skills.includes(selection),
            )
            .map((record) => (
              <RecordEvidence
                key={record.eventId}
                record={record}
                projectId={projectId}
              />
            ))}
        </section>
      )}
      {!selection &&
        phase.records.map((record) => (
          <RecordEvidence
            key={record.eventId}
            record={record}
            projectId={projectId}
          />
        ))}
    </section>
  );
}
function ContributionDetails({
  branch,
  detail,
}: {
  branch: WorkflowBranch;
  detail: EvaluationDetail;
}) {
  const projectId = detail.evaluation.projectId;
  const use = contributionUse(branch, detail.workflow.records);
  const results = detail.workflow.results.filter(
    (result) => result.delegationId === branch.delegation.id,
  );
  return (
    <>
      <dl className="work-facts">
        <div>
          <dt>Task state</dt>
          <dd>{branch.delegation.status} · host reported</dd>
        </div>
        <div>
          <dt>Result present</dt>
          <dd>
            {results.some((result) => result.observation.state === "present")
              ? "Observed in parent capture"
              : "Not recorded · unknown"}
          </dd>
        </div>
        <div>
          <dt>Host delivery</dt>
          <dd>
            {results.some((result) => result.observation.state === "delivered")
              ? "Host marked delivered"
              : "Not recorded · unknown"}
          </dd>
        </div>
        <div>
          <dt>Result acknowledgement</dt>
          <dd>
            {results.some(
              (result) => result.observation.state === "acknowledged",
            )
              ? "Terminal-result read recorded"
              : "Not recorded · unknown"}
          </dd>
        </div>
        <div>
          <dt>Parent use</dt>
          <dd>{contributionUseLabel(use)}</dd>
        </div>
      </dl>
      <p className="secondary">
        Task completion alone does not establish that a result was delivered or
        used.
      </p>
      {branch.reason && <p className="notice">{branch.reason}</p>}
      {branch.runs.map((run, index) => (
        <p key={run.runId}>
          <a href={runLink(run.runId, projectId)}>
            Open child turn {branch.runs.length > 1 ? index + 1 : ""} ·{" "}
            {run.status}
          </a>
          <span className="secondary">
            {run.title} · capture revision {run.revision}
          </span>
        </p>
      ))}
      {results.map((result) => (
        <p key={result.reference.eventId}>
          <a
            href={runLink(
              result.reference.runId,
              projectId,
              result.reference.eventId,
            )}
          >
            {result.title || "Result observation in parent trace"}
          </a>
          <span className="secondary">
            capture revision {result.revision} · first observed{" "}
            {new Date(result.observedAt).toLocaleString()}
          </span>
        </p>
      ))}
      {use.state !== "not_recorded" && (
        <section aria-label="Parent use evidence">
          <h4>Parent use evidence</h4>
          {use.records.map((record) => (
            <RecordEvidence
              key={record.eventId}
              record={record}
              projectId={projectId}
            />
          ))}
        </section>
      )}
      {workflowFlows(branch.records).map((flow) => (
        <section key={flow.id} aria-label="Recorded child phases">
          <h4>Child phases</h4>
          {flow.selection && (
            <RecordEvidence record={flow.selection} projectId={projectId} />
          )}{" "}
          {flow.nodes.map((node) =>
            node.kind === "phase" ? (
              <details
                className="evaluation-disclosure"
                key={node.records[0]?.eventId}
              >
                <summary>
                  {phaseLabel(node.phase)} · {node.status}
                </summary>
                <PhaseDetails phase={node} projectId={projectId} />
              </details>
            ) : (
              <RecordEvidence
                key={node.record.eventId}
                record={node.record}
                projectId={projectId}
              />
            ),
          )}
        </section>
      ))}
      {branch.reads.length > 0 && (
        <details className="evaluation-disclosure">
          <summary>Observed child skill reads · {branch.reads.length}</summary>
          <Reads reads={branch.reads} projectId={projectId} />
        </details>
      )}
      {!branch.records.length &&
        !branch.reads.length &&
        branch.state === "available" && (
          <p className="secondary">No child phases or skill reads captured.</p>
        )}
      {branch.truncated && (
        <p role="status" className="notice">
          Child capture reached a display limit. More activity is available in
          the full trace.
        </p>
      )}
    </>
  );
}
export function WorkEvidenceDetails({
  node,
  detail,
}: {
  node: WorkNode;
  detail: EvaluationDetail;
}) {
  const projectId = detail.evaluation.projectId;
  const item = node.item;
  switch (item.kind) {
    case "record":
      return <RecordEvidence record={item.record} projectId={projectId} />;
    case "phase":
      return (
        <PhaseDetails key={node.id} phase={item.phase} projectId={projectId} />
      );
    case "dispatch":
    case "contribution":
      return (
        <ContributionDetails
          key={node.id}
          branch={item.branch}
          detail={detail}
        />
      );
    case "skills":
      return (
        <>
          <p className="secondary">
            Reads do not establish how a skill was applied.
          </p>
          <Reads reads={item.reads} projectId={projectId} />
        </>
      );
    case "result":
      return (
        <>
          <p>{node.status}</p>
          <p className="secondary">
            This is a host observation. Delivery and acknowledgement do not
            establish parent use. Observation time is not a delivery timestamp.
          </p>
          <a
            href={runLink(
              item.result.reference.runId,
              projectId,
              item.result.reference.eventId,
            )}
          >
            Result observation in parent trace
          </a>
          <p className="secondary">
            capture revision {item.result.revision} · first observed{" "}
            {new Date(item.result.observedAt).toLocaleString()}
          </p>
        </>
      );
  }
}
