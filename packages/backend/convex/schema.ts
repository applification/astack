import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runs: defineTable({
    runId: v.string(),
    machineId: v.string(),
    revision: v.number(),
    startedAt: v.number(),
    status: v.union(
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("interrupted"),
      v.literal("unknown"),
    ),
    data: v.string(),
  })
    .index("by_runId", ["runId"])
    .index("by_startedAt", ["startedAt"]),
  events: defineTable({
    eventId: v.string(),
    runId: v.string(),
    machineId: v.string(),
    revision: v.number(),
    sequence: v.number(),
    data: v.string(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_runId_and_sequence", ["runId", "sequence"]),
  facets: defineTable({
    dimension: v.string(),
    value: v.string(),
    runId: v.string(),
    startedAt: v.number(),
  })
    .index("by_dimension_and_value_and_startedAt", [
      "dimension",
      "value",
      "startedAt",
    ])
    .index("by_runId", ["runId"]),
  capabilities: defineTable({
    key: v.string(),
    name: v.string(),
    kind: v.union(
      v.literal("skill"),
      v.literal("instruction"),
      v.literal("workflow"),
    ),
    hash: v.union(v.string(), v.null()),
    provenance: v.union(
      v.literal("observation_time"),
      v.literal("use_time"),
      v.literal("declared"),
    ),
    runs: v.number(),
    problematic: v.number(),
  })
    .index("by_key", ["key"])
    .index("by_problematic", ["problematic"]),
  machines: defineTable({
    machineId: v.string(),
    name: v.string(),
    lastSeenAt: v.number(),
    records: v.number(),
  }).index("by_machineId", ["machineId"]),
});
