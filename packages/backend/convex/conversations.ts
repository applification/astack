import { v } from "convex/values";
import { evaluationSchema } from "@astack/agent-observability/evaluations";
import { paginationOptsValidator } from "convex/server";
import {
  query,
  internalMutation,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireOwner } from "./access";
import { getProject } from "./projectData";
import { runSchema, type AgentRun } from "@astack/agent-observability";
import {
  conversationGroupKey,
  conversationGroupSchema,
  runConversation,
} from "@astack/agent-observability/conversations";
import {
  sessionReferenceKey,
  sessionReferenceSchema,
} from "@astack/agent-observability/delegation";
import {
  activityHeading,
  activityNameKey,
} from "@astack/agent-observability/naming";

const byGroup = (ctx: QueryCtx | MutationCtx, groupId: string) =>
  ctx.db
    .query("conversationGroups")
    .withIndex("by_groupId", (q) => q.eq("groupId", groupId))
    .unique();

async function refreshGroup(
  ctx: MutationCtx,
  groupId: string,
  delta: number,
  delegatedDelta: number,
) {
  const group = await byGroup(ctx, groupId);
  if (!group) return;
  const turns = group.turns + delta;
  if (!turns) {
    await ctx.db.delete(group._id);
    return;
  }
  const latest = await ctx.db
    .query("conversationTurns")
    .withIndex("by_groupId_and_lastActivityAt", (q) => q.eq("groupId", groupId))
    .order("desc")
    .first();
  const root = await ctx.db
    .query("conversationTurns")
    .withIndex("by_groupId_and_isRoot_and_startedAt", (q) =>
      q.eq("groupId", groupId).eq("isRoot", true),
    )
    .order("asc")
    .first();
  await ctx.db.patch(group._id, {
    turns,
    delegatedTurns: group.delegatedTurns + delegatedDelta,
    rootRunId: root?.runId,
    rootStartedAt: root?.startedAt,
    lastActivityAt: latest?.lastActivityAt ?? group.lastActivityAt,
  });
}

export async function storeConversation(ctx: MutationCtx, run: AgentRun) {
  const prior = await ctx.db
    .query("conversationTurns")
    .withIndex("by_runId", (q) => q.eq("runId", run.id))
    .unique();
  const conversation = runConversation(run);
  const groupId = conversationGroupKey(run);
  if (prior) await ctx.db.delete(prior._id);
  if (!conversation || !groupId || !run.projectId) {
    if (prior)
      await refreshGroup(ctx, prior.groupId, -1, prior.isRoot ? 0 : -1);
    return;
  }
  const isRoot =
    sessionReferenceKey(conversation.self) ===
    sessionReferenceKey(conversation.root);
  const lastActivityAt = run.lastActivityAt ?? run.completedAt ?? run.startedAt;
  await ctx.db.insert("conversationTurns", {
    runId: run.id,
    groupId,
    isRoot,
    startedAt: run.startedAt,
    lastActivityAt,
  });
  if (prior && prior.groupId !== groupId)
    await refreshGroup(ctx, prior.groupId, -1, prior.isRoot ? 0 : -1);
  const group = await byGroup(ctx, groupId);
  if (!group) {
    await ctx.db.insert("conversationGroups", {
      groupId,
      projectId: run.projectId,
      machineId: run.machineId,
      machineName: run.machineName,
      root: JSON.stringify(conversation.root),
      ...(isRoot ? { rootRunId: run.id, rootStartedAt: run.startedAt } : {}),
      turns: 1,
      delegatedTurns: isRoot ? 0 : 1,
      lastActivityAt,
    });
  } else {
    const sameGroup = prior?.groupId === groupId;
    await refreshGroup(
      ctx,
      groupId,
      sameGroup ? 0 : 1,
      sameGroup ? Number(!isRoot) - Number(!prior.isRoot) : Number(!isRoot),
    );
    if (group.machineName !== run.machineName)
      await ctx.db.patch(group._id, { machineName: run.machineName });
  }
}

async function summary(ctx: QueryCtx, row: Doc<"conversationGroups">) {
  let title = "Orchestration thread · root capture unavailable";
  let rootRunId: string | null = null;
  if (row.rootRunId) {
    const stored = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", row.rootRunId!))
      .unique();
    if (
      stored?.enrolled &&
      stored.projectId === row.projectId &&
      stored.machineId === row.machineId
    ) {
      const run = runSchema.parse(JSON.parse(stored.data));
      const name = await ctx.db
        .query("names")
        .withIndex("by_key", (q) =>
          q.eq("key", activityNameKey(row.projectId, run.id)),
        )
        .unique();
      title = activityHeading(
        run,
        name?.state === "ready" && name.title
          ? { runId: run.id, activity: name.title }
          : undefined,
      );
      rootRunId = run.id;
    }
  }
  return JSON.stringify(
    conversationGroupSchema.parse({
      id: row.groupId,
      projectId: row.projectId,
      machineId: row.machineId,
      machineName: row.machineName,
      root: sessionReferenceSchema.parse(JSON.parse(row.root)),
      title,
      rootRunId,
      turns: row.turns,
      delegatedTurns: row.delegatedTurns,
      lastActivityAt: row.lastActivityAt,
    }),
  );
}
const pageValidator = v.object({
  page: v.array(v.string()),
  continueCursor: v.string(),
  isDone: v.boolean(),
  pageStatus: v.optional(
    v.union(
      v.literal("SplitRecommended"),
      v.literal("SplitRequired"),
      v.null(),
    ),
  ),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});
// Historical capture is projected in bounded, resumable pages without rewriting it.
export const rebuild = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 3
    )
      throw new Error("Invalid repair page");
    const page = await ctx.db
      .query("runs")
      .paginate({
        ...args.paginationOpts,
        maximumBytesRead: 1_000_000,
        maximumRowsRead: 200,
      });
    for (const row of page.page) {
      const run = runSchema.parse(JSON.parse(row.data));
      await storeConversation(
        ctx,
        row.enrolled ? run : { ...run, projectId: undefined },
      );
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      count: page.page.length,
    };
  },
});
export const forEvaluation = query({
  args: { evaluationId: v.string(), projectId: v.optional(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db
      .query("evaluations")
      .withIndex("by_evaluationId", (q) =>
        q.eq("evaluationId", args.evaluationId),
      )
      .unique();
    if (
      !row ||
      (args.projectId && row.projectId !== args.projectId) ||
      !(await getProject(ctx, row.projectId))
    )
      return [];
    const evaluation = evaluationSchema.parse(JSON.parse(row.data));
    const groups = new Set<string>();
    for (const runId of evaluation.runIds) {
      const member = await ctx.db
        .query("conversationTurns")
        .withIndex("by_runId", (q) => q.eq("runId", runId))
        .unique();
      if (member) groups.add(member.groupId);
    }
    const result = [];
    for (const groupId of groups) {
      const group = await byGroup(ctx, groupId);
      if (
        group?.projectId === row.projectId &&
        group.machineId === row.machineId
      )
        result.push(await summary(ctx, group));
    }
    return result;
  },
});
function checkPage(page: { numItems: number }) {
  if (
    !Number.isInteger(page.numItems) ||
    page.numItems < 1 ||
    page.numItems > 50
  )
    throw new Error("Invalid page");
}
export const groups = query({
  args: {
    projectId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: pageValidator,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    checkPage(args.paginationOpts);
    if (args.projectId && !(await getProject(ctx, args.projectId)))
      return { page: [], continueCursor: "", isDone: true };
    const results = await (
      args.projectId
        ? ctx.db
            .query("conversationGroups")
            .withIndex("by_projectId_and_lastActivityAt", (q) =>
              q.eq("projectId", args.projectId!),
            )
        : ctx.db.query("conversationGroups").withIndex("by_lastActivityAt")
    )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumBytesRead: 1_000_000,
        maximumRowsRead: 200,
      });
    const page = [];
    for (const row of results.page) {
      if (await getProject(ctx, row.projectId))
        page.push(await summary(ctx, row));
    }
    return {
      ...results,
      page,
    };
  },
});
export const group = query({
  args: { groupId: v.string(), projectId: v.optional(v.string()) },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await byGroup(ctx, args.groupId);
    if (
      !row ||
      (args.projectId && row.projectId !== args.projectId) ||
      !(await getProject(ctx, row.projectId))
    )
      return null;
    return summary(ctx, row);
  },
});
export const turns = query({
  args: {
    groupId: v.string(),
    projectId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: pageValidator,
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    checkPage(args.paginationOpts);
    const row = await byGroup(ctx, args.groupId);
    if (
      !row ||
      (args.projectId && row.projectId !== args.projectId) ||
      !(await getProject(ctx, row.projectId))
    )
      return { page: [], continueCursor: "", isDone: true };
    const results = await ctx.db
      .query("conversationTurns")
      .withIndex("by_groupId_and_startedAt", (q) =>
        q.eq("groupId", args.groupId),
      )
      .order("desc")
      .paginate({
        ...args.paginationOpts,
        maximumBytesRead: 1_000_000,
        maximumRowsRead: 200,
      });
    const page = [];
    for (const member of results.page) {
      const run = await ctx.db
        .query("runs")
        .withIndex("by_runId", (q) => q.eq("runId", member.runId))
        .unique();
      if (
        run?.enrolled &&
        run.projectId === row.projectId &&
        run.machineId === row.machineId
      )
        page.push(run.data);
    }
    return {
      ...results,
      page,
    };
  },
});
