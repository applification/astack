import { beforeEach, expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { createHash } from "node:crypto";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import {
  capabilityKey,
  eventSchema,
  runSchema,
} from "@astack/agent-observability";
import {
  filterOptionsSchema,
  mergeFilterOptions,
} from "@astack/agent-observability/filters";
import { workNameKey } from "@astack/agent-observability/naming";
import { automationKey } from "@astack/agent-observability/automations";
import { fixtureAutomation } from "@astack/agent-observability/automation-fixtures";
import {
  conversationGroupKey,
  conversationGroupSchema,
} from "@astack/agent-observability/conversations";
import type { FunctionReturnType } from "convex/server";

// Explicit module loaders work in Bun without a Vite-only import.meta.glob.
const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/observatory.ts": () => import("../convex/observatory"),
  "../convex/conversations.ts": () => import("../convex/conversations"),
  "../convex/ingestion.ts": () => import("../convex/ingestion"),
  "../convex/auth.ts": () => import("../convex/auth"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/http.ts": () => import("../convex/http"),
  "../convex/naming.ts": () => import("../convex/naming"),
};
const machineId = "00000000-0000-4000-8000-000000000001";
const projectId = "00000000-0000-4000-8000-000000000100";
const secondId = "00000000-0000-4000-8000-000000000002";
const credential = "test-only-ingestion-key-123456";
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const paginationOpts = { numItems: 100, cursor: null };
const skill = {
  name: "convex-expert",
  kind: "skill",
  hash: "version1",
  provenance: "observation_time",
  evidence: "read",
} as const;
function run(id = machineId, attempt = "turn") {
  return runSchema.parse({
    id: `${id}:codex:session:${attempt}`,
    machineId: id,
    machineName: "Fixture",
    agent: "codex",
    agentVersion: "0.160.0",
    sessionId: "session",
    attemptId: attempt,
    source: "vscode",
    cwd: "/fixture",
    projectId,
    title: "Fixture turn",
    startedAt: 1000,
    completedAt: 2000,
    status: "completed",
    lastObservedAt: 3000,
    skills: [skill],
    tools: ["shell"],
    findings: [],
    eventCount: 0,
    contentCapture: false,
    coverage: [],
  });
}
function entry(value = run(), revision = 1) {
  return { revision, record: JSON.stringify({ kind: "run", value }) };
}
test("indexed conversation groups include cross-provider children, preserve work links and paginate independently", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const root = {
    kind: "t3",
    environmentId: "fixture-host",
    threadId: "root",
  } as const;
  const first = {
    ...run(),
    conversation: { self: root, root },
    work: { id: "issue-1" },
  };
  const child = {
    ...run(machineId, "child"),
    sessionId: "child-session",
    agent: "claude",
    source: "t3:fixture-host",
    startedAt: 1100,
    conversation: {
      self: { ...root, threadId: "child" },
      root,
      parent: { reference: root, relationship: "subagent" as const },
    },
    work: { id: "issue-2" },
  };
  const nested = {
    ...child,
    id: run(machineId, "grandchild").id,
    sessionId: "grandchild-session",
    startedAt: 1200,
    conversation: {
      self: { ...root, threadId: "grandchild" },
      root,
      parent: {
        reference: child.conversation.self,
        relationship: "subagent" as const,
      },
    },
  };
  // Children can arrive before the root without creating separate work identities.
  for (const value of [child, nested, first])
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [entry(value)],
    });
  const groupId = conversationGroupKey(first)!;
  const raw = await owner.query(api.conversations.group, {
    groupId,
    projectId,
  });
  expect(conversationGroupSchema.parse(JSON.parse(raw!))).toMatchObject({
    turns: 3,
    delegatedTurns: 2,
    rootRunId: first.id,
  });
  const page = await owner.query(api.conversations.turns, {
    groupId,
    projectId,
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(page.isDone).toBe(false);
  expect(
    page.page.map((value) => runSchema.parse(JSON.parse(value)).id),
  ).toEqual([nested.id]);
  const next = await owner.query(api.conversations.turns, {
    groupId,
    projectId,
    paginationOpts: { numItems: 2, cursor: page.continueCursor },
  });
  expect(
    next.page.map((value) => runSchema.parse(JSON.parse(value)).work?.id),
  ).toEqual(["issue-2", "issue-1"]);
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(first, 2), entry(child, 2)],
  });
  const replay = await owner.query(api.conversations.group, {
    groupId,
    projectId,
  });
  expect(conversationGroupSchema.parse(JSON.parse(replay!)).turns).toBe(3);
});

test("conversation queries enforce owner, project and machine scope", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const first = run();
  const second = run(secondId);
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(first)],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId: secondId,
    records: [entry(second)],
  });
  const a = conversationGroupKey(first)!;
  const b = conversationGroupKey(second)!;
  expect(a).not.toBe(b);
  const groups = await owner.query(api.conversations.groups, {
    projectId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(groups.page).toHaveLength(2);
  expect(
    await owner.query(api.conversations.group, {
      groupId: a,
      projectId: "outside",
    }),
  ).toBeNull();
  expect(
    (
      await owner.query(api.conversations.turns, {
        groupId: a,
        paginationOpts: { numItems: 50, cursor: null },
      })
    ).page.map((value) => runSchema.parse(JSON.parse(value)).machineId),
  ).toEqual([machineId]);
  for (const query of [
    () =>
      t.query(api.conversations.groups, {
        paginationOpts: { numItems: 50, cursor: null },
      }),
    () => t.query(api.conversations.group, { groupId: a }),
    () =>
      t.query(api.conversations.turns, {
        groupId: a,
        paginationOpts: { numItems: 50, cursor: null },
      }),
    () =>
      t.query(api.conversations.forEvaluation, { evaluationId: "anything" }),
  ])
    await expect(query()).rejects.toThrow();
});

test("conversation membership enrichment moves a turn without retaining an orphan group", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const first = run();
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(first)],
  });
  const self = {
    kind: "t3",
    environmentId: "fixture",
    threadId: "root",
  } as const;
  const enriched = { ...first, conversation: { self, root: self } };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(enriched, 2)],
  });
  expect(
    await owner.query(api.conversations.group, {
      groupId: conversationGroupKey(first)!,
    }),
  ).toBeNull();
  const groups = await owner.query(api.conversations.groups, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(
    groups.page.map(
      (value) => conversationGroupSchema.parse(JSON.parse(value)).turns,
    ),
  ).toEqual([1]);
});

test("conversation rebuild is bounded, repeatable and leaves capture revisions unchanged", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const first = run();
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(first)],
  });
  const before = await t.run(async (ctx) => {
    const record = await ctx.db.query("runs").first();
    for (const row of await ctx.db.query("conversationTurns").take(10))
      await ctx.db.delete(row._id);
    for (const row of await ctx.db.query("conversationGroups").take(10))
      await ctx.db.delete(row._id);
    return record;
  });
  await t.mutation(internal.conversations.rebuild, {
    paginationOpts: { numItems: 3, cursor: null },
  });
  await t.mutation(internal.conversations.rebuild, {
    paginationOpts: { numItems: 3, cursor: null },
  });
  const group = await owner.query(api.conversations.group, {
    groupId: conversationGroupKey(first)!,
  });
  expect(JSON.parse(group!).turns).toBe(1);
  const after = await t.run(async (ctx) => await ctx.db.query("runs").first());
  expect(after?.data).toBe(before?.data);
  expect(after?.revision).toBe(before?.revision);
  await expect(
    t.mutation(internal.conversations.rebuild, {
      paginationOpts: { numItems: 4, cursor: null },
    }),
  ).rejects.toThrow("Invalid repair page");
});
async function setup() {
  const t = convexTest(schema, modules);
  await t.run(async (ctx) => {
    await ctx.db.insert("projects", {
      projectId,
      name: "Fixture",
      enabled: true,
      repositories: [],
      folders: [
        { machineId, path: "/fixture" },
        { machineId: secondId, path: "/fixture" },
      ],
    });
  });
  return t;
}
beforeEach(() => {
  process.env.OBSERVATORY_OWNER = "owner@example.test";
  process.env.OBSERVATORY_OWNER_ID = "00000000-0000-4000-8000-000000000010";
  process.env.OBSERVATORY_VIEWER_TOKEN_HASH = hash("test-only-viewer-key");
  process.env.AGENTLOG_MACHINES = JSON.stringify([
    { machineId, tokenHash: hash(credential) },
    { machineId: secondId, tokenHash: hash("second-ingestion-key") },
  ]);
});

function prompt(
  value: ReturnType<typeof run>,
  text = "Add readable Work headings",
  revision = 1,
) {
  const event = eventSchema.parse({
    id: `${value.id}:prompt`,
    runId: value.id,
    sequence: 1,
    kind: "user_prompt",
    timestamp: 1000,
    observedAt: 1000,
    timing: "agent",
    title: "User request",
    data: { content: text },
  });
  return { revision, record: JSON.stringify({ kind: "event", value: event }) };
}
async function makeNamesDue(t: Awaited<ReturnType<typeof setup>>) {
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("names").take(100))
      if (row.state === "pending")
        await ctx.db.patch(row._id, { availableAt: 0 });
  });
}
test("naming batches related conversations once, keeps source telemetry intact and preserves explicit labels across pages", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const first = { ...run(), contentCapture: true, work: { id: "PR-142" } };
  const second = {
    ...run(machineId, "second"),
    sessionId: "different-conversation",
    contentCapture: true,
    work: { id: "PR-142" },
  };
  for (const value of [first, second])
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [
        entry(value),
        prompt(
          value,
          value === first
            ? "Add readable Work headings"
            : "Also name each captured activity",
        ),
      ],
    });
  expect(await owner.mutation(api.naming.claim, {})).toEqual([]); // Gather related requests before inference.
  await makeNamesDue(t);
  const claims = await owner.mutation(api.naming.claim, {});
  expect(claims).toHaveLength(3);
  expect(claims.find((c) => c.kind === "work")?.requests).toEqual([
    "Add readable Work headings",
    "Also name each captured activity",
  ]);
  expect(await owner.mutation(api.naming.claim, {})).toEqual([]); // Another worker cannot duplicate an active claim.
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: claims.map((c) => ({
        key: c.key,
        claim: c.claim,
        title:
          c.kind === "work"
            ? "Name Work and activities"
            : "Name captured activity",
      })),
    }),
  ).toBe(3);
  const raw = await owner.query(api.observatory.run, { runId: first.id });
  expect(raw && JSON.parse(raw).title).toBe(first.title);
  expect(raw && JSON.parse(raw).outcome).toBe("unknown");
  for (const value of [first, second])
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [
        entry(value, 2),
        prompt(value, "Updated text in the same request", 2),
      ],
    });
  await makeNamesDue(t);
  expect(await owner.mutation(api.naming.claim, {})).toEqual([]);
  expect(
    (await owner.query(api.naming.labels, { runIds: [first.id] }))[0],
  ).toEqual({
    runId: first.id,
    activity: "Name captured activity",
    work: "Name Work and activities",
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry(
        { ...second, work: { id: "PR-142", label: "Owner’s chosen heading" } },
        3,
      ),
    ],
  });
  // The named source can be outside the currently loaded page.
  expect(
    (await owner.query(api.naming.labels, { runIds: [first.id] }))[0]?.work,
  ).toBe("Owner’s chosen heading");
});
test("naming is owner-only and excludes metadata-only, withheld and paused-project inputs", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const value = { ...run(), contentCapture: true, work: { id: "PR-142" } };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(value), prompt(value)],
  });
  for (const actor of [
    t,
    t.withIdentity({ subject: machineId }),
    t.withIdentity({ subject: "other-owner" }),
  ]) {
    await expect(actor.mutation(api.naming.claim, {})).rejects.toThrow(
      "Unauthorized",
    );
    await expect(
      actor.mutation(api.naming.complete, { model: "gpt-6-luna", names: [] }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      actor.mutation(api.naming.fail, { claims: [] }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      actor.mutation(api.naming.backfill, {
        paginationOpts: { numItems: 3, cursor: null },
      }),
    ).rejects.toThrow("Unauthorized");
    await expect(
      actor.query(api.naming.labels, { runIds: [value.id] }),
    ).rejects.toThrow("Unauthorized");
  }
  for (const [attempt, capture, text] of [
    ["metadata", false, "Hidden prompt"],
    ["withheld", true, "[WITHHELD]"],
  ] as const) {
    const excluded = { ...run(machineId, attempt), contentCapture: capture };
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [entry(excluded), prompt(excluded, text)],
    });
  }
  expect(
    await t.run(async (ctx) => (await ctx.db.query("names").take(20)).length),
  ).toBe(2);
  await t.run(async (ctx) => {
    const project = await ctx.db.query("projects").first();
    if (project) await ctx.db.patch(project._id, { enabled: false });
  });
  await makeNamesDue(t);
  expect(await owner.mutation(api.naming.claim, {})).toEqual([]);
  await expect(
    owner.query(api.naming.labels, { runIds: Array(51).fill(value.id) }),
  ).rejects.toThrow("Invalid names page");
});
test("naming retries safely and rechecks source revision, membership and project policy at completion", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const value = { ...run(), contentCapture: true, work: { id: "PR-142" } };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(value), prompt(value)],
  });
  await makeNamesDue(t);
  const initial = await owner.mutation(api.naming.claim, {});
  await owner.mutation(api.naming.fail, {
    claims: initial.map(({ key, claim }) => ({ key, claim })),
  });
  expect(await owner.mutation(api.naming.claim, {})).toEqual([]);
  await makeNamesDue(t);
  const fresh = await owner.mutation(api.naming.claim, {});
  expect(fresh[0]?.claim).not.toBe(initial[0]?.claim);
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: initial.map((c) => ({
        key: c.key,
        claim: c.claim,
        title: "Stale name",
      })),
    }),
  ).toBe(0);
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [prompt(value, "Revised redacted request", 2)],
  });
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: fresh.map((c) => ({
        key: c.key,
        claim: c.claim,
        title: "Old request name",
      })),
    }),
  ).toBe(0);
  await makeNamesDue(t);
  const changed = await owner.mutation(api.naming.claim, {});
  expect(
    changed.every((c) => c.requests[0] === "Revised redacted request"),
  ).toBe(true);
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry({ ...value, work: { id: "PR-other" } }, 2)],
  });
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: changed.map((c) => ({
        key: c.key,
        claim: c.claim,
        title: "New request name",
      })),
    }),
  ).toBe(1); // Activity survives; old Work membership does not.
  await makeNamesDue(t);
  const moved = await owner.mutation(api.naming.claim, {});
  expect(moved[0]?.key).toBe(workNameKey(projectId, "PR-other"));
  await t.run(async (ctx) => {
    const project = await ctx.db.query("projects").first();
    if (project) await ctx.db.patch(project._id, { enabled: false });
  });
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: moved.map((c) => ({
        key: c.key,
        claim: c.claim,
        title: "Disabled project name",
      })),
    }),
  ).toBe(0);
});
test("bounded naming backfill is replay-safe and identical Work IDs remain project-scoped", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const otherId = "00000000-0000-4000-8000-000000000101";
  await t.run(async (ctx) => {
    await ctx.db.insert("projects", {
      projectId: otherId,
      name: "Other",
      enabled: true,
      repositories: [],
      folders: [{ machineId, path: "/other" }],
    });
  });
  const values = [
    { ...run(), contentCapture: true, work: { id: "PR-142" } },
    {
      ...run(machineId, "other-project"),
      projectId: otherId,
      cwd: "/other",
      contentCapture: true,
      work: { id: "PR-142" },
    },
  ];
  for (const value of values)
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [entry(value), prompt(value)],
    });
  await t.run(async (ctx) => {
    for (const row of await ctx.db.query("names").take(20))
      await ctx.db.delete(row._id);
  });
  await expect(
    owner.mutation(api.naming.backfill, {
      paginationOpts: { numItems: 4, cursor: null },
    }),
  ).rejects.toThrow("Invalid backfill page");
  const page = await owner.mutation(api.naming.backfill, {
    paginationOpts: { numItems: 1, cursor: null },
  });
  expect(page.count).toBe(1);
  await owner.mutation(api.naming.backfill, {
    paginationOpts: { numItems: 3, cursor: page.continueCursor },
  });
  await owner.mutation(api.naming.backfill, {
    paginationOpts: { numItems: 3, cursor: null },
  });
  expect(
    await t.run(async (ctx) => (await ctx.db.query("names").take(20)).length),
  ).toBe(4);
  await makeNamesDue(t);
  const claims = await owner.mutation(api.naming.claim, {});
  await owner.mutation(api.naming.complete, {
    model: "gpt-6-luna",
    names: claims.map((c) => ({
      key: c.key,
      claim: c.claim,
      title: c.key.includes(otherId)
        ? "Other project objective"
        : "First project objective",
    })),
  });
  const names = await owner.query(api.naming.labels, {
    runIds: values.map((v) => v.id),
  });
  expect(names.map((n) => n.work)).toEqual([
    "First project objective",
    "Other project objective",
  ]);
});

test("naming recovers expired claims and bounds Work source requests without naming native context", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  for (let i = 0; i < 6; i++) {
    const value = {
      ...run(machineId, `bounded-${i}`),
      contentCapture: true,
      work: { id: "PR-bounded" },
    };
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [
        entry(value),
        prompt(value, `Request ${i} ` + "x".repeat(2000)),
      ],
    });
  }
  const context = { ...run(machineId, "context-only"), contentCapture: true };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry(context),
      prompt(
        context,
        "<environment_context>Private machine paths</environment_context>",
      ),
    ],
  });
  await makeNamesDue(t);
  const old = await owner.mutation(api.naming.claim, {});
  const work = old.find((c) => c.kind === "work");
  expect(work?.requests).toHaveLength(4);
  expect(work?.requests.every((r) => r.length === 1200)).toBe(true);
  await makeNamesDue(t); // Simulate expiration after a worker disappears.
  const renewed = await owner.mutation(api.naming.claim, {});
  expect(renewed.find((c) => c.key === old[0]?.key)?.claim).not.toBe(
    old[0]?.claim,
  );
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: old.map((c) => ({
        key: c.key,
        claim: c.claim,
        title: "Expired result",
      })),
    }),
  ).toBe(0);
  expect(
    await t.run(async (ctx) =>
      (await ctx.db.query("names").take(20)).some(
        (n) => n.targetId === context.id,
      ),
    ),
  ).toBe(false);
});
test("naming rejects a result when an enabled project's matching capture folder is removed", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const value = { ...run(), contentCapture: true };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(value), prompt(value)],
  });
  await makeNamesDue(t);
  const claims = await owner.mutation(api.naming.claim, {});
  expect(claims).toHaveLength(1);
  await t.run(async (ctx) => {
    const project = await ctx.db.query("projects").first();
    if (project)
      await ctx.db.patch(project._id, {
        folders: [{ machineId, path: "/different-folder" }],
      });
  });
  expect(
    await owner.mutation(api.naming.complete, {
      model: "gpt-6-luna",
      names: claims.map((c) => ({
        key: c.key,
        claim: c.claim,
        title: "Ineligible source",
      })),
    }),
  ).toBe(0);
});
test("scheduled history enrichment creates indexed, project-scoped filters and keeps machines distinct", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const historical = run(machineId, "historical");
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(historical), entry(run())],
  });
  const upgraded = { ...historical, automation: fixtureAutomation };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry(upgraded, 2),
      entry({
        ...run(machineId, "older"),
        startedAt: 500,
        automation: fixtureAutomation,
      }),
    ],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId: secondId,
    records: [
      entry({
        ...run(secondId, "other-machine"),
        automation: fixtureAutomation,
      }),
    ],
  });
  const foreignProject = "00000000-0000-4000-8000-000000000101";
  await t.run(async (ctx) => {
    await ctx.db.insert("projects", {
      projectId: foreignProject,
      name: "Other project",
      enabled: true,
      repositories: [],
      folders: [{ machineId, path: "/other" }],
    });
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry({
        ...run(machineId, "other-project"),
        cwd: "/other",
        projectId: foreignProject,
        automation: fixtureAutomation,
      }),
    ],
  });
  const taskKey = automationKey(upgraded);
  if (!taskKey) throw new Error("Missing fixture task key");
  const filters = [
    { dimension: "automation", value: taskKey },
    { dimension: "scheduled", value: "yes" },
  ];
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let pageNumber = 0; pageNumber < 10; pageNumber++) {
    const page: FunctionReturnType<typeof api.observatory.runs> =
      await owner.query(api.observatory.runs, {
        projectId,
        filters,
        paginationOpts: { numItems: 1, cursor },
      });
    ids.push(
      ...page.page.map((value) => runSchema.parse(JSON.parse(value)).id),
    );
    if (page.isDone) break;
    cursor = page.continueCursor;
  }
  expect(ids).toEqual([historical.id, run(machineId, "older").id]);
  const allScheduled = await owner.query(api.observatory.runs, {
    projectId,
    filters: [{ dimension: "scheduled", value: "yes" }],
    paginationOpts,
  });
  expect(allScheduled.page).toHaveLength(3);
  expect(
    allScheduled.page
      .map((raw) => runSchema.parse(JSON.parse(raw)).machineId)
      .sort(),
  ).toEqual([machineId, machineId, secondId]);
  const options = await owner.query(api.observatory.filterOptions, {
    projectId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  const choices = options.page.flatMap((value) =>
    filterOptionsSchema.parse(JSON.parse(value)),
  );
  const otherMachineKey = automationKey({ ...upgraded, machineId: secondId });
  if (!otherMachineKey) throw new Error("Missing other machine task key");
  expect(
    choices
      .filter((choice) => choice.dimension === "automation")
      .map((choice) => choice.value)
      .sort(),
  ).toEqual([taskKey, otherMachineKey].sort());
  expect(
    choices.find(
      (choice) => choice.dimension === "automation" && choice.value === taskKey,
    )?.label,
  ).toBe("Daily health scan · Fixture");
  await expect(
    t.query(api.observatory.runs, { filters, paginationOpts }),
  ).rejects.toThrow("Unauthorized");
  const persisted = await owner.query(api.observatory.run, {
    runId: historical.id,
    projectId,
  });
  expect(persisted ? runSchema.parse(JSON.parse(persisted)) : null).toEqual(
    upgraded,
  );
  const filtered = await owner.query(api.observatory.runs, {
    projectId,
    filters: [...filters, { dimension: "status", value: "failed" }],
    paginationOpts,
  });
  expect(filtered.page).toEqual([]);
});

test("automation facet changes replace prior task history rather than leaving stale matches", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const scheduled = { ...run(), automation: fixtureAutomation };
  const oldKey = automationKey(scheduled);
  if (!oldKey) throw new Error("Missing task identity");
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(scheduled)],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry(
        {
          ...scheduled,
          automation: { ...fixtureAutomation, id: "changed-task" },
        },
        2,
      ),
    ],
  });
  expect(
    (
      await owner.query(api.observatory.runs, {
        filters: [{ dimension: "automation", value: oldKey }],
        paginationOpts,
      })
    ).page,
  ).toEqual([]);
  const current = await owner.query(api.observatory.runs, {
    filters: [{ dimension: "scheduled", value: "yes" }],
    paginationOpts,
  });
  expect(
    current.page.map(
      (value) => runSchema.parse(JSON.parse(value)).automation?.id,
    ),
  ).toEqual(["changed-task"]);
});

test("every data query denies anonymous users and the wrong signed subject", async () => {
  const t = await setup();
  await expect(
    t.query(api.observatory.runs, { filters: [], paginationOpts }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.query(api.observatory.trace, { runId: run().id, paginationOpts }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t.query(api.observatory.capabilities, { paginationOpts }),
  ).rejects.toThrow("Unauthorized");
  await expect(t.query(api.observatory.machines, {})).rejects.toThrow(
    "Unauthorized",
  );
  await expect(
    t.query(api.observatory.filterOptions, {
      paginationOpts: { numItems: 50, cursor: null },
    }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t
      .withIdentity({ subject: "other@example.test" })
      .query(api.observatory.filterOptions, {
        paginationOpts: { numItems: 50, cursor: null },
      }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t
      .withIdentity({ subject: "other@example.test" })
      .query(api.observatory.run, { runId: run().id }),
  ).rejects.toThrow("Unauthorized");
});
test("filter choices span project history, paginate independently, and reflect updated metadata without exposing other projects", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const otherId = "00000000-0000-4000-8000-000000000101";
  await t.run(async (ctx) => {
    await ctx.db.insert("projects", {
      projectId: otherId,
      name: "Other",
      enabled: true,
      repositories: [],
      folders: [{ machineId, path: "/other" }],
    });
    const hidden = {
      ...run(machineId, "unregistered"),
      cwd: "/private",
      branch: "private-branch",
    };
    await ctx.db.insert("runs", {
      runId: hidden.id,
      machineId,
      revision: 1,
      startedAt: hidden.startedAt,
      status: hidden.status,
      data: JSON.stringify(hidden),
    });
  });
  const older: ReturnType<typeof run> = {
    ...run(machineId, "older"),
    startedAt: 100,
    branch: "older-branch",
    work: { id: "AST-142", label: "Checkout repair" },
    skills: [{ ...skill, kind: "workflow", name: "implement" }],
    tools: ["mcp__convex__query"],
  };
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(older), entry({ ...run(), branch: "current-branch" })],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry({
        ...run(machineId, "other"),
        cwd: "/other",
        projectId: otherId,
        branch: "other-branch",
      }),
    ],
  });
  const first = await owner.query(api.observatory.filterOptions, {
    projectId,
    paginationOpts: { numItems: 1, cursor: null },
  });
  const initial = first.page.flatMap((page) =>
    filterOptionsSchema.parse(JSON.parse(page)),
  );
  expect(initial).toContainEqual({
    dimension: "branch",
    value: "current-branch",
    label: "current-branch",
  });
  expect(initial.some((option) => option.value === "older-branch")).toBe(false);
  expect(first.isDone).toBe(false);
  const second = await owner.query(api.observatory.filterOptions, {
    projectId,
    paginationOpts: { numItems: 1, cursor: first.continueCursor },
  });
  const choices = mergeFilterOptions([
    ...initial,
    ...second.page.flatMap((page) =>
      filterOptionsSchema.parse(JSON.parse(page)),
    ),
  ]);
  expect(choices.filter((option) => option.dimension === "agent")).toHaveLength(
    1,
  );
  expect(choices).toContainEqual({
    dimension: "branch",
    value: "older-branch",
    label: "older-branch",
  });
  expect(choices).toContainEqual({
    dimension: "machine",
    value: machineId,
    label: `Fixture · ${machineId}`,
  });
  expect(choices).toContainEqual({
    dimension: "work",
    value: "AST-142",
    label: "Checkout repair · AST-142",
  });
  expect(choices).toContainEqual({
    dimension: "skill",
    value: "implement",
    label: "implement",
  });
  expect(choices).toContainEqual({
    dimension: "tool",
    value: "mcp__convex__query",
    label: "mcp__convex__query",
  });
  expect(
    choices.some(
      (option) =>
        option.value === "other-branch" || option.value === "private-branch",
    ),
  ).toBe(false);
  expect(JSON.stringify(choices)).not.toContain("Fixture turn");
  const all = await owner.query(api.observatory.filterOptions, {
    paginationOpts: { numItems: 50, cursor: null },
  });
  const allChoices = all.page.flatMap((page) =>
    filterOptionsSchema.parse(JSON.parse(page)),
  );
  expect(allChoices.some((option) => option.value === "other-branch")).toBe(
    true,
  );
  expect(allChoices.some((option) => option.value === "private-branch")).toBe(
    false,
  );
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry({ ...older, branch: "replacement-branch" }, 2)],
  });
  const updated = await owner.query(api.observatory.filterOptions, {
    projectId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  const updatedChoices = updated.page.flatMap((page) =>
    filterOptionsSchema.parse(JSON.parse(page)),
  );
  expect(updatedChoices.some((option) => option.value === "older-branch")).toBe(
    false,
  );
  expect(
    updatedChoices.some((option) => option.value === "replacement-branch"),
  ).toBe(true);
  expect(
    await owner.query(api.observatory.filterOptions, {
      projectId: "missing-project",
      paginationOpts: { numItems: 50, cursor: null },
    }),
  ).toMatchObject({ page: [], isDone: true });
  await expect(
    owner.query(api.observatory.filterOptions, { paginationOpts }),
  ).rejects.toThrow("Invalid page");
});
test("replay and stale revisions keep one logical run and one capability contribution", async () => {
  const t = await setup();
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry()],
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry(), entry({ ...run(), status: "failed" }, 1)],
  });
  const owner = t.withIdentity({
    subject: "00000000-0000-4000-8000-000000000010",
  });
  expect(
    (await owner.query(api.observatory.runs, { filters: [], paginationOpts }))
      .page,
  ).toHaveLength(1);
  let groups = await owner.query(api.observatory.capabilities, {
    paginationOpts,
  });
  expect(JSON.parse(groups.page[0] ?? "{}")).toMatchObject({
    runs: 1,
    problematic: 0,
  });
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry(
        {
          ...run(),
          findings: [
            {
              rule: "repeated_failure",
              severity: "warning",
              title: "Repeated command",
              evidence: [],
            },
          ],
        },
        2,
      ),
    ],
  });
  groups = await owner.query(api.observatory.capabilities, { paginationOpts });
  expect(JSON.parse(groups.page[0] ?? "{}")).toMatchObject({
    runs: 1,
    problematic: 1,
  });
});
test("two machines ingest independently; credentials cannot impersonate another machine or read", async () => {
  const t = await setup();
  const post = (id: string, value = run(id)) =>
    t.fetch("/agentlog/ingest", {
      method: "POST",
      headers: { authorization: `Bearer ${credential}` },
      body: JSON.stringify({
        schemaVersion: 1,
        machineId: id,
        records: [{ revision: 1, record: { kind: "run", value } }],
      }),
    });
  expect((await post(machineId)).status).toBe(200);
  expect((await post(secondId)).status).toBe(401);
  expect((await post(machineId, run(secondId))).status).toBe(400);
  expect(
    (
      await t.fetch("/auth/session", {
        method: "POST",
        headers: { authorization: `Bearer ${credential}` },
      })
    ).status,
  ).toBe(401);
  expect((await t.fetch("/auth/session")).status).toBe(401);
  expect((await t.fetch("/agentlog/ingest", { method: "POST" })).status).toBe(
    401,
  );
  const response = await t.fetch("/agentlog/ingest", {
    method: "POST",
    headers: { authorization: "Bearer second-ingestion-key" },
    body: JSON.stringify({
      schemaVersion: 1,
      machineId: secondId,
      records: [{ revision: 1, record: { kind: "run", value: run(secondId) } }],
    }),
  });
  expect(response.status).toBe(200);
  expect(
    await t
      .withIdentity({ subject: "00000000-0000-4000-8000-000000000010" })
      .query(api.observatory.machines, {}),
  ).toHaveLength(2);
});
test("version drill-down, combined filters and event pagination use stored evidence", async () => {
  const t = await setup();
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [
      entry(),
      entry(
        { ...run(machineId, "two"), skills: [{ ...skill, hash: "version2" }] },
        2,
      ),
    ],
  });
  const owner = t.withIdentity({
    subject: "00000000-0000-4000-8000-000000000010",
  });
  const page = await owner.query(api.observatory.runs, {
    filters: [
      { dimension: "capability", value: capabilityKey(skill) },
      { dimension: "outcome", value: "unknown" },
    ],
    paginationOpts,
  });
  expect(page.page).toHaveLength(1);
  for (let i = 0; i < 3; i++)
    await t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [
        {
          revision: i + 3,
          record: JSON.stringify({
            kind: "event",
            value: eventSchema.parse({
              id: `${run().id}:e${i}`,
              runId: run().id,
              sequence: i,
              kind: "shell_result",
              timestamp: null,
              observedAt: 3000,
              timing: "unavailable",
              title: "Shell result",
            }),
          }),
        },
      ],
    });
  const first = await owner.query(api.observatory.trace, {
    runId: run().id,
    paginationOpts: { numItems: 2, cursor: null },
  });
  const next = await owner.query(api.observatory.trace, {
    runId: run().id,
    paginationOpts: { numItems: 2, cursor: first.continueCursor },
  });
  expect(first.page.map((value) => JSON.parse(value).sequence)).toEqual([0, 1]);
  expect(next.page.map((value) => JSON.parse(value).sequence)).toEqual([2]);
});
test("invalid credential configuration fails closed", async () => {
  const t = await setup();
  process.env.AGENTLOG_MACHINES = "invalid-json";
  expect(await t.action(internal.auth.machine, { credential })).toBeNull();
  expect(await t.action(internal.auth.viewer, { credential: "wrong" })).toBe(
    false,
  );
});

test("project registration requires owner identity and machine policy reveals no telemetry", async () => {
  const t = await setup();
  const draft = {
    projectId: "00000000-0000-4000-8000-000000000101",
    name: "Second project",
    enabled: true,
    repositories: ["git@github.com:Team/Second.git"],
    folders: [],
  };
  await expect(
    t.mutation(api.projects.save, { project: draft }),
  ).rejects.toThrow("Unauthorized");
  await expect(
    t
      .withIdentity({ subject: "wrong" })
      .mutation(api.projects.save, { project: draft }),
  ).rejects.toThrow("Unauthorized");
  await expect(t.query(api.projects.list, {})).rejects.toThrow("Unauthorized");
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  await owner.mutation(api.projects.save, { project: draft });
  expect(
    (await owner.query(api.projects.list, {})).find(
      (p) => p.projectId === draft.projectId,
    )?.repositories,
  ).toEqual(["github.com/team/second"]);
  expect((await t.fetch("/agentlog/projects")).status).toBe(401);
  const response = await t.fetch("/agentlog/projects", {
    headers: { authorization: `Bearer ${credential}` },
  });
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  const policy = await response.json();
  expect(policy).toHaveLength(2);
  expect(policy[0].folders).toEqual([{ machineId, path: "/fixture" }]);
  expect(JSON.stringify(policy)).not.toContain("records");
});
test("unmatched/spoofed/orphan and paused-project uploads are denied while paused history stays readable", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  for (const value of [
    { ...run(), cwd: "/private" },
    { ...run(), projectId: "other-project" },
  ])
    await expect(
      t.mutation(internal.ingestion.ingest, {
        machineId,
        records: [entry(value)],
      }),
    ).rejects.toThrow("Project not enabled");
  const e = eventSchema.parse({
    id: `${run().id}:e`,
    runId: run().id,
    sequence: 0,
    kind: "user_prompt",
    timestamp: null,
    observedAt: 100,
    timing: "unavailable",
    title: "Prompt",
  });
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [
        { revision: 1, record: JSON.stringify({ kind: "event", value: e }) },
      ],
    }),
  ).rejects.toThrow("Project not enabled");
  await t.mutation(internal.ingestion.ingest, {
    machineId,
    records: [entry()],
  });
  const p = (await owner.query(api.projects.list, {}))[0];
  if (!p) throw new Error("Missing fixture project");
  await owner.mutation(api.projects.save, {
    project: { ...p, enabled: false },
  });
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [entry(run(), 2)],
    }),
  ).rejects.toThrow("Project not enabled");
  await expect(
    t.mutation(internal.ingestion.ingest, {
      machineId,
      records: [
        { revision: 2, record: JSON.stringify({ kind: "event", value: e }) },
      ],
    }),
  ).rejects.toThrow("Project not enabled");
  expect(
    (
      await owner.query(api.observatory.runs, {
        filters: [],
        projectId,
        paginationOpts,
      })
    ).page,
  ).toHaveLength(1);
  expect(
    await owner.query(api.observatory.run, {
      runId: run().id,
      projectId: "wrong",
    }),
  ).toBeNull();
  expect(
    (
      await owner.query(api.observatory.trace, {
        runId: run().id,
        projectId: "wrong",
        paginationOpts,
      })
    ).page,
  ).toEqual([]);
});
test("the owner cannot enroll the same repository twice using another transport", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  const p = (await owner.query(api.projects.list, {}))[0];
  if (!p) throw new Error("Missing fixture project");
  await owner.mutation(api.projects.save, {
    project: { ...p, repositories: ["git@github.com:Team/Repo.git"] },
  });
  await expect(
    owner.mutation(api.projects.save, {
      project: {
        ...p,
        projectId: "00000000-0000-4000-8000-000000000101",
        repositories: ["https://github.com/team/repo.git"],
      },
    }),
  ).rejects.toThrow("That repository is already enrolled");
  expect(await owner.query(api.projects.list, {})).toHaveLength(1);
});
test("bounded history migration excludes unmatched history and keeps project/global rollups correct across replay/reassignment", async () => {
  const t = await setup();
  const owner = t.withIdentity({ subject: process.env.OBSERVATORY_OWNER_ID });
  await t.run(async (ctx) => {
    for (const value of [
      run(),
      { ...run(machineId, "private"), cwd: "/private" },
    ])
      await ctx.db.insert("runs", {
        runId: value.id,
        machineId,
        revision: 1,
        startedAt: value.startedAt,
        status: value.status,
        data: JSON.stringify(value),
      });
  });
  expect(
    (await owner.query(api.observatory.runs, { filters: [], paginationOpts }))
      .page,
  ).toHaveLength(0);
  expect(
    await owner.query(api.observatory.run, { runId: run().id }),
  ).toBeNull();
  expect(
    (
      await t.mutation(internal.projects.migrate, {
        paginationOpts: { numItems: 2, cursor: null },
      })
    ).assigned,
  ).toBe(1);
  expect(
    (
      await t.mutation(internal.projects.migrate, {
        paginationOpts: { numItems: 2, cursor: null },
      })
    ).assigned,
  ).toBe(0);
  expect(
    (await owner.query(api.observatory.runs, { filters: [], paginationOpts }))
      .page,
  ).toHaveLength(1);
  expect(await t.run((ctx) => ctx.db.query("runs").take(3))).toHaveLength(2);
  expect(
    JSON.parse(
      (
        await owner.query(api.observatory.capabilities, {
          projectId,
          paginationOpts,
        })
      ).page[0] ?? "{}",
    ).runs,
  ).toBe(1);
  const p = (await owner.query(api.projects.list, {}))[0];
  if (!p) throw new Error("Missing fixture");
  await owner.mutation(api.projects.save, {
    project: { ...p, folders: [{ machineId, path: "/different" }] },
  });
  const otherId = "00000000-0000-4000-8000-000000000101";
  await owner.mutation(api.projects.save, {
    project: {
      ...p,
      projectId: otherId,
      name: "Other",
      folders: [{ machineId, path: "/fixture" }],
    },
  });
  await t.mutation(internal.projects.migrate, {
    paginationOpts: { numItems: 2, cursor: null },
  });
  expect(
    JSON.parse(
      (
        await owner.query(api.observatory.capabilities, {
          projectId: otherId,
          paginationOpts,
        })
      ).page[0] ?? "{}",
    ).runs,
  ).toBe(1);
  expect(
    JSON.parse(
      (
        await owner.query(api.observatory.capabilities, {
          projectId,
          paginationOpts,
        })
      ).page[0] ?? "{}",
    ).runs,
  ).toBe(0);
  expect(
    JSON.parse(
      (await owner.query(api.observatory.capabilities, { paginationOpts }))
        .page[0] ?? "{}",
    ).runs,
  ).toBe(1);
});
