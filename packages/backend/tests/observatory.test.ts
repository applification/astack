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

// Explicit module loaders work in Bun without a Vite-only import.meta.glob.
const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/observatory.ts": () => import("../convex/observatory"),
  "../convex/ingestion.ts": () => import("../convex/ingestion"),
  "../convex/auth.ts": () => import("../convex/auth"),
  "../convex/projects.ts": () => import("../convex/projects"),
  "../convex/http.ts": () => import("../convex/http"),
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
