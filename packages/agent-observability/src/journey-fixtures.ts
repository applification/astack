import { eventSchema, runSchema, type AgentEvent } from "./domain";
import { evaluationRun } from "./evaluation-fixtures";
import { workflowFixture, workflowViewFixture } from "./workflow-fixtures";
import { workflowCaptureSchema, type WorkflowRecord } from "./workflow-view";
import type { WorkflowAnnotation } from "./workflow";

// Synthetic only: shared by browser and backend boundary regressions.
export function journeyFixture(joined = true) {
  const parent = evaluationRun();
  const children = ["ui", "data"].flatMap((name) =>
    (name === "ui" ? ["first", "retry"] : ["first"]).map((turn) =>
      runSchema.parse({
        ...parent,
        id: parent.machineId + ":codex:child-" + name + ":" + turn,
        sessionId: "child-" + name,
        attemptId: turn,
        sessionReferences: [
          { kind: "codex", sessionId: "child-" + name },
          {
            kind: "t3",
            environmentId: "fixture-host",
            threadId: "child-" + name,
          },
        ],
        title: name === "ui" ? "UI child " + turn : "Data child",
        startedAt: turn === "retry" ? 1200 : 1080,
        status: turn === "first" && name === "ui" ? "failed" : "completed",
      }),
    ),
  );
  parent.delegations = ["ui", "data"].map((name) => ({
    id: "delegate-" + name,
    source: "t3",
    child: {
      kind: "t3",
      environmentId: "fixture-host",
      threadId: "child-" + name,
    },
    title: name === "ui" ? "UI checks" : "Data review",
    status: "completed",
    startedAt: 1075,
    completedAt: 1350,
  }));
  const events: AgentEvent[] = [];
  const childRecords: WorkflowRecord[] = [];
  for (const child of children) {
    const name = child.sessionId === "child-ui" ? "react" : "testing";
    const read = eventSchema.parse({
      id: child.id + ":read",
      runId: child.id,
      sequence: 1,
      kind: "skill_loaded",
      timestamp: 1085,
      observedAt: 1085,
      timing: "agent",
      title: "Read " + name + " skill",
      skill: {
        name,
        kind: "skill",
        path: "/synthetic/" + name + "/SKILL.md",
        hash: "fixture-content-hash",
        provenance: "observation_time",
        evidence: "read",
      },
      data: {},
    });
    const result = eventSchema.parse({
      id: child.id + ":result",
      runId: child.id,
      sequence: 2,
      kind: "assistant_output",
      timestamp: 1340,
      observedAt: 1340,
      timing: "agent",
      title:
        child.status === "failed"
          ? "UI verification failed"
          : "Child returned proposed checks",
      data: {
        content: "Synthetic child result; no claim of successful verification.",
      },
    });
    events.push(read, result);
    const add = (annotation: WorkflowAnnotation, time: number) => {
      const event = eventSchema.parse({
        id: child.id + ":workflow:" + events.length,
        runId: child.id,
        sequence: 100 + events.length,
        kind: "workflow_step",
        timestamp: time,
        observedAt: time,
        timing: "agent",
        title:
          annotation.action === "phase" || annotation.action === "join"
            ? annotation.summary
            : annotation.reason,
        workflow: annotation,
        data: {},
      });
      events.push(event);
      childRecords.push({
        eventId: event.id,
        runId: child.id,
        sessionId: child.sessionId,
        revision: events.length,
        recordedAt: time,
        annotation,
        evidence:
          annotation.action === "phase" && annotation.evidence.length > 0
            ? [
                {
                  state: "available",
                  reference: { runId: child.id, eventId: result.id },
                  title: result.title,
                  kind: result.kind,
                  revision: 1,
                },
              ]
            : [],
      });
    };
    const flowId = "synthetic-shared-child-flow";
    if (child.attemptId === "first")
      add(
        {
          schemaVersion: 1,
          flowId,
          action: "select",
          route: "pr",
          reason: "Inspect the scoped delegated work.",
          plannedPhases: ["verify"],
        },
        1080,
      );
    const common = {
      schemaVersion: 1,
      flowId,
      action: "phase",
      phase: "verify",
      skills: [name],
      evidence: [{ runId: child.id, eventId: result.id }],
    } as const;
    add(
      {
        ...common,
        skills: [...common.skills],
        evidence: [],
        status: "started",
        summary: "Inspecting the child checks.",
      },
      child.startedAt + 10,
    );
    add(
      {
        ...common,
        skills: [...common.skills],
        evidence: [...common.evidence],
        status: child.status === "failed" ? "failed" : "completed",
        summary:
          child.status === "failed"
            ? "Failed child attempt retained."
            : "Proposed checks returned; execution is unverified.",
      },
      child.attemptId === "retry" ? 1330 : 1180,
    );
  }
  const root = workflowViewFixture();
  root.records = root.records.map((record) => ({
    ...record,
    sessionId: parent.sessionId,
  }));
  if (joined) {
    const flowId = root.records[0]?.annotation.flowId;
    if (!flowId) throw new Error("Missing fixture flow");
    const annotation: WorkflowAnnotation = {
      schemaVersion: 1,
      flowId,
      action: "join",
      summary:
        "Used the UI and data recommendations to define the regression checks.",
      inputs: parent.delegations.map((task) => {
        const child = children.findLast(
          (child) =>
            task.child?.kind === "t3" &&
            child.sessionId === task.child.threadId,
        );
        if (!child) throw new Error("Missing fixture child");
        return {
          branchId: task.id,
          result: { runId: child.id, eventId: child.id + ":result" },
        };
      }),
    };
    const event = eventSchema.parse({
      id: parent.id + ":join",
      runId: parent.id,
      sequence: 200,
      kind: "workflow_step",
      timestamp: 1400,
      observedAt: 1400,
      timing: "agent",
      title: annotation.summary,
      workflow: annotation,
      data: {},
    });
    events.push(event);
    root.records.push({
      eventId: event.id,
      runId: parent.id,
      sessionId: parent.sessionId,
      revision: 1,
      recordedAt: 1400,
      annotation,
      evidence: annotation.inputs.map((input) => ({
        state: "available",
        reference: input.result,
        title: "Child returned proposed checks",
        kind: "assistant_output",
        revision: 1,
      })),
    });
  }
  const branches = parent.delegations.map((delegation) => ({
    parentRunId: parent.id,
    delegation,
    state: "available",
    reason: null,
    runs: children
      .filter(
        (child) =>
          delegation.child?.kind === "t3" &&
          child.sessionId === delegation.child.threadId,
      )
      .map((child) => ({
        runId: child.id,
        sessionId: child.sessionId,
        title: child.title,
        status: child.status,
        revision: 1,
      })),
    records: childRecords.filter(
      (record) =>
        delegation.child?.kind === "t3" &&
        record.sessionId === delegation.child.threadId,
    ),
    reads: events.flatMap((event) =>
      event.skill &&
      children.some(
        (child) =>
          child.id === event.runId &&
          delegation.child?.kind === "t3" &&
          child.sessionId === delegation.child.threadId,
      )
        ? [
            {
              reference: { runId: event.runId, eventId: event.id },
              skill: event.skill,
              revision: 1,
            },
          ]
        : [],
    ),
    truncated: false,
  }));
  return {
    parent,
    children,
    events: [
      ...workflowFixture().support,
      ...workflowFixture().annotations,
      ...events,
    ],
    workflow: workflowCaptureSchema.parse({ ...root, branches }),
  };
}
