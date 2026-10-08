import { beforeEach, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  evaluationDetailSchema,
  evaluationRequest,
  evaluationSummarySchema,
} from "@astack/agent-observability/evaluation-view";
import { activityNameKey } from "@astack/agent-observability/naming";
import {
  evaluationFixture,
  evaluationRun,
  evaluationPrompt,
  fixtureAssessment,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import { deliveryFixture } from "@astack/agent-observability/delivery-fixtures";
import { eventSchema } from "@astack/agent-observability";
import { capturedEvaluationLimits } from "@astack/agent-observability/evaluations";
import type { TelemetryRecord } from "@astack/agent-observability";
import { workflowFixture } from "@astack/agent-observability/workflow-fixtures";
import { journeyFixture } from "@astack/agent-observability/journey-fixtures";
import type { DelegationResult } from "@astack/agent-observability/delegation";

const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/observatory.ts": () => import("../convex/observatory"),
  "../convex/conversations.ts": () => import("../convex/conversations"),
  "../convex/ingestion.ts": () => import("../convex/ingestion"),
  "../convex/evaluations.ts": () => import("../convex/evaluations"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/naming.ts": () => import("../convex/naming"),
  "../convex/auth.ts": () => import("../convex/auth"),
  "../convex/http.ts": () => import("../convex/http"),
};
const ownerId = "00000000-0000-4000-8000-000000000010";
beforeEach(() => {
  process.env.OBSERVATORY_OWNER_ID = ownerId;
});
const entries = (records: TelemetryRecord[], revision = 1) =>
  records.map((record) => ({ revision, record: JSON.stringify(record) }));
async function ingestWorkflow(
  t: ReturnType<typeof convexTest>,
  records: TelemetryRecord[],
) {
  for (let index = 0; index < records.length; index += 2)
    await t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries(records.slice(index, index + 2), 10 + index),
    });
}

test("thread association uses current capture without changing an immutable task evaluation", async () => {
  const { t, owner, evaluation } = await setup();
  const before = await t.run(
    async (ctx) => await ctx.db.query("evaluations").first(),
  );
  const first = evaluationRun("repair");
  const self = {
    kind: "t3",
    environmentId: "synthetic-host",
    threadId: "root",
  } as const;
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "run",
          value: { ...first, conversation: { self, root: self } },
        },
      ],
      2,
    ),
  });
  const groups = await owner.query(api.conversations.forEvaluation, {
    evaluationId: evaluation.id,
    projectId: fixtureProject,
  });
  expect(groups).toHaveLength(2); // The other native root remains separately identified.
  const after = await t.run(
    async (ctx) => await ctx.db.query("evaluations").first(),
  );
  expect(after?.data).toBe(before?.data);
  expect(after?.snapshot).toBe(before?.snapshot);
  expect(
    await owner.query(api.conversations.forEvaluation, {
      evaluationId: evaluation.id,
      projectId: "another-project",
    }),
  ).toEqual([]);
});
async function setup(
  status: "pass" | "fail" | "inconclusive" = "pass",
  request?: string,
) {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("projects", {
      projectId: fixtureProject,
      name: "Fixture",
      enabled: true,
      repositories: [],
      folders: [{ machineId: fixtureMachine, path: "/fixture" }],
    });
  });
  const evaluation = evaluationFixture(status);
  if (request !== undefined) evaluation.intent.request = request;
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      ["reproduce", "repair"].map((turn) => ({
        kind: "run",
        value: evaluationRun(turn),
      })),
    ),
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([
      {
        kind: "event",
        value: {
          ...evaluationPrompt(),
          data: { content: evaluation.intent.request },
        },
      },
      { kind: "evaluation", value: evaluation },
    ]),
  });
  return { t, evaluation, owner: t.withIdentity({ subject: ownerId }) };
}

test.each([5633, 16000])(
  "generation preserves a %i-character captured request once",
  async (length) => {
    const { t, owner } = await setup();
    const request = "Maintain the scheduled health backlog.\n"
      .repeat(500)
      .slice(0, length);
    const prompt = { ...evaluationPrompt(), data: { content: request } };
    await t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([{ kind: "event", value: prompt }], 2),
    });
    const saved = await owner.mutation(api.evaluations.generate, {
      runId: prompt.runId,
      projectId: fixtureProject,
    });
    const detail = evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: saved.evaluationId,
        })) ?? "null",
      ),
    );
    expect(detail.source?.event.data.content).toBe(request);
    expect(detail.source?.revision).toBe(2);
    expect(JSON.stringify(detail.evaluation)).not.toContain(request);
    expect(detail.evaluation.intent).toEqual({
      kind: "captured",
      source: { runId: prompt.runId, eventId: prompt.id, revision: 2 },
      clarifications: [],
    });
    expect(detail.evaluation.cases[0]?.expected).toEqual({
      kind: "original_request",
    });
    expect(detail.evaluation.proof).toBeNull();
  },
);

test.each([32, 101])(
  "generation preserves every ordered follow-up in a %i-follow-up orchestration turn",
  async (count) => {
    const { t, owner } = await setup();
    const prompt = evaluationPrompt();
    const followups = Array.from(
      { length: count },
      (_, index) => `Follow-up ${index + 1}: retain the agreed scope.`,
    );
    await ingestWorkflow(
      t,
      followups.map((content, index) => ({
        kind: "event",
        value: {
          ...prompt,
          id: prompt.id + ":followup:" + index,
          sequence: index + 1,
          data: { content },
        },
      })),
    );
    const saved = await owner.mutation(api.evaluations.generate, {
      runId: prompt.runId,
    });
    const detail = evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: saved.evaluationId,
        })) ?? "null",
      ),
    );
    expect(detail.evaluation.intent.clarifications).toEqual(followups);
    expect(evaluationRequest(detail)).toBe(
      "Fix edits disappearing after saving and reopening.",
    );
    expect(detail.source?.revision).toBe(1);
    expect(detail.assessments).toEqual([]);
    expect(
      await owner.mutation(api.evaluations.generate, { runId: prompt.runId }),
    ).toEqual(saved);
  },
);

test.each(["rows", "bytes"])(
  "generation rejects an oversized %s lookup without truncating or saving",
  async (budget) => {
    const { t, owner } = await setup();
    const prompt = evaluationPrompt();
    await t.run(async (ctx) => {
      const count = budget === "rows" ? capturedEvaluationLimits.prompts : 3;
      for (let index = 0; index < count; index++) {
        const event = {
          ...prompt,
          id: prompt.id + ":budget:" + index,
          sequence: index + 1,
          data: { content: budget === "bytes" ? "€".repeat(260000) : "x" },
        };
        await ctx.db.insert("events", {
          eventId: event.id,
          runId: event.runId,
          machineId: fixtureMachine,
          revision: 1,
          sequence: event.sequence,
          kind: "user_prompt",
          data: JSON.stringify(event),
        });
      }
    });
    await expect(
      owner.mutation(api.evaluations.generate, { runId: prompt.runId }),
    ).rejects.toThrow("evaluation request capture budget");
    expect(
      await t.run(async (ctx) =>
        ctx.db
          .query("evaluations")
          .withIndex("by_generationKey", (q) =>
            q.eq("generationKey", "ui:" + prompt.runId),
          )
          .unique(),
      ),
    ).toBeNull();
  },
);

test("generation reports a byte budget error and rolls back oversized clarification records", async () => {
  const { t, owner } = await setup();
  const prompt = evaluationPrompt();
  for (let index = 1; index <= 103; index++)
    await t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([
        {
          kind: "event",
          value: {
            ...prompt,
            id: prompt.id + ":clarification:" + index,
            sequence: index,
            data: {
              content: "Scope clarification. ".repeat(index > 100 ? 2500 : 1),
            },
          },
        },
      ]),
    });
  try {
    await owner.mutation(api.evaluations.generate, { runId: prompt.runId });
    throw new Error("Oversized generation succeeded");
  } catch (error) {
    expect(error).toBeInstanceOf(ConvexError);
    if (!(error instanceof ConvexError)) throw error;
    expect(error.data).toBe(
      "Evaluation record exceeds its 128 KiB byte budget.",
    );
  }
  expect(
    await t.run(async (ctx) =>
      ctx.db
        .query("evaluations")
        .withIndex("by_generationKey", (q) =>
          q.eq("generationKey", "ui:" + prompt.runId),
        )
        .unique(),
    ),
  ).toBeNull();
});

test("generation bounds preserved snapshots by UTF-8 bytes without saving a partial review", async () => {
  const { t, owner } = await setup();
  const prompt = evaluationPrompt();
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: {
            ...prompt,
            data: { content: "€".repeat(175000) },
          },
        },
      ],
      2,
    ),
  });
  try {
    await owner.mutation(api.evaluations.generate, { runId: prompt.runId });
    throw new Error("Oversized snapshot generation succeeded");
  } catch (error) {
    if (!(error instanceof ConvexError)) throw error;
    expect(error.data).toBe(
      "Evaluation snapshot exceeds its 512 KiB byte budget.",
    );
  }
  expect(
    await t.run(async (ctx) =>
      ctx.db
        .query("evaluations")
        .withIndex("by_generationKey", (q) =>
          q.eq("generationKey", "ui:" + prompt.runId),
        )
        .unique(),
    ),
  ).toBeNull();
});

test("captured intent imports reject a stale original request revision", async () => {
  const { t, evaluation } = await setup();
  const source = evaluationPrompt();
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([
        {
          kind: "evaluation",
          value: {
            ...evaluation,
            id: evaluation.id + "-stale-request",
            intent: {
              kind: "captured",
              source: {
                runId: source.runId,
                eventId: source.id,
                revision: 99,
              },
              clarifications: [],
            },
          },
        },
      ]),
    }),
  ).rejects.toThrow("does not match");
});

test("captured intent imports require every selected turn to remain readable", async () => {
  const { t, evaluation } = await setup();
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [{ kind: "run", value: { ...evaluationRun(), contentCapture: false } }],
      2,
    ),
  });
  const source = evaluationPrompt();
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([
        {
          kind: "evaluation",
          value: {
            ...evaluation,
            id: evaluation.id + "-unreadable-request",
            intent: {
              kind: "captured",
              source: {
                runId: source.runId,
                eventId: source.id,
                revision: 1,
              },
              clarifications: [],
            },
          },
        },
      ]),
    }),
  ).rejects.toThrow("requires readable project capture");
});

test("owner generates a persisted review from the exact captured request, with idempotent concurrent retries", async () => {
  const { t, owner } = await setup();
  const runId = evaluationRun("reproduce").id;
  const [first, retry] = await Promise.all([
    owner.mutation(api.evaluations.generate, {
      runId,
      projectId: fixtureProject,
    }),
    owner.mutation(api.evaluations.generate, {
      runId,
      projectId: fixtureProject,
    }),
  ]);
  expect(retry).toEqual(first);
  const raw = await owner.query(api.evaluations.detail, {
    evaluationId: first.evaluationId,
  });
  const detail = evaluationDetailSchema.parse(JSON.parse(raw ?? "null"));
  expect(evaluationRequest(detail)).toBe(
    "Fix edits disappearing after saving and reopening.",
  );
  expect(detail.evaluation.intent.source).toEqual({
    runId,
    eventId: evaluationPrompt().id,
    revision: 1,
  });
  expect(detail.evaluation.runIds).toEqual([runId]);
  expect(detail.evaluation.cases).toEqual([
    {
      id: "C1",
      expected: { kind: "original_request" },
      requiresIndependentObservation: false,
    },
  ]);
  expect(detail.evaluation.proof).toBe(null);
  expect(detail.evaluation.generation).toEqual({
    method: "ui",
    version: "capture-v1",
    sources: [{ runId, revision: 1 }],
    requestRevision: 1,
  });
  expect(detail.assessments).toEqual([]);
  expect(detail.feedback).toEqual([]);
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: {
            ...evaluationPrompt(),
            data: { content: "Later revised prompt" },
          },
        },
      ],
      20,
    ),
  });
  expect(await owner.mutation(api.evaluations.generate, { runId })).toEqual(
    first,
  );
  const saved = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, {
        evaluationId: first.evaluationId,
      })) ?? "null",
    ),
  );
  expect(evaluationRequest(saved)).toBe(
    "Fix edits disappearing after saving and reopening.",
  );
});

test("generation enforces owner identity, project scope, readable capture and current enrollment", async () => {
  const { t, owner } = await setup();
  const runId = evaluationRun("reproduce").id;
  await expect(t.mutation(api.evaluations.generate, { runId })).rejects.toThrow(
    "Unauthorized",
  );
  await expect(
    owner.mutation(api.evaluations.generate, { runId, projectId: "foreign" }),
  ).rejects.toThrow("unavailable");
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "run",
          value: { ...evaluationRun("reproduce"), contentCapture: false },
        },
      ],
      20,
    ),
  });
  await expect(
    owner.mutation(api.evaluations.generate, { runId }),
  ).rejects.toThrow("readable");
  await t.run(async (ctx) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_projectId", (q) => q.eq("projectId", fixtureProject))
      .unique();
    if (!project) throw new Error("Missing fixture project");
    await ctx.db.patch(project._id, { enabled: false });
  });
  await expect(
    owner.mutation(api.evaluations.generate, { runId }),
  ).rejects.toThrow("unavailable");
});
test("generated evaluations retain ordered parent skill reads without inventing a route", async () => {
  const { t, owner } = await setup();
  const prompt = evaluationPrompt();
  const skillEvents = ["astack", "react", "verify", "react"].map(
    (name, index) =>
      eventSchema.parse({
        ...prompt,
        id: prompt.runId + ":skill:" + index,
        sequence: index + 1,
        kind: "skill_loaded",
        title: "Read " + name,
        skill: {
          name,
          kind: "skill",
          hash: null,
          provenance: "observation_time",
          evidence: "read",
        },
        data: {},
      }),
  );
  // Ingestion order differs from trace order, and the immutable run snapshot
  // has no summary skills. Only the captured events establish these reads.
  await ingestWorkflow(
    t,
    [...skillEvents].reverse().map((value) => ({ kind: "event", value })),
  );
  const saved = await owner.mutation(api.evaluations.generate, {
    runId: prompt.runId,
    projectId: fixtureProject,
  });
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: saved.evaluationId,
          projectId: fixtureProject,
        })) ?? "null",
      ),
    );
  expect((await read()).workflow).toMatchObject({
    records: [],
    reads: skillEvents.map((event) => ({
      reference: { runId: event.runId, eventId: event.id },
      skill: { name: event.skill?.name, evidence: "read" },
    })),
    truncated: false,
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "run",
          value: { ...evaluationRun("reproduce"), contentCapture: false },
        },
      ],
      1000,
    ),
  });
  expect((await read()).workflow).toMatchObject({ reads: [] });
});

test("parent skill projections respect trace limits and paused-project policy", async () => {
  const { t, evaluation, owner } = await setup();
  const prompt = evaluationPrompt();
  for (let index = 0; index < 70; index++)
    await ingestWorkflow(t, [
      {
        kind: "event",
        value: eventSchema.parse({
          ...prompt,
          id: prompt.runId + ":read:" + index,
          sequence: index + 1,
          kind: "skill_loaded",
          skill: {
            name: "react",
            kind: "skill",
            hash: null,
            provenance: "observation_time",
            evidence: "read",
          },
          data: {},
        }),
      },
    ]);
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: evaluation.id,
        })) ?? "null",
      ),
    );
  const captured = await read();
  expect(captured.workflow.reads).toHaveLength(64);
  expect(captured.workflow.reads.at(-1)?.reference.eventId).toBe(
    prompt.runId + ":read:63",
  );
  expect(captured.workflow.truncated).toBe(true);
  await owner.mutation(api.projects.save, {
    project: {
      projectId: fixtureProject,
      name: "Fixture",
      enabled: false,
      repositories: [],
      folders: [{ machineId: fixtureMachine, path: "/fixture" }],
    },
  });
  expect((await read()).workflow.reads).toEqual([]);
});

test("workflow detail resolves multi-turn evidence, hides foreign references and respects readable capture", async () => {
  const { t, evaluation, owner } = await setup();
  const { annotations, support } = workflowFixture("changed");
  await ingestWorkflow(
    t,
    [...support, ...annotations].map((value) => ({ kind: "event", value })),
  );
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: evaluation.id,
          projectId: fixtureProject,
        })) ?? "null",
      ),
    );
  let detail = await read();
  expect(detail.workflow.records).toHaveLength(annotations.length);
  expect(
    detail.workflow.records
      .flatMap((record) => record.evidence)
      .every((item) => item.state === "available"),
  ).toBe(true);
  expect(
    detail.workflow.records.some(
      (record) => record.annotation.action === "change",
    ),
  ).toBe(true);
  const phase = annotations.find((event) => event.workflow?.action === "phase");
  if (phase?.workflow?.action !== "phase")
    throw new Error("Missing phase fixture");
  await ingestWorkflow(t, [
    {
      kind: "event",
      value: {
        ...phase,
        id: phase.runId + ":workflow:foreign-ref",
        workflow: {
          ...phase.workflow,
          evidence: [{ runId: "foreign", eventId: evaluationPrompt().id }],
        },
      },
    },
  ]);
  detail = await read();
  const unknown = detail.workflow.records.find((record) =>
    record.eventId.endsWith("foreign-ref"),
  );
  expect(unknown?.evidence[0]).toMatchObject({ state: "unavailable" });
  expect(JSON.stringify(unknown?.evidence)).not.toContain(
    evaluationPrompt().title,
  );
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [{ kind: "run", value: { ...evaluationRun(), contentCapture: false } }],
      1000,
    ),
  });
  expect(
    (await read()).workflow.records.every(
      (record) => record.runId === evaluationRun("reproduce").id,
    ),
  ).toBe(true);
  await owner.mutation(api.projects.save, {
    project: {
      projectId: fixtureProject,
      name: "Fixture",
      enabled: false,
      repositories: [],
      folders: [{ machineId: fixtureMachine, path: "/fixture" }],
    },
  });
  expect((await read()).workflow.records).toEqual([]);
});
test("legacy workflow reads do not become a selected route and annotation previews stay bounded", async () => {
  const { t, evaluation, owner } = await setup();
  const { annotations } = workflowFixture();
  const selection = annotations[0];
  const phase = annotations.find((event) => event.workflow?.action === "phase");
  if (!selection || phase?.workflow?.action !== "phase")
    throw new Error("Missing workflow fixture");
  const { workflow: _, ...legacy } = selection;
  await ingestWorkflow(t, [
    { kind: "event", value: { ...legacy, id: legacy.runId + ":legacy" } },
  ]);
  let raw = await owner.query(api.evaluations.detail, {
    evaluationId: evaluation.id,
  });
  expect(
    evaluationDetailSchema.parse(JSON.parse(raw ?? "null")).workflow.records,
  ).toEqual([]);
  await ingestWorkflow(t, [
    { kind: "event", value: selection },
    ...Array.from({ length: 70 }, (_unused, index) => ({
      kind: "event" as const,
      value: {
        ...phase,
        id: phase.runId + ":bounded:" + index,
        sequence: 1000 + index,
      },
    })),
  ]);
  raw = await owner.query(api.evaluations.detail, {
    evaluationId: evaluation.id,
  });
  const detail = evaluationDetailSchema.parse(JSON.parse(raw ?? "null"));
  expect(detail.workflow.records.length).toBeLessThanOrEqual(65);
  expect(detail.workflow.truncated).toBe(true);
});
test("flow judgments are owner-only, require route evidence and preserve annotation snapshots and outcome independence", async () => {
  const { t, evaluation, owner } = await setup();
  const { annotations } = workflowFixture();
  await ingestWorkflow(
    t,
    annotations.map((value) => ({ kind: "event", value })),
  );
  const selection = annotations[0];
  const phase = annotations.at(-1);
  if (!selection || !phase) throw new Error("Missing flow evidence");
  const judgment = (event: typeof selection) => ({
    verdict: "pass",
    reason: "Reviewed the route and its supporting before/after evidence.",
    evidence: [{ kind: "trace", runId: event.runId, eventId: event.id }],
  });
  const input = {
    ...fixtureAssessment("fail"),
    flow: { route: judgment(selection), execution: judgment(phase) },
  };
  const args = {
    evaluationId: evaluation.id,
    requestId: crypto.randomUUID(),
    assessment: JSON.stringify(input),
  };
  await expect(t.mutation(api.evaluations.assess, args)).rejects.toThrow(
    "Unauthorized",
  );
  await expect(
    owner.mutation(api.evaluations.assess, {
      ...args,
      assessment: JSON.stringify({
        ...input,
        flow: { route: judgment(phase), execution: judgment(phase) },
      }),
    }),
  ).rejects.toThrow("selection evidence");
  const id = await owner.mutation(api.evaluations.assess, args);
  expect(await owner.mutation(api.evaluations.assess, args)).toBe(id);
  await expect(
    owner.mutation(api.evaluations.assess, {
      ...args,
      assessment: JSON.stringify({
        ...input,
        flow: {
          ...input.flow,
          route: { ...input.flow.route, reason: "Changed reason" },
        },
      }),
    }),
  ).rejects.toThrow("reused");
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: { ...selection, title: "Later capture revision" },
        },
      ],
      10000,
    ),
  });
  const detail = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, {
        evaluationId: evaluation.id,
      })) ?? "null",
    ),
  );
  expect(detail.assessments[0]?.flow?.route.verdict).toBe("pass");
  expect(detail.assessments[0]?.outcome.verdict).toBe("fail");
  expect(
    detail.assessments[0]?.traces.find(
      (trace) => trace.event.id === selection.id,
    )?.event.title,
  ).toBe(selection.title);
  expect(
    detail.assessments[0]?.traces.find(
      (trace) => trace.event.id === selection.id,
    )?.event.workflow,
  ).toEqual(selection.workflow);
  expect(detail.feedback).toEqual([]);
});
test("evaluation snapshots preserve original intent and captured turns without changing their outcomes", async () => {
  const { t, owner, evaluation } = await setup(
    "pass",
    "  " + evaluationPrompt().data.content + "\n",
  );
  const raw = await owner.query(api.evaluations.detail, {
    evaluationId: evaluation.id,
  });
  const detail = evaluationDetailSchema.parse(JSON.parse(raw ?? "null"));
  expect(detail.runs).toHaveLength(2);
  expect(detail.source?.event.data.content).toBe(evaluation.intent.request);
  expect(evaluationRequest(detail)).toBe(evaluation.intent.request);
  expect(detail.runs.every(({ run }) => run.outcome === "unknown")).toBe(true);
  expect(detail.assessments).toEqual([]);
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([{ kind: "evaluation", value: evaluation }], 2),
  });
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries(
        [
          {
            kind: "evaluation",
            value: { ...evaluation, title: "Rewritten goal" },
          },
        ],
        3,
      ),
    }),
  ).rejects.toThrow("immutable");
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: {
            ...evaluationPrompt(),
            data: { content: "Later raw capture" },
          },
        },
      ],
      2,
    ),
  });
  const next = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, {
        evaluationId: evaluation.id,
      })) ?? "null",
    ),
  );
  expect(next.source?.event.data.content).toBe(evaluation.intent.request);
});
test("owner-only assessments cite real evidence, are idempotent and retain immutable review snapshots", async () => {
  const { t, owner, evaluation } = await setup();
  const judgment = fixtureAssessment();
  const prompt = evaluationPrompt();
  judgment.intent.evidence = [
    { kind: "trace", runId: prompt.runId, eventId: prompt.id },
  ];
  const args = {
    evaluationId: evaluation.id,
    requestId: crypto.randomUUID(),
    assessment: JSON.stringify(judgment),
  };
  await expect(t.mutation(api.evaluations.assess, args)).rejects.toThrow(
    "Unauthorized",
  );
  await expect(
    t
      .withIdentity({ subject: "machine" })
      .query(api.evaluations.detail, { evaluationId: evaluation.id }),
  ).rejects.toThrow("Unauthorized");
  const id = await owner.mutation(api.evaluations.assess, args);
  expect(await owner.mutation(api.evaluations.assess, args)).toBe(id);
  await expect(
    owner.mutation(api.evaluations.assess, {
      ...args,
      assessment: JSON.stringify({
        ...judgment,
        outcome: { ...judgment.outcome, reason: "Different judgment" },
      }),
    }),
  ).rejects.toThrow("reused");
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: { ...prompt, data: { content: "Changed later" } },
        },
      ],
      2,
    ),
  });
  const detail = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, {
        evaluationId: evaluation.id,
      })) ?? "null",
    ),
  );
  expect(detail.assessments).toHaveLength(1);
  expect(detail.assessments[0]?.traces[0]?.event.data.content).toBe(
    evaluation.intent.request,
  );
  await expect(
    owner.mutation(api.evaluations.assess, {
      ...args,
      requestId: crypto.randomUUID(),
      assessment: JSON.stringify({
        ...judgment,
        intent: {
          ...judgment.intent,
          evidence: [
            { kind: "trace", runId: prompt.runId, eventId: "missing" },
          ],
        },
      }),
    }),
  ).rejects.toThrow("not captured");
});
test("proof failure prevents a passing assessed outcome and project/machine boundaries are enforced", async () => {
  const { t, owner, evaluation } = await setup("fail");
  await expect(
    owner.mutation(api.evaluations.assess, {
      evaluationId: evaluation.id,
      requestId: crypto.randomUUID(),
      assessment: JSON.stringify(fixtureAssessment()),
    }),
  ).rejects.toThrow("sufficient verification");
  expect(
    await owner.query(api.evaluations.detail, {
      evaluationId: evaluation.id,
      projectId: "other",
    }),
  ).toBeNull();
  expect(
    (
      await owner.query(api.evaluations.list, {
        projectId: "other",
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page,
  ).toEqual([]);
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: "00000000-0000-4000-8000-000000000002",
      records: entries([{ kind: "evaluation", value: evaluation }]),
    }),
  ).rejects.toThrow("Machine mismatch");
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([
        {
          kind: "evaluation",
          value: {
            ...evaluation,
            id: evaluation.id + "-foreign",
            projectId: "other",
          },
        },
      ]),
    }),
  ).rejects.toThrow("Project not enabled");
  await expect(
    owner.query(api.evaluations.list, {
      paginationOpts: { numItems: 21, cursor: null },
    }),
  ).rejects.toThrow("Invalid");
});
test("captured request references cannot be rewritten as declared intent", async () => {
  const { t, evaluation } = await setup();
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([
        {
          kind: "evaluation",
          value: {
            ...evaluation,
            id: evaluation.id + "-changed",
            intent: { ...evaluation.intent, request: "A different goal" },
          },
        },
      ]),
    }),
  ).rejects.toThrow("does not match");
});
test("evaluation ingestion rechecks current capture policy after folder enrollment changes", async () => {
  const { t, evaluation } = await setup();
  await t.run(async (ctx) => {
    const project = await ctx.db
      .query("projects")
      .withIndex("by_projectId", (q) => q.eq("projectId", fixtureProject))
      .unique();
    if (!project) throw new Error("Missing fixture project");
    await ctx.db.patch(project._id, {
      folders: [{ machineId: fixtureMachine, path: "/different" }],
    });
  });
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([
        {
          kind: "evaluation",
          value: { ...evaluation, id: evaluation.id + "-stale" },
        },
      ]),
    }),
  ).rejects.toThrow("current project capture policy");
});
test("large cited traces are rejected without saving a partial assessment", async () => {
  const { t, owner, evaluation } = await setup();
  const prompt = evaluationPrompt();
  const event = {
    ...prompt,
    id: prompt.runId + ":large-evidence",
    kind: "tool_result" as const,
    data: { output: Array.from({ length: 20 }, () => "x".repeat(8000)) },
  };
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([{ kind: "event", value: event }]),
  });
  const judgment = fixtureAssessment();
  judgment.intent.evidence = [
    { kind: "trace", runId: event.runId, eventId: event.id },
  ];
  await expect(
    owner.mutation(api.evaluations.assess, {
      evaluationId: evaluation.id,
      requestId: crypto.randomUUID(),
      assessment: JSON.stringify(judgment),
    }),
  ).rejects.toThrow("byte budget");
  const detail = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, {
        evaluationId: evaluation.id,
      })) ?? "null",
    ),
  );
  expect(detail.assessments).toEqual([]);
});

test("outcome feedback persists independently of proof and detailed grades, with owner-only immutable retries", async () => {
  const { t, owner, evaluation } = await setup("fail");
  const args = {
    evaluationId: evaluation.id,
    requestId: crypto.randomUUID(),
    feedback: JSON.stringify({
      choice: "yes",
      comment: "Useful result; the failing check still needs attention.",
    }),
  };
  await expect(t.mutation(api.evaluations.reviewOutcome, args)).rejects.toThrow(
    "Unauthorized",
  );
  await expect(
    t
      .withIdentity({ subject: "machine" })
      .mutation(api.evaluations.reviewOutcome, args),
  ).rejects.toThrow("Unauthorized");
  const id = await owner.mutation(api.evaluations.reviewOutcome, args);
  expect(await owner.mutation(api.evaluations.reviewOutcome, args)).toBe(id);
  await expect(
    owner.mutation(api.evaluations.reviewOutcome, {
      ...args,
      feedback: JSON.stringify({ choice: "no", comment: "Changed" }),
    }),
  ).rejects.toThrow("reused");
  await expect(
    owner.mutation(api.evaluations.reviewOutcome, {
      ...args,
      evaluationId: "missing",
    }),
  ).rejects.toThrow("unavailable");
  await expect(
    owner.mutation(api.evaluations.reviewOutcome, {
      ...args,
      requestId: crypto.randomUUID(),
      feedback: JSON.stringify({ choice: "pass", comment: "" }),
    }),
  ).rejects.toThrow();
  await owner.mutation(api.evaluations.reviewOutcome, {
    ...args,
    requestId: crypto.randomUUID(),
    feedback: JSON.stringify({ choice: "partly", comment: "" }),
  });
  const detail = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, {
        evaluationId: evaluation.id,
      })) ?? "null",
    ),
  );
  expect(detail.feedback).toHaveLength(2);
  expect(detail.feedback[0]?.choice).toBe("partly");
  expect(detail.feedback[1]?.comment).toContain("failing check");
  expect(detail.assessments).toEqual([]);
  expect(detail.runs.every(({ run }) => run.outcome === "unknown")).toBe(true);
  const listing = await owner.query(api.evaluations.list, {
    projectId: fixtureProject,
    paginationOpts: { numItems: 20, cursor: null },
  });
  const row = evaluationSummarySchema.parse(
    JSON.parse(listing.page[0] ?? "null"),
  );
  expect(row.feedback).toBe("partly");
  expect(row.verification).toBe("fail");
  expect(row.outcome).toBeNull();
  expect(
    (
      await owner.query(api.evaluations.list, {
        projectId: "other",
        paginationOpts: { numItems: 20, cursor: null },
      })
    ).page,
  ).toEqual([]);
});

test("timeline excerpts use real captured content and names, exclude context and withheld data, and honor current enrollment", async () => {
  const { t, owner, evaluation } = await setup();
  const run = evaluationRun("repair");
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([
      {
        kind: "event",
        value: {
          ...evaluationPrompt(),
          id: run.id + ":prompt",
          runId: run.id,
          data: {
            content:
              "<environment_context>Private setup</environment_context>\nRepair the saved edit.",
          },
        },
      },
      {
        kind: "event",
        value: {
          ...evaluationPrompt(),
          id: run.id + ":response",
          runId: run.id,
          sequence: 10,
          kind: "assistant_output",
          data: { content: "Save and reopen now preserve the edit." },
        },
      },
    ]),
  });
  await t.run(async (ctx) => {
    const name = await ctx.db
      .query("names")
      .withIndex("by_key", (q) =>
        q.eq("key", activityNameKey(fixtureProject, run.id)),
      )
      .unique();
    if (!name) throw new Error("Missing naming fixture");
    await ctx.db.patch(name._id, {
      state: "ready",
      title: "Repair saved edit persistence",
    });
  });
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: evaluation.id,
        })) ?? "null",
      ),
    );
  const step = (await read()).timeline.find((item) => item.runId === run.id);
  expect(step?.title).toBe("Repair saved edit persistence");
  expect(step?.request?.text).toBe("Repair the saved edit.");
  expect(step?.response?.eventId).toBe(run.id + ":response");
  expect(step?.response?.revision).toBe(1);
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: {
            ...evaluationPrompt(),
            id: run.id + ":response",
            runId: run.id,
            sequence: 10,
            kind: "assistant_output",
            data: { content: "[WITHHELD]" },
          },
        },
      ],
      2,
    ),
  });
  expect(
    (await read()).timeline.find((item) => item.runId === run.id)?.response,
  ).toBeNull();
  await t.run(async (ctx) => {
    const current = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", run.id))
      .unique();
    if (!current) throw new Error("Fixture missing");
    await ctx.db.patch(current._id, { enrolled: false });
  });
  expect(
    (await read()).timeline.find((item) => item.runId === run.id)?.request,
  ).toBeNull();
});

test("current delegated journeys resolve indexed child turns and explicit joins without changing immutable evaluation runs", async () => {
  const { journeyFixture } =
    await import("@astack/agent-observability/journey-fixtures");
  const { t, evaluation, owner } = await setup("inconclusive");
  const fixture = journeyFixture();
  await ingestWorkflow(
    t,
    [fixture.parent, ...fixture.children].map((value) => ({
      kind: "run",
      value,
    })),
  );
  await ingestWorkflow(
    t,
    fixture.events.map((value) => ({ kind: "event", value })),
  );
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: evaluation.id,
          projectId: fixtureProject,
        })) ?? "null",
      ),
    );
  const captured = await read();
  expect(captured.runs).toHaveLength(2);
  expect(captured.runs.every(({ run }) => run.delegations.length === 0)).toBe(
    true,
  );
  expect(
    captured.workflow.branches.map((branch) => branch.runs.length),
  ).toEqual([2, 1]);
  expect(
    captured.workflow.branches.map((branch) =>
      branch.reads.map((read) => read.skill.name),
    ),
  ).toEqual([["react", "react"], ["testing"]]);
  const join = captured.workflow.records.find(
    (record) => record.annotation.action === "join",
  );
  expect(join?.evidence.every((item) => item.state === "available")).toBe(true);
  expect(captured.assessments).toEqual([]);
  await ingestWorkflow(
    t,
    fixture.children.map((child) => ({
      kind: "run",
      value: { ...child, contentCapture: false },
    })),
  );
  // Force an explicitly newer revision than the earlier capture.
  for (const child of fixture.children)
    await t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries(
        [{ kind: "run", value: { ...child, contentCapture: false } }],
        100,
      ),
    });
  const withheld = await read();
  expect(
    withheld.workflow.branches.every(
      (branch) =>
        branch.state === "unavailable" &&
        !branch.reads.length &&
        !branch.records.length,
    ),
  ).toBe(true);
  expect(
    withheld.workflow.records
      .find((record) => record.annotation.action === "join")
      ?.evidence.every((item) => item.state === "unavailable"),
  ).toBe(true);
});

test("delegated lookup rejects stale foreign projections and cycles and bounds large child sessions", async () => {
  const { journeyFixture } =
    await import("@astack/agent-observability/journey-fixtures");
  const { t, evaluation, owner } = await setup("inconclusive");
  const fixture = journeyFixture(false);
  await ingestWorkflow(
    t,
    [fixture.parent, ...fixture.children].map((value) => ({
      kind: "run",
      value,
    })),
  );
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: evaluation.id,
          projectId: fixtureProject,
        })) ?? "null",
      ),
    );
  const child = fixture.children.find(
    (child) => child.sessionId === "child-data",
  );
  const task = fixture.parent.delegations[0];
  if (!child || !task) throw new Error("Missing child or task");
  await t.run(async (ctx) => {
    const row = await ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", child.id))
      .unique();
    if (!row) throw new Error("Missing stored child");
    await ctx.db.patch(row._id, { projectId: "foreign-project" });
  });
  const foreign = (await read()).workflow.branches.find(
    (branch) => branch.delegation.id === "delegate-data",
  );
  expect(foreign).toMatchObject({
    state: "unavailable",
    runs: [],
    reads: [],
    records: [],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "run",
          value: {
            ...fixture.parent,
            delegations: [
              {
                ...task,
                id: "cycle",
                source: "codex",
                child: { kind: "codex", sessionId: fixture.parent.sessionId },
              },
            ],
          },
        },
      ],
      100,
    ),
  });
  expect((await read()).workflow.branches[0]).toMatchObject({
    state: "unavailable",
    runs: [],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([{ kind: "run", value: fixture.parent }], 101),
  });
  for (let index = 0; index < 22; index++) {
    const value = {
      ...child,
      id: child.id + ":extra:" + index,
      attemptId: "extra-" + index,
      startedAt: child.startedAt + index,
    };
    await t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([{ kind: "run", value }], 102),
    });
  }
  const bounded = await read();
  expect(bounded.workflow.truncated).toBe(true);
  expect(
    bounded.workflow.branches.reduce(
      (count, branch) => count + branch.runs.length,
      0,
    ),
  ).toBeLessThanOrEqual(20);
  expect(bounded.workflow.branches.some((branch) => branch.truncated)).toBe(
    true,
  );
});

async function resultCaptureFixture() {
  const state = await setup("inconclusive");
  const fixture = journeyFixture();
  const self = {
    kind: "t3",
    environmentId: "fixture-host",
    threadId: "parent-thread",
  } as const;
  fixture.parent.sessionReferences = [self];
  fixture.parent.conversation = {
    self,
    root: self,
    hostRun: { id: "parent-host-run" },
  };
  const frozen = await state.t.run(
    async (ctx) => (await ctx.db.query("evaluations").first())?.snapshot,
  );
  await ingestWorkflow(
    state.t,
    [fixture.parent, ...fixture.children].map((value) => ({
      kind: "run",
      value,
    })),
  );
  await ingestWorkflow(
    state.t,
    fixture.events.map((value) => ({ kind: "event", value })),
  );
  const task = fixture.parent.delegations[0];
  if (!task) throw new Error("missing direct task");
  const event = (
    observation: DelegationResult["observation"],
    suffix: string = observation.state,
    content = "Scoped child result",
  ) =>
    eventSchema.parse({
      id: fixture.parent.id + ":host-observation:" + suffix,
      runId: fixture.parent.id,
      sequence: 500 + Number(suffix.replace(/\D/g, "") || 0),
      kind: "delegation_result",
      title: "Explicit " + observation.state + " observation",
      timestamp: null,
      timing: "unavailable",
      observedAt: 3000,
      delegationResult: {
        delegationId: task.id,
        child: task.child,
        source: "parent_capture",
        host: {
          environmentId: self.environmentId,
          threadId: self.threadId,
          runId: "parent-host-run",
          origin: "app_owned",
        },
        observation,
        sourceUpdatedAt: 1700,
        occurredAt: null,
      },
      data: { result: content },
    });
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await state.owner.query(api.evaluations.detail, {
          evaluationId: state.evaluation.id,
          projectId: fixtureProject,
        })) ?? "null",
      ),
    );
  return { ...state, fixture, frozen, event, read };
}

test("independent host facts appear in current work capture without altering frozen evaluation evidence or outcome", async () => {
  const { t, event, read, frozen, fixture, evaluation } =
    await resultCaptureFixture();
  const before = await read();
  const present = event({ state: "present", resultId: "revision-1" });
  await ingestWorkflow(t, [{ kind: "event", value: present }]);
  expect(
    (await read()).workflow.results.map((result) => result.observation.state),
  ).toEqual(["present"]);
  await ingestWorkflow(
    t,
    [
      event({ state: "delivered", resultId: "revision-1" }),
      event({
        state: "acknowledged",
        resultId: "revision-1",
        observedByRunId: null,
      }),
    ].map((value) => ({ kind: "event", value })),
  );
  const current = await read();
  expect(
    current.workflow.results.map((result) => result.observation.state).sort(),
  ).toEqual(["acknowledged", "delivered", "present"]);
  expect(
    current.workflow.results.find(
      (result) => result.observation.state === "acknowledged",
    ),
  ).toMatchObject({
    source: "parent_capture",
    observedAt: 3000,
    sourceUpdatedAt: 1700,
    occurredAt: null,
    observation: { state: "acknowledged", observedByRunId: null },
  });
  expect(current.runs).toEqual(before.runs);
  expect(current.assessments).toEqual(before.assessments);
  expect(current.timeline).toEqual(before.timeline);
  expect(
    await t.run(
      async (ctx) => (await ctx.db.query("evaluations").first())?.snapshot,
    ),
  ).toBe(frozen);
  const parent = await t.run(async (ctx) =>
    ctx.db
      .query("runs")
      .withIndex("by_runId", (q) => q.eq("runId", fixture.parent.id))
      .unique(),
  );
  expect(JSON.parse(parent?.data ?? "null").outcome).toBe(
    fixture.parent.outcome,
  );
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [
        {
          kind: "event",
          value: { ...present, observedAt: 9999, title: "stale rewrite" },
        },
      ],
      1,
    ),
  });
  expect(
    (await read()).workflow.results.find(
      (result) => result.observation.state === "present",
    )?.title,
  ).toBe("Explicit present observation");
  await expect(
    t.query(api.evaluations.detail, { evaluationId: evaluation.id }),
  ).rejects.toThrow("Unauthorized");
});

test("acknowledgment with nullable result and host run supplies no presence or delivery fact", async () => {
  const { t, event, read } = await resultCaptureFixture();
  const acknowledged = event({
    state: "acknowledged",
    resultId: null,
    observedByRunId: null,
  });
  if (!acknowledged.delegationResult) throw new Error("missing observation");
  acknowledged.delegationResult.host.runId = null;
  await ingestWorkflow(t, [{ kind: "event", value: acknowledged }]);
  expect(
    (await read()).workflow.results.map((result) => result.observation),
  ).toEqual([{ state: "acknowledged", resultId: null, observedByRunId: null }]);
});

test.each([
  "foreign-child-project",
  "foreign-child-machine",
  "child-content-off",
  "parent-content-off",
  "paused-project",
  "removed-folder",
])(
  "result capture rechecks %s policy rather than trusting frozen or session-index rows",
  async (policy) => {
    const { t, event, read, fixture, owner } = await resultCaptureFixture();
    await ingestWorkflow(t, [
      {
        kind: "event",
        value: event({ state: "present", resultId: "revision-1" }),
      },
    ]);
    expect(
      (await read()).workflow.results.map((result) => result.observation.state),
    ).toEqual(["present"]);
    if (policy === "paused-project" || policy === "removed-folder") {
      await owner.mutation(api.projects.save, {
        project: {
          projectId: fixtureProject,
          name: "Fixture",
          enabled: policy !== "paused-project",
          repositories: [],
          folders: [
            {
              machineId: fixtureMachine,
              path: policy === "removed-folder" ? "/elsewhere" : "/fixture",
            },
          ],
        },
      });
    } else {
      const ids =
        policy === "parent-content-off"
          ? [fixture.parent.id]
          : fixture.children
              .filter((child) => child.sessionId === "child-ui")
              .map((child) => child.id);
      await t.run(async (ctx) => {
        for (const id of ids) {
          const row = await ctx.db
            .query("runs")
            .withIndex("by_runId", (q) => q.eq("runId", id))
            .unique();
          if (!row) throw new Error("missing policy fixture run");
          if (policy === "foreign-child-project")
            await ctx.db.patch(row._id, { projectId: "foreign-project" });
          else if (policy === "foreign-child-machine")
            await ctx.db.patch(row._id, { machineId: "foreign-machine" });
          else
            await ctx.db.patch(row._id, {
              data: JSON.stringify({
                ...JSON.parse(row.data),
                contentCapture: false,
              }),
            });
        }
      });
    }
    const capture = await read();
    expect(capture.workflow.results).toEqual([]);
    if (policy.startsWith("foreign-child") || policy === "child-content-off")
      expect(
        capture.workflow.branches.find(
          (branch) => branch.delegation.id === "delegate-ui",
        ),
      ).toMatchObject({
        state: "unavailable",
        runs: [],
        records: [],
        reads: [],
      });
  },
);

test("result capture rejects mismatched host, task, child and event-machine identities", async () => {
  const { t, event, read } = await resultCaptureFixture();
  const valid = event({ state: "present", resultId: "revision-1" });
  await ingestWorkflow(t, [{ kind: "event", value: valid }]);
  if (!valid.delegationResult) throw new Error("missing observation");
  const result = valid.delegationResult;
  const invalid = [
    { ...result, delegationId: "undeclared-task" },
    { ...result, host: { ...result.host, environmentId: "other-host" } },
    { ...result, host: { ...result.host, threadId: "other-thread" } },
    { ...result, host: { ...result.host, runId: "other-run" } },
    {
      ...result,
      child: {
        kind: "t3",
        environmentId: "fixture-host",
        threadId: "not-this-child",
      },
    },
  ];
  await ingestWorkflow(
    t,
    invalid.map((delegationResult, index) => ({
      kind: "event",
      value: eventSchema.parse({
        ...valid,
        id: valid.id + ":invalid:" + index,
        delegationResult,
      }),
    })),
  );
  const foreign = { ...valid, id: valid.id + ":foreign-machine" };
  await t.run(async (ctx) => {
    await ctx.db.insert("events", {
      eventId: foreign.id,
      runId: foreign.runId,
      machineId: "other-machine",
      revision: 100,
      sequence: foreign.sequence,
      kind: foreign.kind,
      data: JSON.stringify(foreign),
    });
  });
  expect(
    (await read()).workflow.results.map((item) => item.reference.eventId),
  ).toEqual([valid.id]);
});

test.each(["count", "bytes"])(
  "indexed result reads expose the shared %s bound",
  async (limit) => {
    const { t, event, read } = await resultCaptureFixture();
    const events = Array.from({ length: 100 }, (_, index) =>
      event(
        { state: "present", resultId: "revision-" + index },
        "revision-" + index,
        limit === "bytes" ? "🧪".repeat(4000) : "Scoped result",
      ),
    );
    await ingestWorkflow(
      t,
      events.map((value) => ({ kind: "event", value })),
    );
    const current = await read();
    expect(current.workflow.truncated).toBe(true);
    if (limit === "count") expect(current.workflow.results).toHaveLength(96);
    else {
      expect(current.workflow.results.length).toBeLessThan(20);
      expect(current.workflow.results[0]?.observation).toEqual({
        state: "present",
        resultId: "revision-0",
      });
    }
    expect(
      current.workflow.results.some(
        (result) => result.observation.resultId === "revision-99",
      ),
    ).toBe(false);
  },
);

test("PR delivery has owner/readable policy, immutable capture and separate current observations", async () => {
  const { t, evaluation, owner } = await setup();
  const run = {
    ...evaluationRun(),
    repo: "https://github.com/applification/astack",
  };
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([{ kind: "run", value: run }], 500),
  });
  const evidence = deliveryFixture();
  const event = eventSchema.parse({
    id: run.id + ":delivery",
    runId: run.id,
    sequence: 50,
    kind: "delivery_recorded",
    timestamp: 2000,
    observedAt: 2000,
    timing: "agent",
    title: "PR evidence",
    delivery: { ...evidence, current: null },
    data: {},
  });
  const ingest = (value: typeof event, revision: number) =>
    t.mutation(internal.ingestion.ingest, {
      machineId: fixtureMachine,
      records: entries([{ kind: "event", value }], revision),
    });
  await ingest(event, 600);
  const read = async () =>
    evaluationDetailSchema.parse(
      JSON.parse(
        (await owner.query(api.evaluations.detail, {
          evaluationId: evaluation.id,
          projectId: fixtureProject,
        })) ?? "null",
      ),
    );
  const before = await read();
  expect(before.delivery?.evidence).toEqual(event.delivery);
  await expect(
    t.query(api.evaluations.detail, {
      evaluationId: evaluation.id,
      projectId: fixtureProject,
    }),
  ).rejects.toThrow();
  await expect(
    ingest(
      {
        ...event,
        delivery: {
          ...evidence,
          snapshot: { ...evidence.snapshot, title: "Rewritten" },
        },
      },
      601,
    ),
  ).rejects.toThrow("immutable");
  await expect(
    ingest(
      {
        ...event,
        id: run.id + ":foreign",
        delivery: {
          ...evidence,
          snapshot: {
            ...evidence.snapshot,
            repository: "another/project",
            url: "https://github.com/another/project/pull/26",
            media: [],
          },
        },
      },
      602,
    ),
  ).rejects.toThrow("repository");
  await ingest({ ...event, delivery: evidence }, 603);
  const refreshed = await read();
  expect(refreshed.delivery?.evidence).toEqual(evidence);
  expect(refreshed.evaluation).toEqual(before.evaluation);
  expect(refreshed.runs).toEqual(before.runs);
  expect(refreshed.assessments).toEqual(before.assessments);
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries(
      [{ kind: "run", value: { ...run, contentCapture: false } }],
      700,
    ),
  });
  expect((await read()).delivery).toBeNull();
  await expect(
    ingest({ ...event, id: run.id + ":withheld" }, 701),
  ).rejects.toThrow("readable");
  await t.mutation(internal.ingestion.ingest, {
    machineId: fixtureMachine,
    records: entries([{ kind: "run", value: run }], 800),
  });
  await owner.mutation(api.projects.save, {
    project: {
      projectId: fixtureProject,
      name: "Fixture",
      enabled: false,
      repositories: [],
      folders: [{ machineId: fixtureMachine, path: "/fixture" }],
    },
  });
  expect((await read()).delivery).toBeNull();
});
