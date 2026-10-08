import { z } from "zod";
import { evaluationSchema } from "./evaluations";
import { workflowAnnotationSchema } from "./workflow";
import {
  delegationSchema,
  delegationResultSchema,
  sessionReferenceSchema,
} from "./delegation";
import { deliveryEvidenceSchema } from "./delivery-evidence";
import { automationSchema } from "./automations";
import { conversationSchema } from "./conversations";

const id = z.string().min(1).max(512);
const text = z.string().max(4096);
const time = z.number().finite().nonnegative();
export const workReferenceSchema = z
  .object({
    id,
    projectId: id.optional(),
    label: text.optional(),
    url: z
      .url()
      .refine((value) => ["https:", "http:"].includes(new URL(value).protocol))
      .optional(),
  })
  .strict();
export const skillUseSchema = z
  .object({
    name: id,
    kind: z.enum(["skill", "instruction", "workflow"]),
    path: text.optional(),
    hash: z.string().max(128).nullable(),
    version: text.optional(),
    provenance: z.enum(["use_time", "observation_time", "declared"]),
    evidence: z.enum(["read", "explicit_input", "declared"]),
  })
  .strict();
export const eventKinds = [
  "run_start",
  "user_prompt",
  "assistant_output",
  "tool_call",
  "tool_result",
  "mcp_call",
  "mcp_result",
  "shell_command",
  "shell_result",
  "file_read",
  "file_edit",
  "test_run",
  "test_result",
  "skill_loaded",
  "instruction_loaded",
  "workflow_step",
  "delivery_recorded",
  "subagent_start",
  "subagent_result",
  "delegation_result",
  "intervention",
  "error",
  "run_complete",
  "usage",
] as const;
export const eventSchema = z
  .object({
    id,
    runId: id,
    sequence: z.number().int().nonnegative(),
    kind: z.enum(eventKinds),
    timestamp: time.nullable(),
    observedAt: time,
    timing: z.enum(["agent", "hook", "unavailable"]),
    title: text,
    tool: id.optional(),
    signature: id.optional(),
    failed: z.boolean().default(false),
    durationMs: time.optional(),
    skill: skillUseSchema.optional(),
    workflow: workflowAnnotationSchema.optional(),
    delegationResult: delegationResultSchema.optional(),
    delivery: deliveryEvidenceSchema.optional(),
    data: z.record(z.string().max(128), z.json()).default({}),
  })
  .strict()
  .refine((event) => !event.workflow || event.kind === "workflow_step", {
    message: "Workflow annotations require a workflow_step event",
  })
  .refine(
    (event) =>
      (event.kind === "delegation_result") === !!event.delegationResult,
    {
      message:
        "Delegation result observations require a delegation_result event",
    },
  )
  .refine(
    (event) => (event.kind === "delivery_recorded") === !!event.delivery,
    {
      message: "Delivery evidence requires a delivery_recorded event",
    },
  );
export const findingSchema = z
  .object({
    rule: z.enum([
      "failed_turn",
      "repeated_failure",
      "failing_tests",
      "mcp_failures",
      "intervention",
      "long_run",
      "inactive",
      "recurring_error",
      "late_skill",
    ]),
    severity: z.enum(["info", "warning", "error"]),
    title: text,
    evidence: z.array(id).max(20),
  })
  .strict();
export const runSchema = z
  .object({
    id,
    agent: id,
    agentVersion: id.optional(),
    machineId: id,
    machineName: id,
    sessionId: id,
    attemptId: id,
    parentSessionId: id.optional(),
    sessionReferences: z.array(sessionReferenceSchema).max(20).default([]),
    conversation: conversationSchema.nullable().optional(),
    delegations: z.array(delegationSchema).max(32).default([]),
    source: id,
    automation: automationSchema.optional(),
    cwd: text,
    repo: text.optional(),
    branch: text.optional(),
    commit: id.optional(),
    model: id.optional(),
    title: text,
    startedAt: time,
    startTimeKnown: z.boolean().default(true),
    completedAt: time.nullable(),
    status: z.enum([
      "running",
      "completed",
      "failed",
      "interrupted",
      "unknown",
    ]),
    outcome: z.enum(["unknown", "success", "failure"]).default("unknown"),
    lastObservedAt: time,
    lastActivityAt: time.optional(),
    work: workReferenceSchema.optional(),
    projectId: id.optional(),
    skills: z.array(skillUseSchema).max(250),
    tools: z.array(id).max(250),
    findings: z.array(findingSchema).max(100),
    eventCount: z.number().int().nonnegative(),
    contentCapture: z.boolean(),
    coverage: z.array(text).max(30),
  })
  .strict();
export const recordSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("run"), value: runSchema }).strict(),
  z.object({ kind: z.literal("event"), value: eventSchema }).strict(),
  z.object({ kind: z.literal("evaluation"), value: evaluationSchema }).strict(),
]);
export const envelopeSchema = z
  .object({
    schemaVersion: z.literal(1),
    machineId: id,
    records: z
      .array(
        z
          .object({
            revision: z.number().int().positive(),
            record: recordSchema,
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict();
export type WorkReference = z.infer<typeof workReferenceSchema>;
export type SkillUse = z.infer<typeof skillUseSchema>;
export function eventCapabilities(event: AgentEvent): SkillUse[] {
  return [
    ...(event.skill ? [event.skill] : []),
    ...(event.workflow?.action === "phase"
      ? event.workflow.skills.map((name): SkillUse => ({
          name,
          kind: "skill",
          hash: null,
          provenance: "declared",
          evidence: "declared",
        }))
      : []),
  ];
}
export type AgentEvent = z.infer<typeof eventSchema>;
export type AgentRun = z.infer<typeof runSchema>;
export type Finding = z.infer<typeof findingSchema>;
export type TelemetryRecord = z.infer<typeof recordSchema>;
export type Envelope = z.infer<typeof envelopeSchema>;
export type AgentSnapshot = { run: AgentRun; events: AgentEvent[] };
export interface AgentAdapter {
  readonly agent: string;
  collect(): AsyncIterable<AgentSnapshot>;
  close(): Promise<void>;
}

export const filterSchema = z
  .object({
    dimension: z.enum([
      "agent",
      "machine",
      "status",
      "outcome",
      "version",
      "project",
      "repo",
      "branch",
      "work",
      "skill",
      "capability",
      "tool",
      "problem",
      "scheduled",
      "automation",
    ]),
    value: z.string().min(1).max(4096),
  })
  .strict();
export const capabilityGroupSchema = z.object({
  key: z.string(),
  name: z.string(),
  kind: skillUseSchema.shape.kind,
  hash: skillUseSchema.shape.hash,
  provenance: skillUseSchema.shape.provenance,
  runs: z.number().int().nonnegative(),
  problematic: z.number().int().nonnegative(),
});
export const capabilityKey = (skill: SkillUse) =>
  JSON.stringify([skill.kind, skill.name, skill.hash, skill.provenance]);
export const launchContextSchema = z
  .object({ work: workReferenceSchema.optional(), projectId: id.optional() })
  .strict();
