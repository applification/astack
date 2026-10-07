import { eventSchema, runSchema } from "@astack/agent-observability";
import {
  repositoryIdentity,
  resolveProject,
} from "@astack/agent-observability/projects";
import { redact } from "@astack/agent-observability/redaction";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import type { QueryCtx } from "./_generated/server";
import type { getProject } from "./projectData";

export async function evaluationDelivery(
  ctx: QueryCtx,
  runs: EvaluationDetail["runs"],
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>,
): Promise<EvaluationDetail["delivery"]> {
  if (!project.enabled) return null;
  let delivery: EvaluationDetail["delivery"] = null;
  let bytes = 0;
  for (const { run: captured } of runs) {
    const row = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", captured.id))
      .unique();
    if (
      !row?.enrolled ||
      row.machineId !== captured.machineId ||
      row.projectId !== project.projectId
    )
      continue;
    bytes += new TextEncoder().encode(row.data).byteLength;
    if (bytes > 256 * 1024) break;
    const run = runSchema.parse(JSON.parse(row.data));
    if (
      !run.contentCapture ||
      resolveProject([project], run)?.projectId !== project.projectId
    )
      continue;
    const events = await ctx.db
      .query("events")
      .withIndex("by_runId_and_kind_and_sequence", (q) =>
        q.eq("runId", run.id).eq("kind", "delivery_recorded"),
      )
      .order("desc")
      .take(1);
    for (const eventRow of events) {
      bytes += new TextEncoder().encode(eventRow.data).byteLength;
      if (bytes > 256 * 1024) break;
      if (eventRow.machineId !== captured.machineId) continue;
      const event = eventSchema.parse(redact(JSON.parse(eventRow.data)));
      if (
        !event.delivery ||
        event.runId !== run.id ||
        event.id !== eventRow.eventId ||
        !run.repo ||
        repositoryIdentity(run.repo) !==
          repositoryIdentity(
            `https://github.com/${event.delivery.snapshot.repository}`,
          )
      )
        continue;
      if (
        !delivery ||
        event.delivery.snapshot.capturedAt >
          delivery.evidence.snapshot.capturedAt
      )
        delivery = {
          runId: run.id,
          eventId: event.id,
          evidence: event.delivery,
        };
    }
  }
  return delivery;
}
