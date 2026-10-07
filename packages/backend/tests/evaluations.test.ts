import { beforeEach, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  evaluationDetailSchema,
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
import type { TelemetryRecord } from "@astack/agent-observability";
import { workflowFixture } from "@astack/agent-observability/workflow-fixtures";

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
