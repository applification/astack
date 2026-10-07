import { eventSchema } from "@astack/agent-observability";
import {
  workflowAnnotationSchema,
  type WorkflowAnnotation,
} from "@astack/agent-observability/workflow";
import { approvedRun } from "./projects";
import { refreshRun } from "./context";
import type { LocalStore } from "./store";
import { sessionReferenceKey } from "@astack/agent-observability/delegation";

export function recordWorkflow({
  store,
  runId,
  annotation: raw,
}: {
  store: LocalStore;
  runId: string;
  annotation: WorkflowAnnotation;
}) {
  const annotation = workflowAnnotationSchema.parse(raw);
  const run = approvedRun(store, runId);
  if (!run) throw new Error("Run outside enabled project capture");
  if (!run.contentCapture)
    throw new Error("Workflow details require readable capture");
  if (
    annotation.action === "select" &&
    !annotation.flowId.startsWith(runId + ":workflow:")
  )
    throw new Error("Flow selection ID must use the captured run namespace");
  if (annotation.action !== "select") {
    const origin = store.getRecord("event:" + annotation.flowId);
    if (
      origin?.kind !== "event" ||
      origin.value.workflow?.action !== "select" ||
      !origin.value.runId.startsWith(run.machineId + ":") ||
      approvedRun(store, origin.value.runId)?.projectId !== run.projectId
    )
      throw new Error("Flow selection unavailable in this enabled project");
  } else if (store.getRecord("event:" + annotation.flowId)) {
    throw new Error(
      "Flow already selected; record a route change or use a new flow ID",
    );
  }
  const refs =
    annotation.action === "phase"
      ? annotation.evidence
      : annotation.action === "join"
        ? annotation.inputs.map((input) => input.result)
        : annotation.action === "select" && annotation.request
          ? [annotation.request]
          : [];
  for (const ref of refs) {
    const event = store.getRecord("event:" + ref.eventId);
    if (
      event?.kind !== "event" ||
      event.value.runId !== ref.runId ||
      !ref.runId.startsWith(run.machineId + ":") ||
      approvedRun(store, ref.runId)?.projectId !== run.projectId ||
      (annotation.action === "select" && event.value.kind !== "user_prompt")
    )
      throw new Error(
        "Workflow evidence outside captured project or unavailable",
      );
  }
  if (annotation.action === "join") {
    const tasks = store
      .runsForSession(run.sessionId)
      .flatMap((turn) => turn.delegations);
    for (const input of annotation.inputs) {
      const task = tasks.find((task) => task.id === input.branchId);
      const child = approvedRun(store, input.result.runId);
      const childReference = task?.child;
      if (
        !childReference ||
        !child ||
        (!child.sessionReferences.some(
          (ref) =>
            sessionReferenceKey(ref) === sessionReferenceKey(childReference),
        ) &&
          !(
            child.agent === "codex" &&
            childReference.kind === "codex" &&
            child.sessionId === childReference.sessionId
          ))
      )
        throw new Error(
          "Join result must belong to the recorded delegated branch",
        );
    }
  }
  const now = Date.now();
  const id =
    annotation.action === "select"
      ? annotation.flowId
      : `${runId}:workflow:${crypto.randomUUID()}`;
  const event = eventSchema.parse({
    id,
    runId,
    sequence: Number(store.getMeta("revision")) + 1,
    kind: "workflow_step",
    timestamp: now,
    observedAt: now,
    timing: "agent",
    title:
      annotation.action === "phase" || annotation.action === "join"
        ? annotation.summary
        : annotation.reason,
    ...(annotation.action === "select" || annotation.action === "change"
      ? {
          skill: {
            name: annotation.route,
            kind: "workflow",
            hash: null,
            provenance: "declared",
            evidence: "declared",
          },
        }
      : {}),
    workflow: annotation,
    data: {},
  });
  store.put({ kind: "event", value: event });
  store.setMeta("workflow:last:" + run.sessionId, annotation.flowId);
  refreshRun(store, run);
  return { flowId: annotation.flowId, eventId: id, runId };
}
