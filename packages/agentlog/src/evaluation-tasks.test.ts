import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LocalStore } from "./store";
import {
  beginEvaluationTask,
  finishEvaluationTask,
  evaluationTask,
  publishEvaluationTasks,
} from "./evaluation-tasks";
import {
  evaluationRun,
  evaluationPrompt,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import { evaluateProof } from "@astack/agent-observability/evaluations";

const policy = [
  {
    projectId: fixtureProject,
    name: "Fixture",
    enabled: true,
    repositories: [],
    folders: [{ machineId: fixtureMachine, path: "/fixture" }],
  },
];
test("agent handoff survives capture lag and restart, preserving criteria and publishing once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-generation-"));
  let store = new LocalStore(directory, ["private-test-secret"]);
  try {
    store.setMeta("projectPolicy", JSON.stringify(policy));
    const first = evaluationRun("reproduce");
    const last = { ...evaluationRun(), startedAt: 1500 };
    const input = {
      firstRunId: first.id,
      title: "Save the edit",
      cases: [
        {
          id: "C1",
          expected: "A reopened edit contains private-test-secret",
          requiresIndependentObservation: false,
        },
      ],
      skillCriteria: [],
    };
    const task = beginEvaluationTask(store, input);
    expect(beginEvaluationTask(store, input).id).toBe(task.id);
    expect(() =>
      beginEvaluationTask(store, { ...input, title: "Different work" }),
    ).toThrow("immutable");
    finishEvaluationTask(store, task.id, last.id, null);
    expect(publishEvaluationTasks(store)).toBe(0);
    store.close();
    store = new LocalStore(directory, ["private-test-secret"]);
    store.put({ kind: "run", value: first });
    store.put({ kind: "event", value: evaluationPrompt() });
    store.put({
      kind: "run",
      value: { ...last, status: "running", completedAt: null },
    });
    expect(publishEvaluationTasks(store)).toBe(0);
    store.put({
      kind: "run",
      value: { ...last, status: "interrupted", completedAt: null },
    });
    expect(publishEvaluationTasks(store)).toBe(0);
    store.put({ kind: "run", value: last });
    expect(publishEvaluationTasks(store)).toBe(1);
    const saved = store.getRecord(
      "evaluation:" + fixtureMachine + ":evaluation:" + task.id,
    );
    if (saved?.kind !== "evaluation")
      throw new Error("Evaluation was not persisted.");
    if (!saved.value.generation)
      throw new Error("Generation provenance missing.");
    expect(saved.value.intent).toEqual({
      kind: "captured",
      source: {
        runId: first.id,
        eventId: evaluationPrompt().id,
        revision: saved.value.generation.requestRevision,
      },
      clarifications: [],
    });
    expect(saved.value.runIds).toEqual([first.id, last.id]);
    expect(saved.value.cases[0]?.expected).toBe(
      "A reopened edit contains [REDACTED]",
    );
    expect(saved.value.generation?.method).toBe("agent");
    expect(evaluateProof(saved.value).verdict).toBe("inconclusive");
    expect(finishEvaluationTask(store, task.id, last.id, null).state).toBe(
      "queued",
    );
    expect(publishEvaluationTasks(store)).toBe(0);
    expect(
      store.db
        .query<{ count: number }, []>(
          "SELECT count(*) AS count FROM records WHERE kind='evaluation'",
        )
        .get()?.count,
    ).toBe(1);
    if (!("kind" in saved.value.intent))
      throw new Error("Captured intent missing.");
    const capturedIntent = saved.value.intent;
    const generation = saved.value.generation;
    expect(() =>
      store.put({
        kind: "evaluation",
        value: {
          ...saved.value,
          id: saved.value.id + "-stale-request",
          intent: {
            ...capturedIntent,
            source: { ...capturedIntent.source, revision: 99 },
          },
          generation: { ...generation, requestRevision: 99 },
        },
      }),
    ).toThrow("already captured prompt");
    store.put({ kind: "run", value: { ...last, contentCapture: false } });
    expect(() =>
      store.put({
        kind: "evaluation",
        value: {
          ...saved.value,
          id: saved.value.id + "-unreadable",
        },
      }),
    ).toThrow("requires readable project capture");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("disabled and unreadable capture are reported rather than generating a review", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-generation-policy-"));
  const store = new LocalStore(directory);
  try {
    const run = evaluationRun("reproduce");
    store.setMeta("projectPolicy", JSON.stringify(policy));
    store.put({ kind: "run", value: { ...run, contentCapture: false } });
    store.put({ kind: "event", value: evaluationPrompt() });
    const task = beginEvaluationTask(store, {
      firstRunId: run.id,
      title: "Review",
      cases: [
        {
          id: "C1",
          expected: "Edit survives reopening",
          requiresIndependentObservation: false,
        },
      ],
      skillCriteria: [],
    });
    finishEvaluationTask(store, task.id, run.id, null);
    expect(publishEvaluationTasks(store)).toBe(0);
    const failed = evaluationTask(store, task.id);
    expect(failed?.state === "failed" && failed.error).toBe(
      "Evaluation requires readable turns from one project and computer.",
    );
    store.put({ kind: "run", value: run });
    store.setMeta(
      "projectPolicy",
      JSON.stringify([{ ...policy[0], enabled: false }]),
    );
    finishEvaluationTask(store, task.id, run.id, null);
    expect(publishEvaluationTasks(store)).toBe(0);
    const denied = evaluationTask(store, task.id);
    expect(denied?.state === "failed" && denied.error).toBe(
      "Task turns must belong to the same enabled project and conversation.",
    );
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
