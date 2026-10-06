import { v, ConvexError } from "convex/values";
import { z } from "zod";
import { paginationOptsValidator } from "convex/server";
import {
  projectSchema,
  resolveProject,
} from "@astack/agent-observability/projects";
import { runSchema } from "@astack/agent-observability";
import {
  query,
  mutation,
  internalQuery,
  internalMutation,
  type MutationCtx,
} from "./_generated/server";
import { requireOwner } from "./access";
import { getProject, projectList, projectValidator } from "./projectData";
import { storeRun } from "./ingestion";
import { internal } from "./_generated/api";

export const list = query({
  args: {},
  returns: v.array(projectValidator),
  handler: async (ctx) => {
    await requireOwner(ctx);
    return projectList(ctx);
  },
});
export const machines = query({
  args: {},
  returns: v.array(v.object({ machineId: v.string(), name: v.string() })),
  handler: async (ctx) => {
    await requireOwner(ctx);
    let config: unknown;
    try {
      config = JSON.parse(process.env.AGENTLOG_MACHINES ?? "[]");
    } catch {
      return [];
    }
    const parsed = z
      .array(
        z.object({
          machineId: z.string().uuid(),
          tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
          machineName: z.string().max(512).optional(),
        }),
      )
      .max(100)
      .safeParse(config);
    if (!parsed.success) return [];
    const observed = await ctx.db.query("machines").take(100);
    return parsed.data.map((m) => ({
      machineId: m.machineId,
      name:
        observed.find((o) => o.machineId === m.machineId)?.name ??
        m.machineName ??
        `Computer ${m.machineId.slice(-8)}`,
    }));
  },
});
export const save = mutation({
  args: { project: projectValidator },
  returns: v.string(),
  handler: async (ctx, { project }) => {
    await requireOwner(ctx);
    const parsed = projectSchema.parse(project);
    const previous = await getProject(ctx, parsed.projectId);
    const others = (await projectList(ctx)).filter(
      (p) => p.projectId !== parsed.projectId,
    );
    if (
      others.some((p) =>
        p.repositories.some((repo) => parsed.repositories.includes(repo)),
      )
    )
      throw new ConvexError(
        "That repository is already enrolled in another project.",
      );
    if (!previous && (await ctx.db.query("projects").take(100)).length >= 100)
      throw new ConvexError("Project limit reached.");
    if (previous) await ctx.db.patch(previous._id, parsed);
    else await ctx.db.insert("projects", parsed);
    await ctx.scheduler.runAfter(0, internal.projects.migrateSweep, {
      cursor: null,
    });
    return parsed.projectId;
  },
});
export const policy = internalQuery({
  args: { machineId: v.string() },
  returns: v.array(projectValidator),
  handler: async (ctx, args) =>
    (await projectList(ctx))
      .filter(
        (p) =>
          p.repositories.length ||
          p.folders.some((f) => f.machineId === args.machineId),
      )
      .map((p) => ({
        ...p,
        folders: p.folders.filter((f) => f.machineId === args.machineId),
      })),
});
export const migrate = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    assigned: v.number(),
    unmatched: v.number(),
  }),
  handler: async (ctx, args) => migratePage(ctx, args.paginationOpts),
});
async function migratePage(
  ctx: MutationCtx,
  paginationOpts: { numItems: number; cursor: string | null },
) {
  if (paginationOpts.numItems > 2) throw new Error("Invalid migration page");
  const projects = await projectList(ctx);
  const page = await ctx.db.query("runs").paginate(paginationOpts);
  let assigned = 0,
    unmatched = 0;
  for (const row of page.page) {
    const before = runSchema.parse(JSON.parse(row.data));
    const project = resolveProject(projects, before);
    if (!project) {
      unmatched++;
      continue;
    }
    if (row.projectId === project.projectId && row.enrolled) continue;
    // Add classification without altering collector revision or observed history.
    await storeRun(
      ctx,
      { ...before, projectId: project.projectId },
      row.revision,
      row,
    );
    assigned++;
  }
  return {
    continueCursor: page.continueCursor,
    isDone: page.isDone,
    assigned,
    unmatched,
  };
}
export const migrateSweep = internalMutation({
  args: { cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await migratePage(ctx, { numItems: 2, cursor: args.cursor });
    if (!page.isDone)
      await ctx.scheduler.runAfter(0, internal.projects.migrateSweep, {
        cursor: page.continueCursor,
      });
    return null;
  },
});
