import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  runSessions: defineTable({
    machineId: v.string(),
    key: v.string(),
    runId: v.string(),
    startedAt: v.number(),
  })
    .index("by_machineId_and_key_and_startedAt", [
      "machineId",
      "key",
      "startedAt",
    ])
    .index("by_runId", ["runId"]),
  evaluationFeedback: defineTable({
    feedbackId: v.string(),
    evaluationId: v.string(),
    reviewedAt: v.number(),
    data: v.string(),
  })
    .index("by_feedbackId", ["feedbackId"])
    .index("by_evaluationId_and_reviewedAt", ["evaluationId", "reviewedAt"]),
  evaluations: defineTable({
    evaluationId: v.string(),
    projectId: v.string(),
    machineId: v.string(),
    createdAt: v.number(),
    data: v.string(),
    snapshot: v.string(),
  })
    .index("by_evaluationId", ["evaluationId"])
    .index("by_projectId_and_createdAt", ["projectId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
  evaluationRuns: defineTable({
    evaluationId: v.string(),
    runId: v.string(),
    createdAt: v.number(),
  }).index("by_runId_and_createdAt", ["runId", "createdAt"]),
  assessments: defineTable({
    assessmentId: v.string(),
    evaluationId: v.string(),
    assessedAt: v.number(),
    data: v.string(),
  })
    .index("by_assessmentId", ["assessmentId"])
    .index("by_evaluationId_and_assessedAt", ["evaluationId", "assessedAt"]),
  names: defineTable({
    key: v.string(),
    kind: v.union(v.literal("activity"), v.literal("work")),
    projectId: v.string(),
    targetId: v.string(),
    sources: v.array(v.object({ runId: v.string(), eventId: v.string() })),
    state: v.union(
      v.literal("pending"),
      v.literal("ready"),
      v.literal("skipped"),
    ),
    availableAt: v.number(),
    attempts: v.number(),
    claim: v.optional(v.string()),
    snapshot: v.optional(
      v.array(
        v.object({
          runId: v.string(),
          eventId: v.string(),
          revision: v.number(),
        }),
      ),
    ),
    title: v.optional(v.string()),
    model: v.optional(v.string()),
  })
    .index("by_key", ["key"])
    .index("by_state_and_availableAt", ["state", "availableAt"]),
  projects: defineTable({
    projectId: v.string(),
    name: v.string(),
    enabled: v.boolean(),
    repositories: v.array(v.string()),
    folders: v.array(v.object({ machineId: v.string(), path: v.string() })),
  }).index("by_projectId", ["projectId"]),
  projectCapabilities: defineTable({
    projectId: v.string(),
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
    .index("by_projectId_and_key", ["projectId", "key"])
    .index("by_projectId_and_problematic", ["projectId", "problematic"]),
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
    projectId: v.optional(v.string()),
    enrolled: v.optional(v.boolean()),
  })
    .index("by_runId", ["runId"])
    .index("by_startedAt", ["startedAt"])
    .index("by_enrolled_and_projectId_and_startedAt", [
      "enrolled",
      "projectId",
      "startedAt",
    ])
    .index("by_enrolled_and_startedAt", ["enrolled", "startedAt"]),
  events: defineTable({
    eventId: v.string(),
    runId: v.string(),
    machineId: v.string(),
    revision: v.number(),
    sequence: v.number(),
    kind: v.optional(v.string()),
    data: v.string(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_runId_and_sequence", ["runId", "sequence"])
    .index("by_runId_and_kind_and_sequence", ["runId", "kind", "sequence"]),
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
