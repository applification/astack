import { v } from "convex/values";
import { projectSchema } from "@astack/agent-observability/projects";
import type { QueryCtx } from "./_generated/server";

// projectId is a portable UUID, rather than a deployment-specific Convex document ID.
export const projectValidator = v.object({
  projectId: v.string(),
  name: v.string(),
  enabled: v.boolean(),
  repositories: v.array(v.string()),
  folders: v.array(v.object({ machineId: v.string(), path: v.string() })),
});
export async function projectList(ctx: Pick<QueryCtx, "db">) {
  return (await ctx.db.query("projects").take(101)).map(
    ({ _id, _creationTime, ...p }) => projectSchema.parse(p),
  );
}
export async function getProject(ctx: Pick<QueryCtx, "db">, projectId: string) {
  return ctx.db
    .query("projects")
    .withIndex("by_projectId", (q) => q.eq("projectId", projectId))
    .unique();
}
