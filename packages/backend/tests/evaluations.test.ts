import { beforeEach, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { evaluationDetailSchema } from "@astack/agent-observability/evaluation-view";
import {
  evaluationFixture,
  evaluationRun,
  evaluationPrompt,
  fixtureAssessment,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import type { TelemetryRecord } from "@astack/agent-observability";

const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/observatory.ts": () => import("../convex/observatory"),
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
  expect(detail.evaluation.intent.request).toBe(evaluation.intent.request);
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
