import { eventSchema, type AgentEvent } from "./domain";
import { evaluationRun, evaluationPrompt } from "./evaluation-fixtures";
import { routeDefinitions, type WorkflowAnnotation } from "./workflow";
import { workflowCaptureSchema } from "./workflow-view";

export function workflowFixture(
  variant: "bug-fix" | "feature" | "changed" = "bug-fix",
) {
  const before = evaluationRun("reproduce");
  const after = evaluationRun();
  const prompt = evaluationPrompt();
  const flowId = before.id + ":workflow:selection";
  const support: AgentEvent[] = [
    {
      id: before.id + ":before",
      runId: before.id,
      sequence: 1,
      kind: "test_result",
      timestamp: 1010,
      observedAt: 1010,
      timing: "agent",
      title: "Before fix: reopening loses the saved edit",
      failed: true,
      data: {},
    },
    {
      id: after.id + ":diff",
      runId: after.id,
      sequence: 1,
      kind: "file_edit",
      timestamp: 1100,
      observedAt: 1100,
      timing: "agent",
      title: "Changed the stale save snapshot",
      failed: false,
      data: {},
    },
    {
      id: after.id + ":failed",
      runId: after.id,
      sequence: 2,
      kind: "test_result",
      timestamp: 1110,
      observedAt: 1110,
      timing: "agent",
      title: "First verification: fresh read still returns old value",
      failed: true,
      data: {},
    },
    {
      id: after.id + ":passed",
      runId: after.id,
      sequence: 3,
      kind: "test_result",
      timestamp: 1150,
      observedAt: 1150,
      timing: "agent",
      title: "After repair: reopen and fresh store read retain the edit",
      failed: false,
      data: {},
    },
  ];
  const annotations: AgentEvent[] = [];
  const add = (runId: string, annotation: WorkflowAnnotation) => {
    const index = annotations.length;
    annotations.push(
      eventSchema.parse({
        id:
          annotation.action === "select"
            ? flowId
            : runId + ":workflow:" + index,
        runId,
        sequence: 100 + index,
        kind: "workflow_step",
        timestamp: 1000 + index * 25,
        observedAt: 1000 + index * 25,
        timing: "agent",
        title:
          annotation.action === "phase" || annotation.action === "join"
            ? annotation.summary
            : annotation.reason,
        workflow: annotation,
        data: {},
      }),
    );
  };
  const route =
    variant === "feature"
      ? "implement"
      : variant === "changed"
        ? "investigate"
        : "bug-fix";
  add(before.id, {
    schemaVersion: 1,
    flowId,
    action: "select",
    route,
    reason:
      variant === "feature"
        ? "Add the agreed saved-edit behaviour and verify persistence."
        : variant === "changed"
          ? "Start with investigation while the cause is unknown."
          : "Restore existing save behaviour and reproduce the reported symptom.",
    plannedPhases: routeDefinitions[route].phases,
    request: { runId: prompt.runId, eventId: prompt.id },
  });
  const phase = (
    name: string,
    status: "started" | "completed" | "failed" | "omitted",
    summary: string,
    skills: string[],
    eventId?: string,
  ) => {
    const event =
      support.find((item) => item.id === eventId) ??
      (eventId === prompt.id ? prompt : null);
    add(name === "reproduce" || name === "define" ? before.id : after.id, {
      schemaVersion: 1,
      flowId,
      action: "phase",
      phase: name,
      status,
      summary,
      skills,
      evidence: event ? [{ runId: event.runId, eventId: event.id }] : [],
    });
  };
  if (variant === "feature") {
    phase(
      "define",
      "completed",
      "Recorded the intended save and reopen behaviour.",
      ["implement"],
      prompt.id,
    );
    phase(
      "design",
      "omitted",
      "Reuse the agreed editor layout; no new interaction design is required.",
      ["web-feature"],
    );
    phase(
      "implement",
      "completed",
      "Added the agreed persistence behaviour.",
      ["react", "typescript-best-practices"],
      after.id + ":diff",
    );
    phase(
      "verify",
      "completed",
      "The edit survives reopening and an independent store read.",
      ["verify", "testing"],
      after.id + ":passed",
    );
    phase(
      "review",
      "started",
      "Preparing the PR with retained verification evidence.",
      ["pr"],
    );
  } else {
    phase(
      "reproduce",
      "started",
      "Run save and reopen on a disposable document.",
      ["bug-fix", "app-control"],
    );
    phase(
      "reproduce",
      "completed",
      "Reopening returns the previous value.",
      ["bug-fix", "app-control"],
      before.id + ":before",
    );
    if (variant === "changed")
      add(after.id, {
        schemaVersion: 1,
        flowId,
        action: "change",
        route: "bug-fix",
        reason:
          "The reproduction confirmed a persistence defect; continue through the repair route.",
        plannedPhases: routeDefinitions["bug-fix"].phases,
      });
    phase(
      "repair",
      "completed",
      "Changed the stale save snapshot.",
      ["react", "typescript-best-practices"],
      after.id + ":diff",
    );
    phase("verify", "started", "Rerun the original save and reopen check.", [
      "verify",
    ]);
    phase(
      "verify",
      "failed",
      "The fresh read still returns the old value; return to repair.",
      ["verify", "testing"],
      after.id + ":failed",
    );
    phase(
      "repair",
      "completed",
      "Repaired the remaining stale state boundary.",
      ["react"],
      after.id + ":diff",
    );
    phase(
      "verify",
      "started",
      "Repeat the original check after the second repair.",
      ["verify"],
    );
    phase(
      "verify",
      "completed",
      "Reopening and a fresh store read now retain the edit.",
      ["verify", "testing"],
      after.id + ":passed",
    );
  }
  return { annotations, support };
}
export function workflowViewFixture(
  variant: "bug-fix" | "feature" | "changed" = "bug-fix",
) {
  const { annotations, support } = workflowFixture(variant);
  const sources = [evaluationPrompt(), ...support];
  return workflowCaptureSchema.parse({
    truncated: false,
    records: annotations.flatMap((event) =>
      event.workflow
        ? [
            {
              eventId: event.id,
              runId: event.runId,
              revision: 1,
              recordedAt: event.timestamp ?? event.observedAt,
              annotation: event.workflow,
              evidence: (event.workflow.action === "phase"
                ? event.workflow.evidence
                : event.workflow.action === "select" && event.workflow.request
                  ? [event.workflow.request]
                  : []
              ).map((reference) => {
                const source = sources.find(
                  (item) => item.id === reference.eventId,
                );
                return source
                  ? {
                      state: "available",
                      reference,
                      title: source.title,
                      kind: source.kind,
                      revision: 1,
                    }
                  : {
                      state: "unavailable",
                      reference,
                      reason: "Referenced trace event has not been captured.",
                    };
              }),
            },
          ]
        : [],
    ),
  });
}
