import { z } from "zod";
import { workflowAnnotationSchema, type AstackRoute } from "./workflow";
import { delegationSchema } from "./delegation";
import { skillUseSchema } from "./domain";

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
  sessionId: z.string().optional(),
  revision: z.number(),
  recordedAt: z.number(),
  annotation: workflowAnnotationSchema,
  evidence: z.array(workflowEvidenceSchema).max(8),
});
export const workflowBranchSchema = z.object({
  parentRunId: z.string(),
  delegation: delegationSchema,
  state: z.enum(["available", "unavailable"]),
  reason: z.string().nullable(),
  runs: z
    .array(
      z.object({
        runId: z.string(),
        sessionId: z.string(),
        title: z.string(),
        status: z.string(),
        revision: z.number(),
      }),
    )
    .max(20),
  records: z.array(workflowRecordSchema).max(80),
  reads: z
    .array(z.object({ reference, skill: skillUseSchema, revision: z.number() }))
    .max(32),
  truncated: z.boolean(),
});
export type WorkflowBranch = z.infer<typeof workflowBranchSchema>;
export const workflowCaptureSchema = z.object({
  records: z.array(workflowRecordSchema).max(80),
  branches: z.array(workflowBranchSchema).max(32).default([]),
  truncated: z.boolean(),
});
export type WorkflowRecord = z.infer<typeof workflowRecordSchema>;
type PhaseAnnotation = Extract<
  WorkflowRecord["annotation"],
  { action: "phase" }
>;
export type WorkflowNode =
  | { kind: "route"; record: WorkflowRecord }
  | { kind: "join"; record: WorkflowRecord }
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
    // Conversation identity spans turns but separates siblings sharing a flow ID.
    const flowKey = JSON.stringify([
      record.sessionId ?? "legacy",
      annotation.flowId,
    ]);
    let flow = flows.get(flowKey);
    if (!flow) {
      flow = { id: flowKey, selection: null, nodes: [] };
      flows.set(flowKey, flow);
      state.set(flowKey, { route: null, active: new Map() });
    }
    const context = state.get(flowKey);
    if (!context) continue;
    if (annotation.action === "select") {
      if (!flow.selection) flow.selection = record;
      context.route = annotation.route;
    } else if (annotation.action === "change") {
      flow.nodes.push({ kind: "route", record });
      context.route = annotation.route;
      context.active.clear();
    } else if (annotation.action === "join") {
      flow.nodes.push({ kind: "join", record });
    } else {
      const attemptKey = JSON.stringify([
        annotation.phase,
        annotation.attemptId ?? "legacy",
      ]);
      const prior = context.active.get(attemptKey);
      if (annotation.status !== "started" && prior) {
        prior.records.push(record);
        prior.status = annotation.status;
        context.active.delete(attemptKey);
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
          context.active.set(attemptKey, node);
      }
    }
  }
  return [...flows.values()];
}
