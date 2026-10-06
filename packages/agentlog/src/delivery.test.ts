import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  envelopeSchema,
  eventSchema,
  runSchema,
} from "@astack/agent-observability";
import { projectSchema } from "@astack/agent-observability/projects";
import { LocalStore } from "./store";
import { drainQueue } from "./delivery";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const machineId = "00000000-0000-4000-8000-000000000001";
const project = projectSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000100",
  name: "Fixture",
  enabled: true,
  repositories: [],
  folders: [{ machineId, path: "/fixture" }],
});
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "agentlog-delivery-"));
  directories.push(dir);
  const store = new LocalStore(dir);
  store.setMeta("projectPolicy", JSON.stringify([project]));
  return store;
}
function capture(
  store: LocalStore,
  id: string,
  startedAt: number,
  eventCount: number,
) {
  for (let i = 0; i < eventCount; i++)
    store.put({
      kind: "event",
      value: eventSchema.parse({
        id: `${id}:${i}`,
        runId: id,
        sequence: i,
        kind: "assistant_output",
        title: "Fixture output",
        observedAt: startedAt,
        timestamp: null,
        timing: "unavailable",
        data: { content: "Fixture text" },
      }),
    });
  store.put({
    kind: "run",
    value: runSchema.parse({
      id,
      machineId,
      machineName: "Fixture",
      agent: "codex",
      sessionId: id,
      attemptId: "turn",
      source: "cli",
      cwd: "/fixture",
      projectId: project.projectId,
      title: "Fixture",
      startedAt,
      completedAt: null,
      status: "running",
      lastObservedAt: startedAt,
      skills: [],
      tools: [],
      findings: [],
      eventCount,
      contentCapture: true,
      coverage: [],
    }),
  });
}

test("a current conversation uploads its details before a historical backlog", async () => {
  const store = await fixture();
  try {
    capture(store, "historical", 100, 200);
    capture(store, "current", 200, 10);
    const batch = store.batch(machineId);
    expect(batch).not.toBeNull();
    const records = batch?.envelope.records.map((entry) => entry.record) ?? [];
    expect(
      records.filter((r) => r.kind === "event" && r.value.runId === "current"),
    ).toHaveLength(10);
    expect(records[0]?.value.id).toBe("current");
  } finally {
    store.close();
  }
});

async function until(check: () => boolean, timeout = 5000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() >= deadline) throw new Error("delivery_condition_timeout");
    await Bun.sleep(10);
  }
}

test("continuous recent traffic still gives historical records every fourth batch", async () => {
  const store = await fixture();
  capture(store, "historical", 100, 200);
  capture(store, "current", 200, 1000);
  const batches: string[][] = [];
  const controller = new AbortController();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const body = envelopeSchema.parse(await request.json());
      batches.push(
        body.records
          .filter((e) => e.record.kind === "event")
          .map((e) => (e.record.kind === "event" ? e.record.value.runId : "")),
      );
      return Response.json({ schemaVersion: 1, accepted: body.records.length });
    },
  });
  const draining = drainQueue(
    store,
    { machineId, endpoint: `http://127.0.0.1:${server.port}` },
    "fixture",
    { signal: controller.signal },
  );
  try {
    await until(() => batches.length >= 4);
    expect(batches.slice(0, 3).flat()).not.toContain("historical");
    expect(batches[3]).toContain("historical");
    expect(store.pending()).toBeGreaterThan(0);
  } finally {
    controller.abort();
    await draining;
    server.stop(true);
    store.close();
  }
});

test("background delivery drains beyond twenty batches and retains captures made during an HTTP wait", async () => {
  const store = await fixture();
  capture(store, "historical", 100, 1050);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  const received = new Set<string>();
  const controller = new AbortController();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const body = envelopeSchema.parse(await request.json());
      requests++;
      if (requests === 1) await held;
      for (const entry of body.records) received.add(entry.record.value.id);
      return Response.json({ schemaVersion: 1, accepted: body.records.length });
    },
  });
  const draining = drainQueue(
    store,
    { machineId, endpoint: `http://127.0.0.1:${server.port}` },
    "fixture",
    { signal: controller.signal },
  );
  try {
    await until(() => requests === 1);
    capture(store, "current", 200, 10);
    expect(store.events("current")).toHaveLength(10);
    expect(received.size).toBe(0);
    release();
    await until(() => store.pending() === 0);
    expect(requests).toBeGreaterThan(20);
    expect(received.size).toBe(1062);
    expect(received.has("current:9")).toBe(true);
  } finally {
    release();
    controller.abort();
    await draining;
    server.stop(true);
    store.close();
  }
});

test("shutdown cancels an in-flight upload without acknowledging queued revisions", async () => {
  const store = await fixture();
  capture(store, "current", 200, 10);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let received = false;
  const controller = new AbortController();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async () => {
      received = true;
      await held;
      return Response.json({ schemaVersion: 1, accepted: 11 });
    },
  });
  const draining = drainQueue(
    store,
    { machineId, endpoint: `http://127.0.0.1:${server.port}` },
    "fixture",
    { signal: controller.signal },
  );
  try {
    await until(() => received);
    controller.abort();
    await draining;
    expect(store.pending()).toBe(11);
    expect(store.events("current")).toHaveLength(10);
  } finally {
    release();
    controller.abort();
    await draining;
    server.stop(true);
    store.close();
  }
});

test("failed background uploads retain revisions, retry and continue capturing", async () => {
  const store = await fixture();
  capture(store, "historical", 100, 10);
  let requests = 0;
  const controller = new AbortController();
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const body = envelopeSchema.parse(await request.json());
      return ++requests === 1
        ? new Response("offline", { status: 503 })
        : Response.json({ schemaVersion: 1, accepted: body.records.length });
    },
  });
  const draining = drainQueue(
    store,
    { machineId, endpoint: `http://127.0.0.1:${server.port}` },
    "fixture",
    { signal: controller.signal },
  );
  try {
    await until(
      () =>
        JSON.parse(store.getMeta("forwardHealth") ?? "{}").status === "offline",
    );
    expect(store.pending()).toBe(11);
    capture(store, "current", 200, 10);
    expect(store.pending()).toBe(22);
    await until(() => store.pending() === 0);
    expect(JSON.parse(store.getMeta("forwardHealth") ?? "{}").status).toBe(
      "ok",
    );
    expect(requests).toBeGreaterThan(1);
  } finally {
    controller.abort();
    await draining;
    server.stop(true);
    store.close();
  }
}, 10_000);
