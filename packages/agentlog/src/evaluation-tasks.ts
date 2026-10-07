import { createHash } from "node:crypto";
import { z } from "zod";
import {
  generateEvaluation,
  generationCriteriaSchema,
} from "@astack/agent-observability/evaluation-generation";
import {
  evaluationManifestSchema,
  proofReportSchema,
} from "@astack/agent-observability/evaluations";
import type { LocalStore } from "./store";
import { approvedRun } from "./projects";
import { recordSchema } from "@astack/agent-observability";

const base = {
  id: z.string().uuid(),
  firstRunId: z.string().min(1).max(512),
  title: evaluationManifestSchema.shape.title,
  criteria: generationCriteriaSchema.options[0],
};
const finish = {
  lastRunId: base.firstRunId,
  proof: proofReportSchema.nullable(),
};
export const evaluationTaskSchema = z.discriminatedUnion("state", [
  z.object({ ...base, state: z.literal("recording") }).strict(),
  z.object({ ...base, ...finish, state: z.literal("pending") }).strict(),
  z
    .object({
      ...base,
      ...finish,
      state: z.literal("queued"),
      evaluationId: z.string(),
    })
    .strict(),
  z
    .object({
      ...base,
      ...finish,
      state: z.literal("failed"),
      error: z.string(),
    })
    .strict(),
]);
export type EvaluationTask = z.infer<typeof evaluationTaskSchema>;

export function taskIdForRun(runId: string) {
  const hex = createHash("sha256")
    .update("agent-evaluation:" + runId)
    .digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
export function evaluationTask(store: LocalStore, id: string) {
  const row = store.db
    .query<{ data: string }, [string]>(
      "SELECT data FROM evaluation_tasks WHERE id=?",
    )
    .get(id);
  return row ? evaluationTaskSchema.parse(JSON.parse(row.data)) : null;
}
export function beginEvaluationTask(
  store: LocalStore,
  input: {
    id?: string;
    firstRunId: string;
    title: string;
    cases: z.infer<typeof evaluationManifestSchema.shape.cases>;
    skillCriteria: z.infer<typeof evaluationManifestSchema.shape.skillCriteria>;
  },
) {
  return store.db.transaction(() => {
    const id = input.id ?? taskIdForRun(input.firstRunId);
    const existing = evaluationTask(store, id);
    const criteria = {
      method: "agent" as const,
      recordedAt: existing?.criteria.recordedAt ?? Date.now(),
      cases: input.cases,
      skillCriteria: input.skillCriteria,
    };
    const task = evaluationTaskSchema.parse(
      store.redactMetadata({
        id,
        firstRunId: input.firstRunId,
        title: input.title,
        criteria,
        state: "recording",
      }),
    );
    if (existing) {
      if (
        existing.firstRunId !== task.firstRunId ||
        existing.title !== task.title ||
        JSON.stringify(existing.criteria) !== JSON.stringify(task.criteria)
      )
        throw new Error(
          "Task criteria are immutable; begin a new task ID for changed scope.",
        );
      return existing;
    }
    store.saveEvaluationTask(task.id, task.state, task);
    return task;
  })();
}
export function finishEvaluationTask(
  store: LocalStore,
  id: string,
  lastRunId: string,
  proof: z.infer<typeof proofReportSchema> | null,
) {
  return store.db.transaction(() => {
    const existing = evaluationTask(store, id);
    if (!existing) throw new Error("Evaluation task not found.");
    const safeProof = proofReportSchema
      .nullable()
      .parse(store.redactMetadata(proof));
    if (
      existing.state !== "recording" &&
      (existing.lastRunId !== lastRunId ||
        JSON.stringify(existing.proof) !== JSON.stringify(safeProof))
    )
      throw new Error(
        "Delivery is immutable; begin a new task ID for revised work or proof.",
      );
    if (existing.state === "queued" || existing.state === "pending")
      return existing;
    const task = evaluationTaskSchema.parse({
      id: existing.id,
      firstRunId: existing.firstRunId,
      title: existing.title,
      criteria: existing.criteria,
      state: "pending",
      lastRunId,
      proof: safeProof,
    });
    store.saveEvaluationTask(task.id, task.state, task);
    return task;
  })();
}

function recordRevision(store: LocalStore, key: string) {
  const row = store.db
    .query<{ revision: number }, [string]>(
      "SELECT revision FROM records WHERE key=?",
    )
    .get(key);
  if (!row) throw new Error("Capture revision unavailable.");
  return row.revision;
}
function capturedPrompts(store: LocalStore, runId: string) {
  return store.db
    .query<{ payload: string; revision: number }, [string]>(
      "SELECT payload,revision FROM records WHERE run_id=? AND kind='event' AND json_extract(payload,'$.value.kind')='user_prompt' ORDER BY json_extract(payload,'$.value.sequence') LIMIT 12",
    )
    .all(runId)
    .flatMap((row) => {
      const record = recordSchema.parse(JSON.parse(row.payload));
      return record.kind === "event"
        ? [{ event: record.value, revision: row.revision }]
        : [];
    });
}
export function publishEvaluationTasks(store: LocalStore) {
  const cursor = store.getMeta("evaluationTasksCursor") ?? "";
  const pending = store.db.query<{ id: string; data: string }, [string]>(
    "SELECT id,data FROM evaluation_tasks WHERE state='pending' AND id>? ORDER BY id LIMIT 20",
  );
  let rows = pending.all(cursor);
  if (!rows.length && cursor) rows = pending.all("");
  const last = rows.at(-1);
  if (last) store.setMeta("evaluationTasksCursor", last.id);
  let published = 0;
  for (const row of rows) {
    const candidate = evaluationTaskSchema.parse(JSON.parse(row.data));
    const didPublish = store.db.transaction(() => {
      const task = evaluationTask(store, candidate.id);
      if (task?.state !== "pending") return false;
      const firstRecord = store.getRecord("run:" + task.firstRunId);
      const lastRecord = store.getRecord("run:" + task.lastRunId);
      if (
        firstRecord?.kind !== "run" ||
        lastRecord?.kind !== "run" ||
        lastRecord.value.status === "running" ||
        lastRecord.value.completedAt === null
      )
        return false;
      try {
        const first = approvedRun(store, task.firstRunId);
        const last = approvedRun(store, task.lastRunId);
        if (
          !first ||
          !last ||
          first.sessionId !== last.sessionId ||
          first.projectId !== last.projectId
        )
          throw new Error(
            "Task turns must belong to the same enabled project and conversation.",
          );
        if (
          last.startedAt < first.startedAt ||
          (first.id !== last.id &&
            (!first.startTimeKnown ||
              !last.startTimeKnown ||
              first.startedAt === last.startedAt))
        )
          throw new Error("Invalid task turn boundaries.");
        const selected =
          first.id === last.id
            ? [first]
            : store.db
                .query<{ payload: string }, [string, number, number]>(
                  "SELECT payload FROM records WHERE kind='run' AND json_extract(payload,'$.value.sessionId')=? AND json_extract(payload,'$.value.startedAt')>=? AND json_extract(payload,'$.value.startedAt')<=? ORDER BY json_extract(payload,'$.value.startedAt'),key LIMIT 21",
                )
                .all(first.sessionId, first.startedAt, last.startedAt)
                .flatMap((row) => {
                  const record = recordSchema.parse(JSON.parse(row.payload));
                  return record.kind === "run" ? [record.value] : [];
                });
        if (selected.some((run) => !approvedRun(store, run.id)))
          throw new Error("Task includes a turn outside enabled capture.");
        const source = capturedPrompts(store, first.id)[0];
        if (!source)
          throw new Error("Original request is unavailable in captured work.");
        const clarifications = selected
          .flatMap((run) =>
            capturedPrompts(store, run.id)
              .filter(({ event }) => event.id !== source.event.id)
              .map(({ event }) => event.data.content),
          )
          .filter(
            (value): value is string =>
              typeof value === "string" && !!value.trim(),
          );
        const evaluation = generateEvaluation({
          id: task.id,
          createdAt: Date.now(),
          title: task.title,
          runs: selected.map((run) => ({
            run,
            revision: recordRevision(store, "run:" + run.id),
          })),
          source,
          clarifications,
          criteria: task.criteria,
          proof: task.proof,
        });
        store.put({ kind: "evaluation", value: evaluation });
        const { state: _state, ...data } = task;
        store.saveEvaluationTask(task.id, "queued", {
          ...data,
          state: "queued",
          evaluationId: evaluation.id,
        });
        return true;
      } catch (error) {
        const message =
          error instanceof z.ZodError
            ? "Captured task exceeds the evaluation content or turn limits."
            : error instanceof Error
              ? error.message
              : "Evaluation generation failed.";
        store.saveEvaluationTask(task.id, "failed", {
          ...task,
          state: "failed",
          error: message,
        });
        return false;
      }
    })();
    if (didPublish) published++;
  }
  return published;
}
