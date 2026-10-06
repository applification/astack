import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  eventSchema,
  runSchema,
  type AgentSnapshot,
} from "@astack/agent-observability";
import { LocalStore, forward } from "./store";
import { normalizeTurn, threadSchema, turnSchema } from "./adapters/codex";
import { persistSnapshot } from "./collector";
import { linkSession } from "./context";
import { execFileSync } from "node:child_process";
import { capability } from "./adapters/codex";
import { initialize, loadConfig } from "./config";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function directory() {
  const path = await mkdtemp(join(tmpdir(), "agentlog-test-"));
  directories.push(path);
  return path;
}
const machineId = "00000000-0000-4000-8000-000000000001";
const event = () =>
  eventSchema.parse({
    id: `${machineId}:test:r:e`,
    runId: `${machineId}:test:r`,
    sequence: 0,
    kind: "shell_result",
    timestamp: null,
    observedAt: 100,
    timing: "unavailable",
    title: "Shell result",
    data: { output: "TOKEN=hiddenvalue sk-proj-thisisasecretapikey123456789" },
  });
test("offline restart retains only redacted records and retries after an HTTP failure", async () => {
  const dir = await directory();
  let store = new LocalStore(dir);
  store.put({ kind: "event", value: event() });
  store.close();
  store = new LocalStore(dir);
  expect(store.pending()).toBe(1);
  expect(JSON.stringify(store.getRecord(`event:${event().id}`))).not.toContain(
    "hiddenvalue",
  );
  let fail = true;
  let received = 0;
  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: async (request) => {
      const body = await request.json();
      received += body.records.length;
      return fail
        ? new Response("unavailable", { status: 503 })
        : Response.json({ schemaVersion: 1, accepted: body.records.length });
    },
  });
  try {
    const config = { machineId, endpoint: `http://127.0.0.1:${server.port}` };
    await expect(forward(store, config, "credential")).rejects.toThrow(
      "ingestion_http_503",
    );
    expect(store.pending()).toBe(1);
    fail = false;
    await forward(store, config, "credential");
    expect(store.pending()).toBe(0);
    expect(received).toBe(2);
  } finally {
    server.stop(true);
    store.close();
  }
});
test("acknowledging an in-flight old revision cannot lose a concurrent new update", async () => {
  const dir = await directory();
  const store = new LocalStore(dir);
  store.put({ kind: "event", value: event() });
  const batch = store.batch(machineId);
  expect(batch).not.toBeNull();
  store.put({ kind: "event", value: { ...event(), failed: true } });
  if (batch) store.acknowledge(batch.keys);
  expect(store.pending()).toBe(1);
  store.close();
});
test("unchanged event replay preserves its first observation time and stays deduplicated", async () => {
  const dir = await directory();
  const store = new LocalStore(dir);
  expect(store.put({ kind: "event", value: event() })).toBe(true);
  expect(
    store.put({ kind: "event", value: { ...event(), observedAt: 999 } }),
  ).toBe(false);
  expect(store.events(event().runId)).toHaveLength(1);
  store.close();
});
test("metadata-only Codex capture withholds content, identifies failed tests, and preserves missing timing", async () => {
  const thread = threadSchema.parse({
    id: "session",
    cwd: "/workspace",
    source: "vscode",
    cliVersion: "0.160.0",
    createdAt: 1,
    updatedAt: 2,
  });
  const turn = turnSchema.parse({
    id: "turn",
    status: "completed",
    startedAt: 1,
    completedAt: 2,
    items: [
      {
        id: "u",
        type: "userMessage",
        content: [{ type: "text", text: "A private prompt with secretword" }],
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `c${i}`,
        type: "commandExecution",
        command: "bun test --token secretword",
        status: "completed",
        exitCode: 1,
        aggregatedOutput: "private output",
        commandActions: [],
      })),
    ],
  });
  const snapshot = await normalizeTurn({
    thread,
    turn,
    machine: { machineId, machineName: "test", captureContent: false },
    signatureKey: "private-test-key",
    observedAt: 2500,
  });
  expect(JSON.stringify(snapshot)).not.toContain("secretword");
  expect(JSON.stringify(snapshot)).not.toContain("private output");
  expect(snapshot.run.findings.some((f) => f.rule === "failing_tests")).toBe(
    true,
  );
  expect(
    snapshot.events
      .filter((e) => e.kind === "test_result")
      .every((e) => e.timestamp === null),
  ).toBe(true);
  expect(snapshot.run.outcome).toBe("unknown");
  expect(snapshot.events.some((e) => e.kind === "intervention")).toBe(false);
});
test("a persisted interrupted turn with no completion timestamp is not called a failure", async () => {
  const snapshot = await normalizeTurn({
    thread: threadSchema.parse({
      id: "s",
      cwd: "/w",
      source: "appServer",
      cliVersion: "0.160.0",
      createdAt: 1,
      updatedAt: 2,
    }),
    turn: turnSchema.parse({
      id: "t",
      status: "interrupted",
      startedAt: 1,
      completedAt: null,
      items: [],
    }),
    machine: { machineId, machineName: "test", captureContent: false },
    signatureKey: "key",
    observedAt: 3000,
  });
  expect(snapshot.run.status).toBe("running");
  expect(snapshot.run.findings).toHaveLength(0);
});
test("snapshot updates without optional work context remain valid and preserve first-observed skill hash", async () => {
  const dir = await directory();
  const path = join(dir, "SKILL.md");
  await writeFile(path, "version one");
  const thread = threadSchema.parse({
    id: "s",
    cwd: dir,
    source: "vscode",
    cliVersion: "0.160.0",
    createdAt: 1,
    updatedAt: 2,
  });
  const turn = turnSchema.parse({
    id: "t",
    status: "completed",
    startedAt: 1,
    completedAt: 2,
    items: [
      {
        id: "read",
        type: "commandExecution",
        command: `cat ${path}`,
        status: "completed",
        exitCode: 0,
        commandActions: [{ type: "read", path }],
      },
    ],
  });
  const options = {
    thread,
    turn,
    machine: { machineId, machineName: "test", captureContent: false },
    signatureKey: "key",
    observedAt: 3000,
  };
  const store = new LocalStore(dir);
  const first = await normalizeTurn(options);
  persistSnapshot(store, first);
  const hash = first.run.skills[0]?.hash;
  await writeFile(path, "version two");
  persistSnapshot(store, await normalizeTurn({ ...options, observedAt: 4000 }));
  const record = store.getRecord(`run:${first.run.id}`);
  expect(record?.kind).toBe("run");
  if (record?.kind === "run") {
    expect(record.value.skills[0]?.hash).toBe(hash);
    expect(record.value).not.toHaveProperty("work");
    expect(record.value).not.toHaveProperty("projectId");
  }
  store.close();
});

test("work association updates completed runs immediately and survives later native snapshots", async () => {
  const dir = await directory();
  const store = new LocalStore(dir);
  const snapshot = await normalizeTurn({
    thread: threadSchema.parse({
      id: "session",
      cwd: dir,
      source: "vscode",
      cliVersion: "0.160.0",
      createdAt: 1,
      updatedAt: 2,
    }),
    turn: turnSchema.parse({
      id: "turn",
      status: "completed",
      startedAt: 1,
      completedAt: 2,
      items: [],
    }),
    machine: { machineId, machineName: "fixture", captureContent: false },
    signatureKey: "key",
    observedAt: 3000,
  });
  persistSnapshot(store, snapshot);
  linkSession(store, "session", {
    work: { id: "AST-fixture" },
    projectId: "project-fixture",
  });
  expect(store.runsForSession("session")[0]?.work?.id).toBe("AST-fixture");
  persistSnapshot(store, snapshot);
  expect(store.runsForSession("session")[0]?.projectId).toBe("project-fixture");
  store.close();
});

test("the JSON launch wrapper associates thread identity and preserves agent stdout and exit status", async () => {
  const dir = await directory();
  const executable = join(dir, "codex");
  await writeFile(
    executable,
    '#!/bin/sh\nprintf \'{"type":"thread.started","thread_id":"fixture-session"}\\n\'\nexit 3\n',
    { mode: 0o700 },
  );
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "cli.ts"),
      "--state",
      dir,
      "run",
      "--work",
      "AST-fixture",
      executable,
      "exec",
      "--json",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await child.exited).toBe(3);
  expect(await new Response(child.stdout).text()).toBe(
    '{"type":"thread.started","thread_id":"fixture-session"}\n',
  );
  const store = new LocalStore(dir);
  expect(JSON.parse(store.getMeta("context:fixture-session") ?? "{}")).toEqual({
    work: { id: "AST-fixture" },
  });
  store.close();
});

test("metadata record and network byte budgets retain events while preventing oversized batches", async () => {
  const dir = await directory();
  const store = new LocalStore(dir);
  const detail = Object.fromEntries(
    Array.from({ length: 90 }, (_, i) => [`detail${i}`, "x".repeat(1000)]),
  );
  for (let i = 0; i < 20; i++)
    store.put({
      kind: "event",
      value: { ...event(), id: `${event().runId}:large${i}`, data: detail },
    });
  const batch = store.batch(machineId);
  expect(batch).not.toBeNull();
  if (batch) {
    expect(Buffer.byteLength(JSON.stringify(batch.envelope))).toBeLessThan(
      900 * 1024,
    );
    expect(batch.keys.length).toBeLessThan(20);
  }
  store.put({
    kind: "event",
    value: {
      ...event(),
      id: `${event().runId}:oversize`,
      data: { many: Array.from({ length: 100 }, () => "x".repeat(8000)) },
    },
  });
  const record = store.getRecord(`event:${event().runId}:oversize`);
  expect(record?.kind).toBe("event");
  if (record?.kind === "event")
    expect(record.value.data).toHaveProperty("omitted");
  store.close();
});
test("legacy unknown turn times do not invent measured behavior in either capture mode", async () => {
  const options = {
    thread: threadSchema.parse({
      id: "s",
      cwd: "/fixture",
      source: "vscode",
      cliVersion: "0.160.0",
      createdAt: 1,
      updatedAt: 2,
    }),
    turn: turnSchema.parse({ id: "t", status: "interrupted", items: [] }),
    machine: { machineId, machineName: "fixture", captureContent: false },
    signatureKey: "key",
    observedAt: 7 * 3600_000,
  };
  const snapshot = await normalizeTurn(options);
  expect(snapshot.run.startTimeKnown).toBe(false);
  expect(snapshot.run.status).toBe("unknown");
  expect(snapshot.run.findings).toHaveLength(0);
  const withContent = await normalizeTurn({
    ...options,
    machine: { ...options.machine, captureContent: true },
  });
  expect(withContent.run.startTimeKnown).toBe(false);
  expect(withContent.run.status).toBe("unknown");
  expect(withContent.run.findings).toHaveLength(0);
});
test("readable content is redacted before queueing, and capture-mode replay replaces rather than duplicates events", async () => {
  const dir = await directory();
  const store = new LocalStore(dir, ["owner-private-value"]);
  const options = {
    thread: threadSchema.parse({
      id: "s",
      cwd: "/fixture",
      source: "appServer",
      cliVersion: "0.160.0",
      createdAt: 1,
      updatedAt: 2,
    }),
    turn: turnSchema.parse({
      id: "t",
      status: "completed",
      startedAt: 1,
      completedAt: 2,
      items: [
        {
          id: "u",
          type: "userMessage",
          content: [
            {
              type: "text",
              text: "Fix the checkout test; owner-private-value",
            },
          ],
        },
        {
          id: "a",
          type: "agentMessage",
          text: "The checkout assertion failed; I will inspect its fixture.",
        },
        {
          id: "c",
          type: "commandExecution",
          command: "bun test --token flag-secret",
          aggregatedOutput:
            'Expected 200, received 500. {"apiKey":"json-secret"} HOME=/private/env',
          exitCode: 1,
          status: "completed",
        },
        {
          id: "m",
          type: "mcpToolCall",
          server: "fixture",
          tool: "inspect",
          status: "completed",
          arguments: {
            query: "checkout",
            password: "nested-secret",
            env: { HOME: "env-secret" },
          },
          result: {
            content: [
              {
                type: "text",
                text: 'Missing fixture. {"refresh_token":"refresh-secret"}',
              },
            ],
          },
        },
        {
          id: "d",
          type: "dynamicToolCall",
          tool: "lookup",
          status: "completed",
          arguments: { query: "fixture" },
        },
        {
          id: "f",
          type: "functionCallOutput",
          name: "lookup",
          output: "Fixture entry is absent.",
        },
        {
          id: "r",
          type: "reasoning",
          text: "hidden-reasoning-must-stay-omitted",
        },
      ],
    }),
    machine: { machineId, machineName: "fixture", captureContent: false },
    signatureKey: "key",
    knownSecrets: ["owner-private-value"],
    observedAt: 3000,
  };
  const metadata = await normalizeTurn(options);
  persistSnapshot(store, metadata);
  const readable = await normalizeTurn({
    ...options,
    machine: { ...options.machine, captureContent: true },
    observedAt: 4000,
  });
  persistSnapshot(store, readable);
  expect(store.events(readable.run.id)).toHaveLength(metadata.events.length);
  expect(
    store.events(readable.run.id).find((e) => e.kind === "user_prompt")
      ?.observedAt,
  ).toBe(3000);
  const serialized = JSON.stringify(store.batch(machineId)?.envelope);
  for (const secret of [
    "owner-private-value",
    "flag-secret",
    "json-secret",
    "/private/env",
    "nested-secret",
    "env-secret",
    "refresh-secret",
    "hidden-reasoning-must-stay-omitted",
  ])
    expect(serialized).not.toContain(secret);
  for (const useful of [
    "Fix the checkout test",
    "Expected 200, received 500",
    "Missing fixture",
    "Fixture entry is absent",
    "bun test",
    "[REDACTED]",
  ])
    expect(serialized).toContain(useful);
  expect(readable.run.title).toBe(metadata.run.title);
  expect(readable.run.contentCapture).toBe(true);
  persistSnapshot(store, await normalizeTurn({ ...options, observedAt: 5000 }));
  const withheld = JSON.stringify(store.batch(machineId)?.envelope);
  expect(withheld).not.toContain("Fix the checkout test");
  expect(withheld).not.toContain("Expected 200");
  expect(withheld).toContain("[WITHHELD]");
  store.close();
});
test("new collectors default to readable content and the content command can disable capture and replay history", async () => {
  const dir = await directory();
  const config = await initialize(dir, {
    endpoint: "http://127.0.0.1:1234",
    tokenFile: join(dir, "fake-token"),
  });
  expect(config.captureContent).toBe(true);
  const store = new LocalStore(dir);
  store.setMeta("codex:fixture:false:updated", "1000");
  store.close();
  const child = Bun.spawn(
    [
      process.execPath,
      join(import.meta.dir, "cli.ts"),
      "--state",
      dir,
      "content",
      "off",
    ],
    { stdout: "pipe", stderr: "pipe" },
  );
  expect(await child.exited).toBe(0);
  expect((await loadConfig(dir)).captureContent).toBe(false);
  const updated = new LocalStore(dir);
  expect(updated.getMeta("codex:fixture:false:updated")).toBeNull();
  updated.close();
});
test("special skill files cannot block hashing or capture", async () => {
  const dir = await directory();
  const path = join(dir, "SKILL.md");
  execFileSync("mkfifo", [path]);
  const result = await Promise.race([
    capability(path, dir, "read", "observation_time"),
    new Promise<never>((_resolve, reject) =>
      setTimeout(() => reject(new Error("hash blocked")), 1500),
    ),
  ]);
  expect(result?.hash).toBeNull();
  expect(result?.name).toBeTruthy();
});
