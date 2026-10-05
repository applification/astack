import { v } from "convex/values";
import {
  recordSchema,
  runSchema,
  capabilityKey,
  type AgentRun,
  type SkillUse,
} from "@astack/agent-observability";
import { internalMutation } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

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
export const ingest = internalMutation({
  args: {
    machineId: v.string(),
    records: v.array(v.object({ revision: v.number(), record: v.string() })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.records.length > 3) throw new Error("Batch too large");
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
        const previous = await ctx.db
          .query("runs")
          .withIndex("by_runId", (q) => q.eq("runId", run.id))
          .unique();
        if (previous && previous.revision >= entry.revision) continue;
        const before = previous
          ? runSchema.parse(JSON.parse(previous.data))
          : null;
        const row = {
          runId: run.id,
          machineId: args.machineId,
          revision: entry.revision,
          startedAt: run.startedAt,
          status: run.status,
          data: JSON.stringify(run),
        };
        if (previous) await ctx.db.patch(previous._id, row);
        else await ctx.db.insert("runs", row);
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
        const oldSkills = before
          ? capabilities(before)
          : new Map<string, SkillUse>();
        const newSkills = capabilities(run);
        for (const key of new Set([...oldSkills.keys(), ...newSkills.keys()])) {
          const skill = newSkills.get(key) ?? oldSkills.get(key);
          if (!skill) continue;
          const existing = await ctx.db
            .query("capabilities")
            .withIndex("by_key", (q) => q.eq("key", key))
            .unique();
          const count = Number(newSkills.has(key)) - Number(oldSkills.has(key));
          const bad =
            Number(
              newSkills.has(key) &&
                run.findings.some((f) => f.severity !== "info"),
            ) -
            Number(
              oldSkills.has(key) &&
                before?.findings.some((f) => f.severity !== "info"),
            );
          const value = {
            key,
            name: skill.name,
            kind: skill.kind,
            hash: skill.hash,
            provenance: skill.provenance,
            runs: (existing?.runs ?? 0) + count,
            problematic: (existing?.problematic ?? 0) + bad,
          };
          if (existing) await ctx.db.patch(existing._id, value);
          else await ctx.db.insert("capabilities", value);
        }
      } else {
        const event = record.value;
        if (
          !event.runId.startsWith(`${args.machineId}:`) ||
          !event.id.startsWith(`${event.runId}:`)
        )
          throw new Error("Machine mismatch");
        const previous = await ctx.db
          .query("events")
          .withIndex("by_eventId", (q) => q.eq("eventId", event.id))
          .unique();
        if (previous && previous.revision >= entry.revision) continue;
        const row = {
          eventId: event.id,
          runId: event.runId,
          machineId: args.machineId,
          revision: entry.revision,
          sequence: event.sequence,
          data: JSON.stringify(event),
        };
        if (previous) await ctx.db.patch(previous._id, row);
        else await ctx.db.insert("events", row);
      }
    }
    const machine = await ctx.db
      .query("machines")
      .withIndex("by_machineId", (q) => q.eq("machineId", args.machineId))
      .unique();
    if (machine) await ctx.db.patch(machine._id, { lastSeenAt: Date.now() });
    else
      await ctx.db.insert("machines", {
        machineId: args.machineId,
        name: args.machineId,
        lastSeenAt: Date.now(),
        records: 0,
      });
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
