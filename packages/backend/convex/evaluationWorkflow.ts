import {
  eventSchema,
  runSchema,
  type AgentRun,
} from "@astack/agent-observability";
import { sessionReferenceKey } from "@astack/agent-observability/delegation";
import { resolveProject } from "@astack/agent-observability/projects";
import { redact } from "@astack/agent-observability/redaction";
import {
  workflowCaptureSchema,
  type WorkflowRecord,
  type WorkflowBranch,
  type WorkflowRead,
} from "@astack/agent-observability/workflow-view";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import type { QueryCtx } from "./_generated/server";
import type { getProject } from "./projectData";

type CapturedRun = { run: AgentRun; revision: number };

// Journey capture is current and bounded. It never changes the evaluation's
// immutable linked runs or authorizes assessment evidence from extra children.
export async function evaluationWorkflow(
  ctx: QueryCtx,
  runs: EvaluationDetail["runs"],
  project: NonNullable<Awaited<ReturnType<typeof getProject>>>,
) {
  const eligible = new Map<string, CapturedRun>();
  const bytesOf = (value: string) => new TextEncoder().encode(value).byteLength;
  let bytes = 0;
  let truncated = false;
  async function readable(runId: string, machineId: string) {
    if (!project.enabled) return null;
    const row = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", runId))
      .unique();
    if (
      !row?.enrolled ||
      row.projectId !== project.projectId ||
      row.machineId !== machineId
    )
      return null;
    bytes += bytesOf(row.data);
    if (bytes > 256 * 1024) {
      truncated = true;
      return null;
    }
    const run = runSchema.parse(redact(JSON.parse(row.data)));
    if (
      run.id !== runId ||
      run.machineId !== machineId ||
      !run.contentCapture ||
      resolveProject([project], run)?.projectId !== project.projectId
    )
      return null;
    const capture = { run, revision: row.revision };
    return capture;
  }
  for (const { run } of runs) {
    const capture = await readable(run.id, run.machineId);
    if (capture) eligible.set(run.id, capture);
  }
  const roots = [...eligible.values()].sort(
    (a, b) => a.run.startedAt - b.run.startedAt,
  );
  const branches: WorkflowBranch[] = [];
  let children = 0;
  const visited = new Set<string>();
  const tasks = new Set<string>();
  for (const { run: parent } of roots) {
    for (const delegation of parent.delegations) {
      if (tasks.has(delegation.id)) continue;
      tasks.add(delegation.id);
      if (branches.length >= 32) {
        truncated = true;
        break;
      }
      const branch: WorkflowBranch = {
        parentRunId: parent.id,
        delegation,
        state: "unavailable",
        reason:
          "Child capture has not been collected or is outside readable project capture.",
        runs: [],
        records: [],
        reads: [],
        truncated: false,
      };
      branches.push(branch);
      const childReference = delegation.child;
      if (!childReference) {
        branch.reason =
          "The host did not expose a child conversation identity.";
        continue;
      }
      const key = sessionReferenceKey(childReference);
      const identity = `${parent.machineId}:${key}`;
      if (
        visited.has(identity) ||
        parent.sessionReferences.some(
          (ref) => sessionReferenceKey(ref) === key,
        ) ||
        (childReference.kind === "codex" &&
          childReference.sessionId === parent.sessionId)
      ) {
        branch.reason =
          "Child identity is repeated or cyclic; inspect the parent trace.";
        continue;
      }
      visited.add(identity);
      const matches = await ctx.db
        .query("runSessions")
        .withIndex("by_machineId_and_key_and_startedAt", (q) =>
          q.eq("machineId", parent.machineId).eq("key", key),
        )
        .order("asc")
        .take(21);
      if (matches.length > 20) branch.truncated = truncated = true;
      for (const match of matches.slice(0, 20)) {
        if (children >= 20) {
          branch.truncated = truncated = true;
          break;
        }
        children++;
        const child = await readable(match.runId, parent.machineId);
        if (
          !child ||
          child.run.sessionId === parent.sessionId ||
          (!child.run.sessionReferences.some(
            (ref) => sessionReferenceKey(ref) === key,
          ) &&
            !(
              childReference.kind === "codex" &&
              child.run.sessionId === childReference.sessionId
            ))
        )
          continue;
        eligible.set(child.run.id, child);
        branch.runs.push({
          runId: child.run.id,
          sessionId: child.run.sessionId,
          title: child.run.title.slice(0, 240),
          status: child.run.status,
          revision: child.revision,
        });
        if (child.run.delegations.length) branch.truncated = truncated = true;
      }
      if (branch.runs.length) {
        branch.state = "available";
        branch.reason = null;
      } else if (truncated)
        branch.reason = "Child capture reached the bounded journey limit.";
    }
  }

  let recordCount = 0;
  let resolved = 0;
  const previews = new Map<string, WorkflowRecord["evidence"][number]>();
  async function recordsFor(run: AgentRun) {
    const records: WorkflowRecord[] = [];
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
      bytes += bytesOf(row.data);
      if (recordCount >= 80 || bytes > 256 * 1024) {
        truncated = true;
        break;
      }
      if (row.machineId !== run.machineId) continue;
      const event = eventSchema.parse(redact(JSON.parse(row.data)));
      const annotation = event.workflow;
      if (!annotation) continue;
      const refs =
        annotation.action === "phase"
          ? annotation.evidence
          : annotation.action === "join"
            ? annotation.inputs.map((input) => input.result)
            : annotation.action === "select" && annotation.request
              ? [annotation.request]
              : [];
      const evidence: WorkflowRecord["evidence"] = [];
      for (const reference of refs) {
        const unavailable = (reason: string) =>
          evidence.push({ state: "unavailable", reference, reason });
        if (eligible.get(reference.runId)?.run.machineId !== run.machineId) {
          unavailable(
            "Evidence is outside the linked or delegated readable capture.",
          );
          continue;
        }
        const key = JSON.stringify(reference);
        const cached = previews.get(key);
        if (cached) {
          evidence.push(cached);
          continue;
        }
        if (resolved >= 32 || bytes >= 256 * 1024) {
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
          source.machineId !== run.machineId
        ) {
          unavailable("Referenced trace event has not been captured.");
          continue;
        }
        bytes += bytesOf(source.data);
        if (bytes > 256 * 1024) {
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
      recordCount++;
      records.push({
        eventId: event.id,
        runId: event.runId,
        sessionId: run.sessionId,
        revision: row.revision,
        recordedAt: event.timestamp ?? event.observedAt,
        annotation,
        evidence,
      });
    }
    return records;
  }
  const records: WorkflowRecord[] = [];
  const delegatedRuns = new Set(
    branches.flatMap((branch) => branch.runs.map((run) => run.runId)),
  );
  const parentRuns = roots.filter(({ run }) => !delegatedRuns.has(run.id));
  for (const { run } of parentRuns) records.push(...(await recordsFor(run)));
  for (const branch of branches) {
    for (const summary of branch.runs) {
      const child = eligible.get(summary.runId);
      if (!child) continue;
      branch.records.push(...(await recordsFor(child.run)));
      if (recordCount >= 80 || bytes > 256 * 1024) branch.truncated = true;
    }
  }
  async function readsFor(
    run: AgentRun,
    budget: { count: number; limit: number },
  ) {
    const reads: WorkflowRead[] = [];
    let limited = false;
    for await (const row of ctx.db
      .query("events")
      .withIndex("by_runId_and_kind_and_sequence", (q) =>
        q.eq("runId", run.id).eq("kind", "skill_loaded"),
      )) {
      bytes += bytesOf(row.data);
      if (budget.count >= budget.limit || bytes > 256 * 1024) {
        limited = truncated = true;
        break;
      }
      budget.count++;
      if (row.machineId !== run.machineId) continue;
      const event = eventSchema.parse(redact(JSON.parse(row.data)));
      if (!event.skill) continue;
      reads.push({
        reference: { runId: event.runId, eventId: event.id },
        skill: event.skill,
        revision: row.revision,
      });
    }
    return { reads, limited };
  }
  const reads: WorkflowRead[] = [];
  const parentBudget = { count: 0, limit: 64 };
  for (const { run } of parentRuns)
    reads.push(...(await readsFor(run, parentBudget)).reads);
  const childBudget = { count: 0, limit: 32 };
  for (const branch of branches)
    for (const summary of branch.runs) {
      const child = eligible.get(summary.runId);
      if (!child) continue;
      const capture = await readsFor(child.run, childBudget);
      branch.reads.push(...capture.reads);
      if (capture.limited) branch.truncated = true;
    }
  return workflowCaptureSchema.parse({ records, reads, branches, truncated });
}
