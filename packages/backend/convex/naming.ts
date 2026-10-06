import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import {
  eventSchema,
  runSchema,
  type AgentEvent,
  type AgentRun,
} from "@astack/agent-observability";
import {
  activityNameKey,
  workNameKey,
  generatedTitleSchema,
  namingBatchSize,
  namingExcerptLength,
} from "@astack/agent-observability/naming";
import { redactText } from "@astack/agent-observability/redaction";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireOwner } from "./access";
import { getProject, projectList } from "./projectData";
import {
  resolveProject,
  type Project,
} from "@astack/agent-observability/projects";

const leaseMs = 180_000;
type ReadCtx = Pick<QueryCtx, "db">;

function requestText(event: AgentEvent) {
  const text = event.kind === "user_prompt" ? event.data.content : undefined;
  if (typeof text !== "string" || text === "[WITHHELD]") return null;
  // Native context messages can precede the actual request in a turn.
  const request = text
    .replace(
      /<(environment_context|user_instructions|skills_instructions)>[\s\S]*?<\/\1>/gi,
      "",
    )
    .trim();
  return request ? redactText(request).slice(0, namingExcerptLength) : null;
}
async function eligibleRun(
  ctx: ReadCtx,
  id: string,
  projects: readonly Project[],
) {
  const row = await ctx.db
    .query("runs")
    .withIndex("by_runId", (q) => q.eq("runId", id))
    .unique();
  if (!row?.enrolled || !row.projectId) return null;
  const run = runSchema.parse(JSON.parse(row.data));
  if (
    !run.contentCapture ||
    run.projectId !== row.projectId ||
    resolveProject(projects, run)?.projectId !== row.projectId
  )
    return null;
  return run;
}
async function inputs(
  ctx: ReadCtx,
  job: Doc<"names">,
  projects: readonly Project[],
) {
  const result: {
    runId: string;
    eventId: string;
    revision: number;
    text: string;
  }[] = [];
  for (const source of job.sources) {
    const run = await eligibleRun(ctx, source.runId, projects);
    if (
      !run ||
      run.projectId !== job.projectId ||
      (job.kind === "work"
        ? run.work?.id !== job.targetId || !!run.work.label
        : run.id !== job.targetId)
    )
      continue;
    const event = await ctx.db
      .query("events")
      .withIndex("by_eventId", (q) => q.eq("eventId", source.eventId))
      .unique();
    if (!event || event.runId !== run.id) continue;
    const text = requestText(eventSchema.parse(JSON.parse(event.data)));
    if (text) result.push({ ...source, revision: event.revision, text });
  }
  return result;
}
async function queue(
  ctx: MutationCtx,
  run: AgentRun,
  event: AgentEvent,
  kind: "activity" | "work",
) {
  if (
    !run.projectId ||
    !run.contentCapture ||
    !requestText(event) ||
    (kind === "work" && (!run.work || run.work.label))
  )
    return;
  const targetId = kind === "activity" ? run.id : run.work?.id;
  if (!targetId) return;
  const key =
    kind === "activity"
      ? activityNameKey(run.projectId, targetId)
      : workNameKey(run.projectId, targetId);
  const job = await ctx.db
    .query("names")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (job?.state === "ready") return;
  const source = { runId: run.id, eventId: event.id };
  if (job) {
    // One request per turn; Work takes a bounded sample from distinct turns.
    const sources =
      job.state === "skipped"
        ? [source]
        : job.sources.some((s) => s.runId === run.id)
          ? job.sources
          : [...job.sources, source].slice(0, 4);
    await ctx.db.patch(job._id, {
      sources,
      ...(job.state === "skipped"
        ? {
            state: "pending" as const,
            availableAt: Date.now() + 60_000,
            attempts: 0,
          }
        : {}),
    });
  } else
    await ctx.db.insert("names", {
      key,
      kind,
      projectId: run.projectId,
      targetId,
      sources: [source],
      state: "pending",
      availableAt: Date.now() + 60_000,
      attempts: 0,
    });
}
// Used only after capture policy and persisted parent/event validation.
export async function queuePrompt(
  ctx: MutationCtx,
  run: AgentRun,
  event: AgentEvent,
) {
  await queue(ctx, run, event, "activity");
  await queue(ctx, run, event, "work");
}
export async function queueStoredPrompt(ctx: MutationCtx, run: AgentRun) {
  if (!run.contentCapture) return;
  const events = await ctx.db
    .query("events")
    .withIndex("by_runId_and_sequence", (q) => q.eq("runId", run.id))
    .take(16);
  for (const row of events) {
    const event = eventSchema.parse(JSON.parse(row.data));
    if (requestText(event)) {
      await queuePrompt(ctx, run, event);
      break;
    }
  }
}

export async function storeWorkLabel(ctx: MutationCtx, run: AgentRun) {
  if (!run.projectId || !run.work?.label) return;
  const key = workNameKey(run.projectId, run.work.id);
  const existing = await ctx.db
    .query("names")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (
    existing?.state === "ready" &&
    existing.title === run.work.label &&
    !existing.model
  )
    return;
  const label = {
    state: "ready" as const,
    title: run.work.label,
    model: undefined,
    claim: undefined,
    snapshot: undefined,
  };
  if (existing) await ctx.db.patch(existing._id, label);
  else
    await ctx.db.insert("names", {
      key,
      kind: "work",
      projectId: run.projectId,
      targetId: run.work.id,
      sources: [],
      availableAt: 0,
      attempts: 0,
      ...label,
    });
}

export const claim = mutation({
  args: {},
  returns: v.array(
    v.object({
      key: v.string(),
      claim: v.string(),
      kind: v.union(v.literal("activity"), v.literal("work")),
      requests: v.array(v.string()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const now = Date.now();
    const projects = await projectList(ctx);
    const jobs = await ctx.db
      .query("names")
      .withIndex("by_state_and_availableAt", (q) =>
        q.eq("state", "pending").lte("availableAt", now),
      )
      .take(namingBatchSize);
    const batch = [];
    for (const job of jobs) {
      const requests = await inputs(ctx, job, projects);
      if (!requests.length) {
        await ctx.db.patch(job._id, {
          state: "skipped",
          claim: undefined,
          snapshot: undefined,
        });
        continue;
      }
      const claim = crypto.randomUUID();
      await ctx.db.patch(job._id, {
        claim,
        availableAt: now + leaseMs,
        attempts: job.attempts + 1,
        snapshot: requests.map(({ text: _text, ...source }) => source),
      });
      batch.push({
        key: job.key,
        kind: job.kind,
        claim,
        requests: requests.map((r) => r.text),
      });
    }
    return batch;
  },
});
export const complete = mutation({
  args: {
    names: v.array(
      v.object({ key: v.string(), claim: v.string(), title: v.string() }),
    ),
    model: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (
      !args.names.length ||
      args.names.length > namingBatchSize ||
      args.model.length > 100
    )
      throw new Error("Invalid naming batch");
    let count = 0;
    const projects = await projectList(ctx);
    for (const name of args.names) {
      const title = generatedTitleSchema.parse(redactText(name.title));
      const job = await ctx.db
        .query("names")
        .withIndex("by_key", (q) => q.eq("key", name.key))
        .unique();
      if (
        !job ||
        job.state !== "pending" ||
        job.claim !== name.claim ||
        job.availableAt <= Date.now()
      )
        continue;
      const current = await inputs(ctx, job, projects);
      const valid =
        job.snapshot?.length &&
        job.snapshot.every((source) =>
          current.some(
            (s) =>
              s.eventId === source.eventId &&
              s.runId === source.runId &&
              s.revision === source.revision,
          ),
        );
      await ctx.db.patch(
        job._id,
        valid
          ? {
              state: "ready",
              title,
              model: args.model,
              claim: undefined,
              snapshot: undefined,
            }
          : {
              state: current.length ? "pending" : "skipped",
              availableAt: Date.now() + 60_000,
              claim: undefined,
              snapshot: undefined,
            },
      );
      if (valid) count++;
    }
    return count;
  },
});
export const fail = mutation({
  args: { claims: v.array(v.object({ key: v.string(), claim: v.string() })) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.claims.length > namingBatchSize)
      throw new Error("Invalid naming batch");
    for (const claim of args.claims) {
      const job = await ctx.db
        .query("names")
        .withIndex("by_key", (q) => q.eq("key", claim.key))
        .unique();
      if (job?.state === "pending" && job.claim === claim.claim)
        await ctx.db.patch(job._id, {
          availableAt:
            Date.now() +
            Math.min(3_600_000, 60_000 * 2 ** Math.min(job.attempts, 6)),
          claim: undefined,
          snapshot: undefined,
        });
    }
    return null;
  },
});
export const backfill = mutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 3
    )
      throw new Error("Invalid backfill page");
    const page = await ctx.db
      .query("runs")
      .withIndex("by_enrolled_and_startedAt", (q) => q.eq("enrolled", true))
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumBytesRead: 400_000 });
    const projects = await projectList(ctx);
    for (const row of page.page) {
      await storeWorkLabel(ctx, runSchema.parse(JSON.parse(row.data)));
      const run = await eligibleRun(ctx, row.runId, projects);
      if (run) await queueStoredPrompt(ctx, run);
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      count: page.page.length,
    };
  },
});
export const labels = query({
  args: { runIds: v.array(v.string()) },
  returns: v.array(
    v.object({
      runId: v.string(),
      activity: v.optional(v.string()),
      work: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.runIds.length > 50) throw new Error("Invalid names page");
    const result = [];
    for (const runId of new Set(args.runIds)) {
      const row = await ctx.db
        .query("runs")
        .withIndex("by_runId", (q) => q.eq("runId", runId))
        .unique();
      if (
        !row?.enrolled ||
        !row.projectId ||
        !(await getProject(ctx, row.projectId))
      )
        continue;
      const run = runSchema.parse(JSON.parse(row.data));
      const activityKey = activityNameKey(row.projectId, runId);
      const activity = await ctx.db
        .query("names")
        .withIndex("by_key", (q) => q.eq("key", activityKey))
        .unique();
      const workKey = run.work ? workNameKey(row.projectId, run.work.id) : null;
      const work = workKey
        ? await ctx.db
            .query("names")
            .withIndex("by_key", (q) => q.eq("key", workKey))
            .unique()
        : null;
      result.push({
        runId,
        ...(activity?.state === "ready" ? { activity: activity.title } : {}),
        ...(work?.state === "ready" ? { work: work.title } : {}),
      });
    }
    return result;
  },
});
