import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { z } from "zod";
import {
  runSchema,
  filterSchema,
  capabilityKey,
} from "@astack/agent-observability";
import { query } from "./_generated/server";
import { requireOwner } from "./access";
import { getProject } from "./projectData";

const matches = (
  run: z.infer<typeof runSchema>,
  dimension: z.infer<typeof filterSchema>["dimension"],
  value: string,
) => {
  switch (dimension) {
    case "agent":
      return run.agent === value;
    case "machine":
      return run.machineId === value;
    case "status":
      return run.status === value;
    case "version":
      return run.agentVersion === value;
    case "project":
      return run.projectId === value;
    case "repo":
      return (run.repo ?? run.cwd) === value;
    case "branch":
      return run.branch === value;
    case "work":
      return run.work?.id === value;
    case "skill":
      return run.skills.some((s) => s.name === value);
    case "outcome":
      return run.outcome === value;
    case "capability":
      return run.skills.some((s) => capabilityKey(s) === value);
    case "tool":
      return run.tools.includes(value);
    case "problem":
      return run.findings.some((f) => f.severity !== "info");
  }
};
export const runs = query({
  args: {
    projectId: v.optional(v.string()),
    filters: v.array(v.object({ dimension: v.string(), value: v.string() })),
    after: v.optional(v.number()),
    before: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.string()),
    continueCursor: v.string(),
    isDone: v.boolean(),
    scanned: v.number(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.filters.length > 13 || args.paginationOpts.numItems > 100)
      throw new Error("Invalid page");
    const filters = [
      ...(args.projectId
        ? [{ dimension: "project", value: args.projectId }]
        : []),
      ...args.filters,
    ].map((f) => filterSchema.parse(f));
    const first = filters[0];
    if (first) {
      const page = await ctx.db
        .query("facets")
        .withIndex("by_dimension_and_value_and_startedAt", (q) =>
          q.eq("dimension", first.dimension).eq("value", first.value),
        )
        .order("desc")
        .paginate(args.paginationOpts);
      const data: string[] = [];
      for (const facet of page.page) {
        const row = await ctx.db
          .query("runs")
          .withIndex("by_runId", (q) => q.eq("runId", facet.runId))
          .unique();
        if (!row?.enrolled) continue;
        const run = runSchema.parse(JSON.parse(row.data));
        if (
          filters.every((f) => matches(run, f.dimension, f.value)) &&
          (!args.after || run.startedAt >= args.after) &&
          (!args.before || run.startedAt <= args.before)
        )
          data.push(row.data);
      }
      return {
        page: data,
        continueCursor: page.continueCursor,
        isDone: page.isDone,
        scanned: page.page.length,
      };
    }
    const page = await ctx.db
      .query("runs")
      .withIndex("by_enrolled_and_startedAt", (q) => {
        let range = q.eq("enrolled", true).gte("startedAt", args.after ?? 0);
        return args.before === undefined
          ? range
          : range.lte("startedAt", args.before);
      })
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      page: page.page.map((row) => row.data),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      scanned: page.page.length,
    };
  },
});
export const run = query({
  args: { runId: v.string(), projectId: v.optional(v.string()) },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (
      !row?.projectId ||
      !row.enrolled ||
      (args.projectId && args.projectId !== row.projectId) ||
      !(await getProject(ctx, row.projectId))
    )
      return null;
    return row.data;
  },
});
export const trace = query({
  args: {
    runId: v.string(),
    projectId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.string()),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.paginationOpts.numItems > 200) throw new Error("Invalid page");
    const parent = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .unique();
    if (
      !parent?.projectId ||
      !parent.enrolled ||
      (args.projectId && args.projectId !== parent.projectId) ||
      !(await getProject(ctx, parent.projectId))
    )
      return { page: [], continueCursor: "", isDone: true };
    const page = await ctx.db
      .query("events")
      .withIndex("by_runId_and_sequence", (q) => q.eq("runId", args.runId))
      .paginate(args.paginationOpts);
    return {
      page: page.page.map((row) => row.data),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
export const capabilities = query({
  args: {
    projectId: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  returns: v.object({
    page: v.array(v.string()),
    continueCursor: v.string(),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    if (args.paginationOpts.numItems > 100) throw new Error("Invalid page");
    const page = await ctx.db
      .query("projectCapabilities")
      .withIndex("by_projectId_and_problematic", (q) =>
        q.eq("projectId", args.projectId ?? "all"),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      page: page.page.map((row) => JSON.stringify(row)),
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
export const machines = query({
  args: {},
  returns: v.array(
    v.object({
      machineId: v.string(),
      name: v.string(),
      lastSeenAt: v.number(),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return (await ctx.db.query("machines").take(100)).map((row) => ({
      machineId: row.machineId,
      name: row.name,
      lastSeenAt: row.lastSeenAt,
    }));
  },
});
