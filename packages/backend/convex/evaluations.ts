import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { z } from "zod";
import { eventSchema, runSchema } from "@astack/agent-observability";
import {
  assessmentInputSchema,
  assessmentSchema,
  evaluateProof,
  evaluationSchema,
  validateAssessment,
  type Evaluation,
} from "@astack/agent-observability/evaluations";
import {
  evaluationDetailSchema,
  evaluationSummarySchema,
  eventSnapshotSchema,
  storedAssessmentSchema,
} from "@astack/agent-observability/evaluation-view";
import { redact } from "@astack/agent-observability/redaction";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { requireOwner } from "./access";
import { getProject } from "./projectData";
import { resolveProject } from "@astack/agent-observability/projects";

const snapshotSchema = evaluationDetailSchema.pick({
  runs: true,
  source: true,
});
const boundedJson = (value: unknown, maximumBytes = 512 * 1024) => {
  const data = JSON.stringify(value);
  if (new TextEncoder().encode(data).byteLength > maximumBytes)
    throw new Error("Evaluation snapshot exceeds its byte budget");
  return data;
};
async function stored(ctx: Pick<QueryCtx, "db">, id: string) {
  return ctx.db
    .query("evaluations")
    .withIndex("by_evaluationId", (q) => q.eq("evaluationId", id))
    .unique();
}
async function traceSnapshot(
  ctx: Pick<QueryCtx, "db">,
  runId: string,
  eventId: string,
) {
  const row = await ctx.db
    .query("events")
    .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
    .unique();
  if (!row || row.runId !== runId)
    throw new Error("Trace evidence not captured");
  return eventSnapshotSchema.parse({
    event: redact(eventSchema.parse(JSON.parse(row.data))),
    revision: row.revision,
  });
}
export async function storeEvaluation(
  ctx: MutationCtx,
  input: Evaluation,
  machineId: string,
) {
  const value = evaluationSchema.parse(redact(input));
  if (
    value.machineId !== machineId ||
    !value.id.startsWith(machineId + ":evaluation:")
  )
    throw new Error("Machine mismatch");
  const project = await getProject(ctx, value.projectId);
  if (!project?.enabled) throw new Error("Project not enabled for capture");
  const runs = [];
  for (const id of value.runIds) {
    const row = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", id))
      .unique();
    if (
      !row?.enrolled ||
      row.projectId !== value.projectId ||
      row.machineId !== machineId
    )
      throw new Error("Evaluation run outside enrolled project/machine");
    const run = runSchema.parse(JSON.parse(row.data));
    if (resolveProject([project], run)?.projectId !== value.projectId)
      throw new Error("Evaluation run outside current project capture policy");
    runs.push({ run: runSchema.parse(redact(run)), revision: row.revision });
  }
  const previous = await stored(ctx, value.id);
  const data = boundedJson(value, 128 * 1024);
  if (previous) {
    if (previous.data !== data)
      throw new Error("Evaluation is immutable; use a new ID");
    return;
  }
  const source = value.intent.source
    ? await traceSnapshot(
        ctx,
        value.intent.source.runId,
        value.intent.source.eventId,
      )
    : null;
  if (
    source &&
    (source.event.kind !== "user_prompt" ||
      source.event.data.content !== value.intent.request)
  )
    throw new Error("Original request does not match captured prompt");
  await ctx.db.insert("evaluations", {
    evaluationId: value.id,
    projectId: value.projectId,
    machineId,
    createdAt: value.createdAt,
    data,
    snapshot: boundedJson(snapshotSchema.parse({ runs, source })),
  });
  for (const runId of value.runIds)
    await ctx.db.insert("evaluationRuns", {
      evaluationId: value.id,
      runId,
      createdAt: value.createdAt,
    });
}
export const list = query({
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
    if (
      !Number.isInteger(args.paginationOpts.numItems) ||
      args.paginationOpts.numItems < 1 ||
      args.paginationOpts.numItems > 20
    )
      throw new Error("Invalid evaluation page");
    const projectId = args.projectId;
    const rows = projectId
      ? ctx.db
          .query("evaluations")
          .withIndex("by_projectId_and_createdAt", (q) =>
            q.eq("projectId", projectId),
          )
      : ctx.db.query("evaluations").withIndex("by_createdAt");
    const page = await rows
      .order("desc")
      .paginate({ ...args.paginationOpts, maximumBytesRead: 1_000_000 });
    const summaries = [];
    for (const row of page.page) {
      const evaluation = evaluationSchema.parse(JSON.parse(row.data));
      const latest = await ctx.db
        .query("assessments")
        .withIndex("by_evaluationId_and_assessedAt", (q) =>
          q.eq("evaluationId", row.evaluationId),
        )
        .order("desc")
        .take(1);
      const assessment = latest[0]
        ? storedAssessmentSchema.parse(JSON.parse(latest[0].data))
        : null;
      summaries.push(
        JSON.stringify(
          evaluationSummarySchema.parse({
            id: evaluation.id,
            title: evaluation.title,
            projectId: evaluation.projectId,
            createdAt: evaluation.createdAt,
            turns: evaluation.runIds.length,
            verification: evaluateProof(evaluation).verdict,
            outcome: assessment?.outcome.verdict ?? null,
          }),
        ),
      );
    }
    return {
      page: summaries,
      continueCursor: page.continueCursor,
      isDone: page.isDone,
    };
  },
});
export const detail = query({
  args: { evaluationId: v.string(), projectId: v.optional(v.string()) },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const row = await stored(ctx, args.evaluationId);
    if (
      !row ||
      (args.projectId && row.projectId !== args.projectId) ||
      !(await getProject(ctx, row.projectId))
    )
      return null;
    const assessments = await ctx.db
      .query("assessments")
      .withIndex("by_evaluationId_and_assessedAt", (q) =>
        q.eq("evaluationId", args.evaluationId),
      )
      .order("desc")
      .take(21);
    return JSON.stringify(
      evaluationDetailSchema.parse({
        evaluation: evaluationSchema.parse(JSON.parse(row.data)),
        ...snapshotSchema.parse(JSON.parse(row.snapshot)),
        assessments: assessments
          .slice(0, 20)
          .map((item) => storedAssessmentSchema.parse(JSON.parse(item.data))),
        moreAssessments: assessments.length > 20,
      }),
    );
  },
});
export const forRun = query({
  args: { runId: v.string(), projectId: v.optional(v.string()) },
  returns: v.array(
    v.object({ id: v.string(), title: v.string(), projectId: v.string() }),
  ),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const links = await ctx.db
      .query("evaluationRuns")
      .withIndex("by_runId_and_createdAt", (q) => q.eq("runId", args.runId))
      .order("desc")
      .take(20);
    const results = [];
    for (const link of links) {
      const row = await stored(ctx, link.evaluationId);
      if (!row || (args.projectId && row.projectId !== args.projectId))
        continue;
      const value = evaluationSchema.parse(JSON.parse(row.data));
      results.push({
        id: value.id,
        title: value.title,
        projectId: value.projectId,
      });
    }
    return results;
  },
});
export const assess = mutation({
  args: {
    evaluationId: v.string(),
    requestId: v.string(),
    assessment: v.string(),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    z.string().uuid().parse(args.requestId);
    if (new TextEncoder().encode(args.assessment).byteLength > 64 * 1024)
      throw new Error("Assessment too large");
    const row = await stored(ctx, args.evaluationId);
    if (!row || !(await getProject(ctx, row.projectId)))
      throw new Error("Evaluation unavailable");
    const evaluation = evaluationSchema.parse(JSON.parse(row.data));
    const input = assessmentInputSchema.parse(
      redact(JSON.parse(args.assessment)),
    );
    validateAssessment(evaluation, input);
    const id = evaluation.id + ":assessment:" + args.requestId;
    const previous = await ctx.db
      .query("assessments")
      .withIndex("by_assessmentId", (q) => q.eq("assessmentId", id))
      .unique();
    if (previous) {
      const { criteriaVersion, intent, skills, outcome } =
        storedAssessmentSchema.parse(JSON.parse(previous.data));
      const saved = { criteriaVersion, intent, skills, outcome };
      if (JSON.stringify(saved) !== JSON.stringify(input))
        throw new Error("Assessment request ID reused with different content");
      return id;
    }
    const refs = new Map(
      [input.intent, ...input.skills, input.outcome]
        .flatMap((item) => item.evidence)
        .filter((item) => item.kind === "trace")
        .map((item) => [item.eventId, item]),
    );
    if (refs.size > 32) throw new Error("Too many trace references");
    const traces = [];
    for (const ref of refs.values()) {
      const parent = await ctx.db
        .query("runs")
        .withIndex("by_runId", (q) => q.eq("runId", ref.runId))
        .unique();
      if (!parent?.enrolled || parent.projectId !== evaluation.projectId)
        throw new Error("Trace evidence outside enrolled project");
      traces.push(await traceSnapshot(ctx, ref.runId, ref.eventId));
    }
    const assessment = storedAssessmentSchema.parse({
      ...assessmentSchema.parse({
        ...input,
        id,
        evaluationId: evaluation.id,
        assessedAt: Date.now(),
        evaluator: "owner",
        evaluatorVersion: "human-v1",
      }),
      traces,
    });
    await ctx.db.insert("assessments", {
      assessmentId: id,
      evaluationId: evaluation.id,
      assessedAt: assessment.assessedAt,
      data: boundedJson(assessment, 128 * 1024),
    });
    return id;
  },
});
