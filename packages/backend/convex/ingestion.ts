import { v } from "convex/values";
import {
  recordSchema,
  runSchema,
  capabilityKey,
  type AgentRun,
  type SkillUse,
} from "@astack/agent-observability";
import { internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { projectList } from "./projectData";
import { resolveProject } from "@astack/agent-observability/projects";
import { paginationOptsValidator } from "convex/server";
import { queuePrompt, queueStoredPrompt, storeWorkLabel } from "./naming";
import { storeEvaluation } from "./evaluations";
import { sessionReferenceKey } from "@astack/agent-observability/delegation";
import { repositoryIdentity } from "@astack/agent-observability/projects";

function capabilities(run: AgentRun) {
  return new Map(run.skills.map((skill) => [capabilityKey(skill), skill]));
}
function facets(run: AgentRun) {
  const pairs: [string, string][] = [
    ["agent", run.agent],
    ["machine", run.machineId],
    ["status", run.status],
    ["outcome", run.outcome],
  ];
  for (const [dimension, value] of [
    ["version", run.agentVersion],
    ["project", run.projectId],
    ["repo", run.repo ?? run.cwd],
    ["branch", run.branch],
    ["work", run.work?.id],
  ] satisfies [string, string | undefined][])
    if (value) pairs.push([dimension, value]);
  for (const skill of run.skills)
    pairs.push(["skill", skill.name], ["capability", capabilityKey(skill)]);
  for (const tool of run.tools) pairs.push(["tool", tool]);
  if (run.findings.some((f) => f.severity !== "info"))
    pairs.push(["problem", "yes"]);
  return [
    ...new Map(pairs.map((pair) => [JSON.stringify(pair), pair])).values(),
  ].slice(0, 900);
}
async function storeSessions(ctx: MutationCtx, run: AgentRun) {
  const old = await ctx.db
    .query("runSessions")
    .withIndex("by_runId", (q) => q.eq("runId", run.id))
    .take(21);
  for (const item of old) await ctx.db.delete(item._id);
  const keys = new Set(run.sessionReferences.map(sessionReferenceKey));
  if (run.agent === "codex")
    keys.add(sessionReferenceKey({ kind: "codex", sessionId: run.sessionId }));
  for (const key of [...keys].slice(0, 20))
    await ctx.db.insert("runSessions", {
      machineId: run.machineId,
      key,
      runId: run.id,
      startedAt: run.startedAt,
    });
}

export async function storeRun(
  ctx: MutationCtx,
  run: AgentRun,
  revision: number,
  previous: Doc<"runs"> | null,
) {
  const before = previous?.enrolled
    ? runSchema.parse(JSON.parse(previous.data))
    : null;
  const row = {
    runId: run.id,
    machineId: run.machineId,
    revision,
    startedAt: run.startedAt,
    status: run.status,
    data: JSON.stringify(run),
    projectId: run.projectId,
    enrolled: !!run.projectId,
  };
  if (previous) await ctx.db.patch(previous._id, row);
  else await ctx.db.insert("runs", row);
  await storeSessions(ctx, run);
  await storeWorkLabel(ctx, run);
  if (
    run.work &&
    (before?.work?.id !== run.work.id || before.projectId !== run.projectId)
  )
    await queueStoredPrompt(ctx, run);
  const oldFacets = await ctx.db
    .query("facets")
    .withIndex("by_runId", (q) => q.eq("runId", run.id))
    .take(901);
  for (const facet of oldFacets) await ctx.db.delete(facet._id);
  for (const [dimension, value] of facets(run))
    await ctx.db.insert("facets", {
      dimension,
      value,
      runId: run.id,
      startedAt: run.startedAt,
    });
  const oldSkills = before ? capabilities(before) : new Map<string, SkillUse>();
  const newSkills = capabilities(run);
  const scopes = new Set(["all", before?.projectId, run.projectId]);
  for (const projectId of scopes) {
    if (!projectId) continue;
    for (const key of new Set([...oldSkills.keys(), ...newSkills.keys()])) {
      const skill = newSkills.get(key) ?? oldSkills.get(key);
      if (!skill) continue;
      const oldHas =
        oldSkills.has(key) &&
        !!before?.projectId &&
        (projectId === "all" || before.projectId === projectId);
      const newHas =
        newSkills.has(key) &&
        !!run.projectId &&
        (projectId === "all" || run.projectId === projectId);
      const count = Number(newHas) - Number(oldHas);
      const bad =
        Number(newHas && run.findings.some((f) => f.severity !== "info")) -
        Number(oldHas && before?.findings.some((f) => f.severity !== "info"));
      if (!count && !bad) continue;
      const existing = await ctx.db
        .query("projectCapabilities")
        .withIndex("by_projectId_and_key", (q) =>
          q.eq("projectId", projectId).eq("key", key),
        )
        .unique();
      const value = {
        projectId,
        key,
        name: skill.name,
        kind: skill.kind,
        hash: skill.hash,
        provenance: skill.provenance,
        runs: (existing?.runs ?? 0) + count,
        problematic: (existing?.problematic ?? 0) + bad,
      };
      if (existing) await ctx.db.patch(existing._id, value);
      else await ctx.db.insert("projectCapabilities", value);
    }
  }
}
export const ingest = internalMutation({
  args: {
    machineId: v.string(),
    records: v.array(v.object({ revision: v.number(), record: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.records.length > 2) throw new Error("Batch too large");
    const projects = await projectList(ctx);
    for (const entry of args.records) {
      const record = recordSchema.parse(JSON.parse(entry.record));
      if (!Number.isSafeInteger(entry.revision) || entry.revision <= 0)
        throw new Error("Invalid revision");
      if (record.kind === "run") {
        const run = record.value;
        if (
          run.machineId !== args.machineId ||
          !run.id.startsWith(`${args.machineId}:`)
        )
          throw new Error("Machine mismatch");
        const project = resolveProject(projects, run);
        if (!project || run.projectId !== project.projectId)
          throw new Error("Project not enabled for capture");
        const previous = await ctx.db
          .query("runs")
          .withIndex("by_runId", (q) => q.eq("runId", run.id))
          .unique();
        if (previous && previous.revision >= entry.revision) continue;
        await storeRun(ctx, run, entry.revision, previous);
        const machine = await ctx.db
          .query("machines")
          .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
          .unique();
        if (machine)
          await ctx.db.patch(machine._id, {
            name: run.machineName,
            lastSeenAt: Date.now(),
          });
        else
          await ctx.db.insert("machines", {
            machineId: args.machineId,
            name: run.machineName,
            lastSeenAt: Date.now(),
            records: 0,
          });
      } else if (record.kind === "evaluation") {
        await storeEvaluation(ctx, record.value, args.machineId);
      } else {
        const event = record.value;
        if (
          !event.runId.startsWith(`${args.machineId}:`) ||
          !event.id.startsWith(`${event.runId}:`)
        )
          throw new Error("Machine mismatch");
        const parent = await ctx.db
          .query("runs")
          .withIndex("by_runId", (q) => q.eq("runId", event.runId))
          .unique();
        const run = parent ? runSchema.parse(JSON.parse(parent.data)) : null;
        const project = run ? resolveProject(projects, run) : null;
        if (!run || !project || run.projectId !== project.projectId)
          throw new Error("Project not enabled for capture");
        if (
          event.delivery &&
          (!run.contentCapture ||
            !run.repo ||
            repositoryIdentity(run.repo) !==
              repositoryIdentity(
                `https://github.com/${event.delivery.snapshot.repository}`,
              ))
        )
          throw new Error("PR evidence outside readable repository capture");
        if (
          event.delivery &&
          new TextEncoder().encode(JSON.stringify(event)).byteLength >
            128 * 1024
        )
          throw new Error(
            "Delivery evidence exceeds the 128 KiB record budget",
          );
        const previous = await ctx.db
          .query("events")
          .withIndex("by_eventId", (q) => q.eq("eventId", event.id))
          .unique();
        if (previous && previous.revision >= entry.revision) continue;
        if (previous) {
          const original = recordSchema.parse({
            kind: "event",
            value: JSON.parse(previous.data),
          });
          if (
            original.kind === "event" &&
            original.value.delivery &&
            JSON.stringify(original.value.delivery.snapshot) !==
              JSON.stringify(event.delivery?.snapshot)
          )
            throw new Error("Delivery snapshot is immutable");
        }
        const row = {
          eventId: event.id,
          runId: event.runId,
          machineId: args.machineId,
          revision: entry.revision,
          sequence: event.sequence,
          kind: event.kind,
          data: JSON.stringify(event),
        };
        if (previous) await ctx.db.patch(previous._id, row);
        else await ctx.db.insert("events", row);
        await queuePrompt(ctx, run, event);
      }
    }
    return null;
  },
});

// Bounded administrative repair when an indexed projection gains a dimension.
export const rebuildFacets = internalMutation({
  args: { paginationOpts: paginationOptsValidator },
  returns: v.object({
    continueCursor: v.string(),
    isDone: v.boolean(),
    count: v.number(),
  }),
  handler: async (ctx, args) => {
    if (args.paginationOpts.numItems > 3)
      throw new Error("Invalid repair page");
    const page = await ctx.db.query("runs").paginate(args.paginationOpts);
    for (const row of page.page) {
      await storeSessions(ctx, runSchema.parse(JSON.parse(row.data)));
      const old = await ctx.db
        .query("facets")
        .withIndex("by_runId", (q) => q.eq("runId", row.runId))
        .take(901);
      for (const facet of old) await ctx.db.delete(facet._id);
      for (const [dimension, value] of facets(
        runSchema.parse(JSON.parse(row.data)),
      ))
        await ctx.db.insert("facets", {
          dimension,
          value,
          runId: row.runId,
          startedAt: row.startedAt,
        });
    }
    return {
      continueCursor: page.continueCursor,
      isDone: page.isDone,
      count: page.page.length,
    };
  },
});
