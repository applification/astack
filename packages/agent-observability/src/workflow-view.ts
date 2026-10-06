import { z } from "zod";
import { workflowAnnotationSchema, type AstackRoute } from "./workflow";

const reference = z.object({ runId: z.string(), eventId: z.string() });
export const workflowEvidenceSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("available"),
    reference,
    title: z.string(),
    kind: z.string(),
    revision: z.number(),
  }),
  z.object({ state: z.literal("unavailable"), reference, reason: z.string() }),
]);
export const workflowRecordSchema = z.object({
  eventId: z.string(),
  runId: z.string(),
  revision: z.number(),
  recordedAt: z.number(),
  annotation: workflowAnnotationSchema,
  evidence: z.array(workflowEvidenceSchema).max(8),
});
export const workflowCaptureSchema = z.object({
  records: z.array(workflowRecordSchema).max(80),
  truncated: z.boolean(),
});
export type WorkflowRecord = z.infer<typeof workflowRecordSchema>;
type PhaseAnnotation = Extract<
  WorkflowRecord["annotation"],
  { action: "phase" }
>;
export type WorkflowNode =
  | { kind: "route"; record: WorkflowRecord }
  | {
      kind: "phase";
      phase: string;
      route: AstackRoute | null;
      status: PhaseAnnotation["status"];
      records: WorkflowRecord[];
    };
export type WorkflowFlow = {
  id: string;
  selection: WorkflowRecord | null;
  nodes: WorkflowNode[];
};

// Pair a phase start with its next finish. A retry creates a new node, preserving the failed attempt.
export function workflowFlows(records: WorkflowRecord[]): WorkflowFlow[] {
  const flows = new Map<string, WorkflowFlow>();
  const state = new Map<
    string,
    {
      route: AstackRoute | null;
      active: Map<string, Extract<WorkflowNode, { kind: "phase" }>>;
    }
  >();
  for (const record of [...records].sort(
    (a, b) =>
      a.recordedAt - b.recordedAt ||
      a.revision - b.revision ||
      a.eventId.localeCompare(b.eventId),
  )) {
    const annotation = record.annotation;
    let flow = flows.get(annotation.flowId);
    if (!flow) {
      flow = { id: annotation.flowId, selection: null, nodes: [] };
      flows.set(annotation.flowId, flow);
      state.set(annotation.flowId, { route: null, active: new Map() });
    }
    const context = state.get(annotation.flowId);
    if (!context) continue;
    if (annotation.action === "select") {
      if (!flow.selection) flow.selection = record;
      context.route = annotation.route;
    } else if (annotation.action === "change") {
      flow.nodes.push({ kind: "route", record });
      context.route = annotation.route;
      context.active.clear();
    } else {
      const prior = context.active.get(annotation.phase);
      if (annotation.status !== "started" && prior) {
        prior.records.push(record);
        prior.status = annotation.status;
        context.active.delete(annotation.phase);
      } else {
        const node: Extract<WorkflowNode, { kind: "phase" }> = {
          kind: "phase",
          phase: annotation.phase,
          route: context.route,
          status: annotation.status,
          records: [record],
        };
        flow.nodes.push(node);
        if (annotation.status === "started")
          context.active.set(annotation.phase, node);
      }
    }
  }
  return [...flows.values()];
}
