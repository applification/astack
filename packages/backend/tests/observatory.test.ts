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

// Explicit module loaders work in Bun without a Vite-only import.meta.glob.
const modules = {
  "../convex/_generated/server.ts": () => import("../convex/_generated/server"),
  "../convex/observatory.ts": () => import("../convex/observatory"),
  "../convex/ingestion.ts": () => import("../convex/ingestion"),
  "../convex/auth.ts": () => import("../convex/auth"),
  "../convex/http.ts": () => import("../convex/http"),
};
const machineId = "00000000-0000-4000-8000-000000000001";
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
  const t = convexTest(schema, modules);
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
    t
      .withIdentity({ subject: "other@example.test" })
      .query(api.observatory.run, { runId: run().id }),
  ).rejects.toThrow("Unauthorized");
});
test("replay and stale revisions keep one logical run and one capability contribution", async () => {
  const t = convexTest(schema, modules);
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
  const t = convexTest(schema, modules);
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
  const t = convexTest(schema, modules);
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
  const t = convexTest(schema, modules);
  process.env.AGENTLOG_MACHINES = "invalid-json";
  expect(await t.action(internal.auth.machine, { credential })).toBeNull();
  expect(await t.action(internal.auth.viewer, { credential: "wrong" })).toBe(
    false,
  );
});
