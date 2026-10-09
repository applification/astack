import {
  eventSchema,
  runSchema,
  type AgentRun,
} from "@astack/agent-observability";
import { sessionReferenceKey } from "@astack/agent-observability/delegation";
import { runConversation } from "@astack/agent-observability/conversations";
import { resolveProject } from "@astack/agent-observability/projects";
import { redact } from "@astack/agent-observability/redaction";
import {
  workflowCaptureSchema,
  type WorkflowRecord,
  type WorkflowBranch,
  type WorkflowRead,
  type WorkflowResult,
  workflowActivitySchema,
  workflowBranchIdentity,
  branchOwnsRun,
  type WorkflowActivity,
  type WorkflowRun,
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
  // Parent observations do not require a collected child trace. A known child
  // access restriction still blocks them; missing capture is a coverage gap.
  const resultBranches = new Set<WorkflowBranch>();
  let children = 0;
  const visited = new Set<string>();
  const tasks = new Map<string, WorkflowBranch>();
  for (const { run: parent } of roots) {
    for (const delegation of parent.delegations) {
      const taskKey = workflowBranchIdentity(parent, delegation);
      const existing = tasks.get(taskKey);
      if (existing) {
        if (!existing.parentRunIds?.includes(parent.id))
          existing.parentRunIds?.push(parent.id);
        continue;
      }
      if (branches.length >= 32) {
        truncated = true;
        break;
      }
      const branch: WorkflowBranch = {
        parentRunId: parent.id,
        parentRunIds: [parent.id],
        identity: taskKey,
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
      tasks.set(taskKey, branch);
      const childReference = delegation.child;
      if (!childReference) {
        resultBranches.add(branch);
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
      if (!matches.length) {
        resultBranches.add(branch);
        branch.reason = "Child capture has not been collected.";
      }
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
        resultBranches.add(branch);
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
  const results: WorkflowResult[] = [];
  let resultCount = 0;
  // Three independent observations per direct task fit the branch budget. The
  // shared byte budget still covers every event, run and evidence preview.
  for (const { run } of parentRuns) {
    for await (const row of ctx.db
      .query("events")
      .withIndex("by_runId_and_kind_and_sequence", (q) =>
        q.eq("runId", run.id).eq("kind", "delegation_result"),
      )) {
      bytes += bytesOf(row.data);
      if (++resultCount > 96 || bytes > 256 * 1024) {
        truncated = true;
        break;
      }
      if (row.machineId !== run.machineId) continue;
      const event = eventSchema.parse(redact(JSON.parse(row.data)));
      const result = event.delegationResult;
      if (!result || event.runId !== run.id || event.id !== row.eventId)
        continue;
      const branch = branches.find(
        (entry) =>
          branchOwnsRun(entry, run.id) &&
          entry.delegation.id === result.delegationId &&
          entry.delegation.source === "t3" &&
          resultBranches.has(entry) &&
          JSON.stringify(entry.delegation.child) ===
            JSON.stringify(result.child),
      );
      if (
        !branch ||
        !run.sessionReferences.some(
          (ref) =>
            ref.kind === "t3" &&
            ref.environmentId === result.host.environmentId &&
            ref.threadId === result.host.threadId,
        ) ||
        (result.host.runId !== null &&
          run.conversation?.hostRun?.id !== result.host.runId)
      )
        continue;
      results.push({
        delegationId: result.delegationId,
        reference: { runId: event.runId, eventId: event.id },
        revision: row.revision,
        observedAt: event.observedAt,
        title: event.title.slice(0, 240),
        source: result.source,
        host: result.host,
        observation: result.observation,
        sourceUpdatedAt: result.sourceUpdatedAt,
        occurredAt: result.occurredAt,
      });
    }
    if (resultCount > 96 || bytes > 256 * 1024) break;
  }
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
  const summaries: WorkflowRun[] = [];
  const activities: WorkflowActivity[] = [];
  for (const { run, revision } of eligible.values()) {
    let activityLimited = false;
    if (activities.length >= 192 || bytes >= 256 * 1024) {
      activityLimited = truncated = true;
    } else {
      // A prefix scan also supports legacy rows whose indexed kind is absent.
      // Arbitrary event data and command signatures never cross this boundary.
      let scanned = 0;
      for await (const row of ctx.db
        .query("events")
        .withIndex("by_runId_and_sequence", (q) => q.eq("runId", run.id))) {
        if (++scanned > 48) {
          activityLimited = truncated = true;
          break;
        }
        bytes += bytesOf(row.data);
        if (activities.length >= 192 || bytes > 256 * 1024) {
          activityLimited = truncated = true;
          break;
        }
        if (row.machineId !== run.machineId) continue;
        const event = eventSchema.parse(redact(JSON.parse(row.data)));
        if (event.runId !== run.id || event.id !== row.eventId) continue;
        const preview = workflowActivitySchema.safeParse({
          reference: { runId: event.runId, eventId: event.id },
          revision: row.revision,
          kind: event.kind,
          title: event.title.slice(0, 240),
          sequence: event.sequence,
          timestamp: event.timestamp,
          observedAt: event.observedAt,
          timing: event.timing,
          tool: event.tool,
          failed: event.failed,
          durationMs: event.durationMs,
        });
        if (preview.success) activities.push(preview.data);
      }
    }
    summaries.push({
      runId: run.id,
      machineId: run.machineId,
      projectId: project.projectId,
      title: run.title.slice(0, 240),
      status: run.status,
      revision,
      conversation: runConversation(run),
      activityLimited,
    });
  }
  return workflowCaptureSchema.parse({
    records,
    reads,
    branches,
    results,
    runs: summaries,
    activities,
    truncated,
  });
}
