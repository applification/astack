import { useId, useRef, useState, type CSSProperties } from "react";
import { Badge, Button } from "@astack/ui";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import { routeDefinitions } from "@astack/agent-observability/workflow";
import {
  workflowFlows,
  type WorkflowFlow,
  type WorkflowNode,
  type WorkflowRecord,
  type WorkflowBranch,
} from "@astack/agent-observability/workflow-view";
import { ConnectedWorkflowMap } from "./connected-workflow-map";
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
            : annotation.action === "join"
              ? "Parent join declared"
              : "Route changed"}
        {" · "}
        {new Date(record.recordedAt).toLocaleString()}
      </p>
      <p>
        {annotation.action === "phase" || annotation.action === "join"
          ? annotation.summary
          : annotation.reason}
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

function MapStop({
  lane,
  id,
  fork = false,
}: {
  lane: "main" | "child";
  id: string;
  fork?: boolean;
}) {
  return (
    <span
      className="map-stop"
      data-map-key={id}
      data-map-main={lane === "main" ? "" : undefined}
      data-map-child-stop={lane === "child" ? "" : undefined}
      data-map-fork={fork ? "" : undefined}
      aria-hidden="true"
    />
  );
}

function PhaseStop({
  node,
  projectId,
  lane,
}: {
  node: Extract<WorkflowNode, { kind: "phase" }>;
  projectId: string;
  lane: "main" | "child";
}) {
  const [selection, setSelection] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const evidenceId = useId();
  const first = node.records[0],
    last = node.records.at(-1);
  const skills = declaredSkills(node);
  const records = node.records.filter(
    (record) =>
      record.annotation.action === "phase" &&
      record.annotation.skills.includes(selection ?? ""),
  );
  return (
    <article
      className="map-station"
      data-map-station=""
      data-status={node.status}
    >
      <MapStop lane={lane} id={first?.eventId ?? node.phase} />
      <h4>{phaseLabel(node.phase)}</h4>
      <p
        className={
          node.status === "failed"
            ? "text-destructive map-status"
            : "secondary map-status"
        }
      >
        {statusLabel[node.status]}
      </p>
      {last?.annotation.action === "phase" && <p>{last.annotation.summary}</p>}
      <div
        className="skill-badges"
        aria-label={phaseLabel(node.phase) + " declared skills"}
      >
        {skills.map((skill) => (
          <SkillBadge
            key={skill}
            name={skill}
            aria-label={
              "View " + skillLabel(skill) + " in " + phaseLabel(node.phase)
            }
            aria-expanded={selection === skill}
            aria-controls={selection === skill ? evidenceId : undefined}
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
          id={evidenceId}
          aria-label={skillLabel(selection) + " skill evidence"}
          className="workflow-skill-evidence"
        >
          <div className="workflow-phase-heading">
            <h5>{skillLabel(selection)}</h5>
            <Button
              variant="ghost"
              aria-label="Close skill evidence"
              onClick={() => {
                setSelection(null);
                if (trigger.current?.isConnected) trigger.current.focus();
              }}
            >
              Close
            </Button>
          </div>
          <p className="secondary">
            Recorded name: {selection}. Agent declarations; supporting links
            describe the phase and do not prove a skill invocation.
          </p>
          {records.map((record) => (
            <RecordEvidence
              key={record.eventId}
              record={record}
              projectId={projectId}
            />
          ))}
        </section>
      )}
      {first && (
        <a
          className="map-evidence-link"
          href={runLink(first.runId, projectId, first.eventId)}
        >
          Phase declaration in trace
        </a>
      )}
    </article>
  );
}

function WorkflowNodeStop({
  node,
  projectId,
  lane,
}: {
  node: WorkflowNode;
  projectId: string;
  lane: "main" | "child";
}) {
  if (node.kind === "phase")
    return <PhaseStop node={node} projectId={projectId} lane={lane} />;
  const annotation = node.record.annotation;
  if (node.kind === "route")
    return annotation.action === "change" ? (
      <article className="map-station" data-map-station="">
        <MapStop lane={lane} id={node.record.eventId} />
        <h4>Changed route → {routeDefinitions[annotation.route].label}</h4>
        <p>{annotation.reason}</p>
        <a
          className="map-evidence-link"
          href={runLink(node.record.runId, projectId, node.record.eventId)}
        >
          Route change in trace
        </a>
      </article>
    ) : null;
  return (
    <article className="map-station journey-join" data-map-station="">
      <MapStop lane={lane} id={node.record.eventId} />
      <h4>Join back to main</h4>
      <RecordEvidence record={node.record} projectId={projectId} />
    </article>
  );
}

function branchJoin(branch: WorkflowBranch, nodes: WorkflowNode[]) {
  return nodes.find(
    (node) =>
      node.kind === "join" &&
      node.record.annotation.action === "join" &&
      node.record.annotation.inputs.some(
        (input) =>
          input.branchId === branch.delegation.id &&
          branch.runs.some((run) => run.runId === input.result.runId) &&
          node.record.evidence.some(
            (item) =>
              item.state === "available" &&
              item.reference.runId === input.result.runId &&
              item.reference.eventId === input.result.eventId,
          ),
      ),
  );
}

function ChildJourney({
  branch,
  projectId,
  joined,
}: {
  branch: WorkflowBranch;
  projectId: string;
  joined: boolean;
}) {
  const flows = workflowFlows(branch.records);
  return (
    <>
      <header className="map-station journey-child-heading" data-map-station="">
        <MapStop lane="child" id={branch.delegation.id} />
        <h4>{branch.delegation.title || "Delegated agent"}</h4>
        <p
          className="secondary map-status"
          title={
            branch.delegation.startedAt === null
              ? undefined
              : "Host started: " +
                new Date(branch.delegation.startedAt).toLocaleString()
          }
        >
          Task {branch.delegation.status} · {branch.runs.length}{" "}
          {branch.runs.length === 1 ? "turn" : "turns"}
        </p>
        {branch.reason && <p role="status">{branch.reason}</p>}
      </header>
      {flows.map((flow) => (
        <ol
          key={flow.id}
          className="child-phase-stops"
          aria-label="Recorded child phases"
        >
          {flow.nodes.map((node, index) => (
            <li
              key={
                node.kind === "phase"
                  ? (node.records[0]?.eventId ?? index)
                  : node.record.eventId
              }
            >
              <WorkflowNodeStop
                node={node}
                projectId={projectId}
                lane="child"
              />
            </li>
          ))}
        </ol>
      ))}
      {branch.reads.length > 0 && (
        <section
          aria-label="Captured child skill reads"
          className="child-read-stops"
        >
          <h5>Observed skills</h5>
          {branch.reads.map((read) => (
            <div
              className="map-station journey-skill-read"
              key={read.reference.eventId}
              data-map-station=""
            >
              <MapStop lane="child" id={read.reference.eventId} />
              <a
                className="skill-badge-content"
                aria-label={
                  skillLabel(read.skill.name) + " skill read in child trace"
                }
                href={runLink(
                  read.reference.runId,
                  projectId,
                  read.reference.eventId,
                )}
                title={
                  read.skill.evidence.replace(/_/g, " ") +
                  " · " +
                  read.skill.provenance.replace(/_/g, " ")
                }
              >
                <SkillIcon name={read.skill.name} />
                <span>{skillLabel(read.skill.name)}</span>
              </a>
            </div>
          ))}
        </section>
      )}
      <footer className="journey-child-end">
        <div className="map-station" data-map-station="">
          {branch.runs.map((run, index) => (
            <a
              key={run.runId}
              className="map-evidence-link"
              href={runLink(run.runId, projectId)}
              title={run.title}
            >
              Open child turn {branch.runs.length > 1 ? index + 1 : ""} ·{" "}
              {run.status}
            </a>
          ))}
          {branch.truncated && (
            <p role="status" className="notice">
              Child capture reached a display limit. More activity is available
              in the full trace.
            </p>
          )}
          {branch.state === "available" &&
            !branch.reads.length &&
            !flows.length && (
              <p className="secondary">
                No child phases or skill reads captured.
              </p>
            )}
        </div>
        <div className="map-station" data-map-station="">
          <MapStop lane="child" id={branch.delegation.id + ":end"} />
          <p className="secondary">
            {joined ? "Result used at parent join" : "No parent join recorded"}
          </p>
        </div>
      </footer>
    </>
  );
}

type MapStation = { kind: "fork" } | { kind: "node"; node: WorkflowNode };
function WorkflowPath({
  flow,
  projectId,
  branches = [],
}: {
  flow: WorkflowFlow;
  projectId: string;
  branches?: WorkflowBranch[];
}) {
  const selected = flow.selection?.annotation;
  const firstBranchTime = Math.min(
    ...branches.map((branch) => branch.delegation.startedAt ?? Infinity),
  );
  const branchIndex = flow.nodes.findIndex(
    (node) =>
      ((node.kind === "phase" ? node.records[0] : node.record)?.recordedAt ??
        -Infinity) >= firstBranchTime,
  );
  const firstJoinIndex = flow.nodes.findIndex(
    (node) =>
      node.kind === "join" &&
      node.record.annotation.action === "join" &&
      node.record.annotation.inputs.some((input) =>
        branches.some((branch) => branch.delegation.id === input.branchId),
      ),
  );
  const insertionIndex = Math.min(
    branchIndex < 0 ? flow.nodes.length : branchIndex,
    firstJoinIndex < 0 ? flow.nodes.length : firstJoinIndex,
  );
  const stations: MapStation[] = flow.nodes.map((node) => ({
    kind: "node",
    node,
  }));
  if (branches.length) stations.splice(insertionIndex, 0, { kind: "fork" });
  const forkRow = insertionIndex + 3;
  const branchRadius = Math.ceil(branches.length / 2);
  const mainColumn = branchRadius + 1;
  const columnsStyle: CSSProperties & {
    "--map-lane-count": number;
    "--map-main-column": number;
  } = {
    "--map-lane-count": branchRadius * 2 + 1,
    "--map-main-column": mainColumn,
  };
  return (
    <ConnectedWorkflowMap
      route={selected?.action === "select" ? selected.route : undefined}
    >
      <div className="workflow-map-grid" style={columnsStyle}>
        <div className="map-root">
          <span data-map-root="" data-map-key="root">
            <SkillIcon name="astack" />
            astack
          </span>
        </div>
        <header className="map-station map-route-heading" data-map-station="">
          <MapStop lane="main" id={flow.id + ":selection"} />
          <h3>
            {selected?.action === "select"
              ? routeDefinitions[selected.route].label
              : "Route not recorded"}
          </h3>
          <p>
            {selected?.action === "select"
              ? selected.reason
              : "The recorded activity follows."}
          </p>
          {flow.selection && (
            <a
              className="map-evidence-link"
              href={runLink(
                flow.selection.runId,
                projectId,
                flow.selection.eventId,
              )}
            >
              Route selection in trace
            </a>
          )}
          {!flow.nodes.length && !branches.length && (
            <p className="secondary">No phase transitions recorded yet.</p>
          )}
        </header>
        {stations.map((station, index) => {
          const rowStyle: CSSProperties & { "--map-row": number } = {
            "--map-row": index + 3,
          };
          return (
            <div
              key={
                station.kind === "fork"
                  ? "fork"
                  : station.node.kind === "phase"
                    ? (station.node.records[0]?.eventId ?? index)
                    : station.node.record.eventId
              }
              className="map-main-cell"
              style={rowStyle}
            >
              {station.kind === "fork" ? (
                <section
                  aria-label="Delegated journeys"
                  className="map-station journey-delegation-station"
                  data-map-station=""
                >
                  <MapStop lane="main" id={flow.id + ":fork"} fork />
                  <h4>Delegated work</h4>
                  <p className="secondary">
                    {branches.length} child{" "}
                    {branches.length === 1 ? "conversation" : "conversations"}
                  </p>
                </section>
              ) : (
                <WorkflowNodeStop
                  node={station.node}
                  projectId={projectId}
                  lane="main"
                />
              )}
            </div>
          );
        })}
        {branches.map((branch, index) => {
          const side = index % 2 === 0 ? "left" : "right";
          const distance = Math.floor(index / 2) + 1;
          const join = branchJoin(branch, flow.nodes);
          const joinIndex = stations.findIndex(
            (station) => station.kind === "node" && station.node === join,
          );
          const placement: CSSProperties & {
            "--map-column": number;
            "--map-row": string;
          } = {
            "--map-column":
              mainColumn + (side === "left" ? -distance : distance),
            "--map-row": `${forkRow} / ${joinIndex < 0 ? stations.length + 3 : joinIndex + 3}`,
          };
          return (
            <section
              key={branch.delegation.id}
              aria-label={branch.delegation.title || "Delegated agent"}
              className="journey-child"
              data-map-branch=""
              data-side={side}
              data-color={index % 5}
              data-join-target={
                join?.kind === "join" ? join.record.eventId : undefined
              }
              style={placement}
            >
              <ChildJourney
                branch={branch}
                projectId={projectId}
                joined={!!join}
              />
            </section>
          );
        })}
      </div>
    </ConnectedWorkflowMap>
  );
}

export function WorkflowEvidence({ detail }: { detail: EvaluationDetail }) {
  const flows = workflowFlows(detail.workflow.records);
  const flowRunIds = (flow: WorkflowFlow) =>
    new Set([
      ...(flow.selection ? [flow.selection.runId] : []),
      ...flow.nodes.flatMap((node) =>
        node.kind === "phase"
          ? node.records.map((record) => record.runId)
          : [node.record.runId],
      ),
    ]);
  const branchFlow = (branch: WorkflowBranch) => {
    const matching = flows.filter((flow) =>
      flowRunIds(flow).has(branch.parentRunId),
    );
    return matching.length === 1 ? matching[0]?.id : undefined;
  };
  const unplaced = detail.workflow.branches.filter(
    (branch) => !branchFlow(branch),
  );
  return (
    <section aria-label="Astack workflow" className="workflow-section">
      <h2>Path taken</h2>
      {!flows.length && !unplaced.length && (
        <p className="subtitle">
          Flow not recorded in the linked readable capture. Recorded skill reads
          are available in the turn details below.
        </p>
      )}
      {flows.map((flow) => (
        <WorkflowPath
          key={flow.id}
          flow={flow}
          projectId={detail.evaluation.projectId}
          branches={detail.workflow.branches.filter(
            (branch) => branchFlow(branch) === flow.id,
          )}
        />
      ))}
      {unplaced.length > 0 && (
        <section>
          <h3>Unplaced delegated work</h3>
          <p className="secondary">
            These children have no unique recorded parent flow.
          </p>
          <WorkflowPath
            flow={{ id: "unplaced", selection: null, nodes: [] }}
            projectId={detail.evaluation.projectId}
            branches={unplaced}
          />
        </section>
      )}
      {(flows.length > 0 || unplaced.length > 0) && (
        <p className="secondary map-caption">
          Recorded phase order and declared joins; line spacing is not a time
          scale.
        </p>
      )}
      {detail.workflow.truncated && (
        <p role="status" className="notice">
          Workflow capture or evidence previews reached the display limit.
          Inspect the linked full traces for the remaining activity.
        </p>
      )}
    </section>
  );
}
