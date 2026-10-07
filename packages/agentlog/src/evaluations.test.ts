import { expect, test } from "bun:test";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  evaluationFixture,
  evaluationRun,
  evaluationPrompt,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import {
  evaluateProof,
  evaluationManifestSchema,
} from "@astack/agent-observability/evaluations";
import { savedEditProof } from "./evaluation-proof";
import { importEvaluation } from "./evaluations";
import { LocalStore, forward } from "./store";

test("save/reopen CLI proof distinguishes defective, repaired and unavailable products and survives cleanup", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-evaluation-proof-"));
  try {
    for (const [variant, verdict] of [
      ["defective", "fail"],
      ["fixed", "pass"],
      ["unavailable", "inconclusive"],
    ] as const) {
      const report = await savedEditProof(variant, directory);
      const evaluation = evaluationFixture(verdict, report);
      expect(evaluateProof(evaluation).verdict).toBe(verdict);
      const artifact = report.cases[0]?.attempts[0]?.artifacts[0];
      if (!artifact) throw new Error("Fixture did not retain an artifact");
      expect((await stat(artifact.path)).size).toBeGreaterThan(0);
      const observations = JSON.parse(await readFile(artifact.path, "utf8"));
      expect(observations.identity).toBe(true);
      if (variant === "fixed")
        expect(observations.independent.value).toBe("Saved edit");
      if (variant === "defective")
        expect(observations.reopened.value).toBe("Original edit");
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
test("evaluation imports redact, survive restart, stay immutable and respect capture policy", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-evaluation-queue-"));
  let store = new LocalStore(directory);
  try {
    const projects = [
      {
        projectId: fixtureProject,
        name: "Fixture",
        enabled: true,
        repositories: [],
        folders: [{ machineId: fixtureMachine, path: "/fixture" }],
      },
    ];
    store.setMeta("projectPolicy", JSON.stringify(projects));
    for (const turn of ["reproduce", "repair"])
      store.put({ kind: "run", value: evaluationRun(turn) });
    const { machineId: _, id: _id, ...value } = evaluationFixture();
    const manifest = evaluationManifestSchema.parse({
      ...value,
      id: "00000000-0000-4000-8000-000000000300",
      intent: {
        request: "Fix saved edits. password=hunter222",
        clarifications: [],
      },
    });
    const result = importEvaluation(store, fixtureMachine, manifest);
    expect(result.queued).toBe(true);
    expect(importEvaluation(store, fixtureMachine, manifest).queued).toBe(
      false,
    );
    expect(() =>
      importEvaluation(store, fixtureMachine, {
        ...manifest,
        title: "Changed scope",
      }),
    ).toThrow("immutable");
    expect(() =>
      importEvaluation(store, fixtureMachine, {
        ...manifest,
        runIds: ["foreign"],
      }),
    ).toThrow("outside");
    store.close();
    store = new LocalStore(directory);
    const record = store.getRecord("evaluation:" + result.id);
    expect(JSON.stringify(record)).not.toContain("hunter222");
    expect(record?.kind).toBe("evaluation");
    let sent = false;
    store.setMeta(
      "projectPolicy",
      JSON.stringify([{ ...projects[0], enabled: false }]),
    );
    await forward(
      store,
      {
        machineId: fixtureMachine,
        endpoint: "http://127.0.0.1/agentlog/ingest",
      },
      "fixture",
      async () => {
        sent = true;
        return new Response();
      },
    );
    expect(sent).toBe(false);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
test("multi-turn evaluations wait for acknowledged parent turns and the original prompt", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-evaluation-order-"));
  const store = new LocalStore(directory);
  try {
    const evaluation = evaluationFixture();
    const runs = [
      evaluationRun("reproduce"),
      { ...evaluationRun(), startedAt: 1 },
    ];
    for (const run of runs) store.put({ kind: "run", value: run });
    const request = "  " + evaluation.intent.request + "\n";
    store.put({
      kind: "event",
      value: { ...evaluationPrompt(), data: { content: request } },
    });
    store.put({
      kind: "evaluation",
      value: { ...evaluation, intent: { ...evaluation.intent, request } },
    });
    const saved = store.getRecord("evaluation:" + evaluation.id);
    expect(
      saved?.kind === "evaluation" &&
        "request" in saved.value.intent &&
        saved.value.intent.request,
    ).toBe(request);
    for (const priority of ["recent", "oldest"] as const) {
      const before = store.batch(fixtureMachine, priority);
      expect(
        before?.envelope.records.some(
          (item) => item.record.kind === "evaluation",
        ),
      ).toBe(false);
    }
    const parents = store.batch(fixtureMachine);
    if (!parents) throw new Error("Missing fixture parents");
    store.acknowledge(parents.keys);
    const ready = store.batch(fixtureMachine);
    expect(ready?.envelope.records.map((item) => item.record.kind)).toEqual([
      "evaluation",
    ]);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
