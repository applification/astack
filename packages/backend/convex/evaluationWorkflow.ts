import { eventSchema, runSchema } from "@astack/agent-observability";
import { resolveProject } from "@astack/agent-observability/projects";
import { redact } from "@astack/agent-observability/redaction";
import {
  workflowCaptureSchema,
  type WorkflowRecord,
} from "@astack/agent-observability/workflow-view";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import type { QueryCtx } from "./_generated/server";
import type { getProject } from "./projectData";

export async function evaluationWorkflow(
  ctx: QueryCtx,
  runs: EvaluationDetail["runs"],
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>,
) {
  const eligible = new Map<string, string>();
  if (project.enabled)
    for (const { run } of runs) {
      const current = await ctx.db
        .query("runs")
        .withIndex("by_runId", (q) => q.eq("runId", run.id))
        .unique();
      if (
        !current?.enrolled ||
        current.projectId !== project.projectId ||
        current.machineId !== run.machineId
      )
        continue;
      const value = runSchema.parse(JSON.parse(current.data));
      if (
        value.contentCapture &&
        resolveProject([project], value)?.projectId === project.projectId
      )
        eligible.set(run.id, run.machineId);
    }
  const records: WorkflowRecord[] = [];
  let bytes = 0;
  let truncated = false;
  let resolved = 0;
  let previewBytes = 0;
  const previews = new Map<string, WorkflowRecord["evidence"][number]>();
  for (const { run } of [...runs].sort(
    (a, b) => a.run.startedAt - b.run.startedAt,
  )) {
    if (!eligible.has(run.id)) continue;
    let count = 0;
    for await (const row of ctx.db
      .query("events")
      .withIndex("by_runId_and_kind_and_sequence", (q) =>
        q.eq("runId", run.id).eq("kind", "workflow_step"),
      )) {
      if (++count > 64) {
        truncated = true;
        break;
      }
      bytes += new TextEncoder().encode(row.data).byteLength;
      if (records.length >= 80 || bytes > 256 * 1024) {
        truncated = true;
        break;
      }
      if (row.machineId !== run.machineId) continue;
      const event = eventSchema.parse(redact(JSON.parse(row.data)));
      if (!event.workflow) continue;
      const annotation = event.workflow;
      const refs =
        annotation.action === "phase"
          ? annotation.evidence
          : annotation.action === "select" && annotation.request
            ? [annotation.request]
            : [];
      const evidence: WorkflowRecord["evidence"] = [];
      for (const reference of refs) {
        const unavailable = (reason: string) =>
          evidence.push({ state: "unavailable", reference, reason });
        if (!eligible.has(reference.runId)) {
          unavailable("Evidence is outside the linked readable capture.");
          continue;
        }
        const key = JSON.stringify(reference);
        const cached = previews.get(key);
        if (cached) {
          evidence.push(cached);
          continue;
        }
        if (resolved >= 32 || previewBytes >= 256 * 1024) {
          unavailable(
            "Evidence preview limit reached; inspect the full trace.",
          );
          truncated = true;
          continue;
        }
        resolved++;
        const source = await ctx.db
          .query("events")
          .withIndex("by_eventId", (q) => q.eq("eventId", reference.eventId))
          .unique();
        if (
          !source ||
          source.runId !== reference.runId ||
          source.machineId !== eligible.get(reference.runId)
        ) {
          unavailable("Referenced trace event has not been captured.");
          continue;
        }
        previewBytes += new TextEncoder().encode(source.data).byteLength;
        if (previewBytes > 256 * 1024) {
          unavailable(
            "Supporting event exceeds the preview byte limit; inspect the full trace.",
          );
          truncated = true;
          continue;
        }
        const parsed = eventSchema.parse(redact(JSON.parse(source.data)));
        const preview = {
          state: "available",
          reference,
          title: parsed.title.slice(0, 240),
          kind: parsed.kind,
          revision: source.revision,
        } satisfies WorkflowRecord["evidence"][number];
        previews.set(key, preview);
        evidence.push(preview);
      }
      records.push({
        eventId: event.id,
        runId: event.runId,
        revision: row.revision,
        recordedAt: event.timestamp ?? event.observedAt,
        annotation,
        evidence,
      });
    }
    if (records.length >= 80 || bytes > 256 * 1024) {
      truncated = true;
      break;
    }
  }
  return workflowCaptureSchema.parse({ records, truncated });
}
