import { afterEach, expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdtemp, mkdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  normalizeTurn,
  threadSchema,
  turnSchema,
  CodexAdapter,
} from "./adapters/codex";
import { CodexAutomations } from "./adapters/codex-automations";
import { configSchema } from "./config";
import { LocalStore } from "./store";
import { persistSnapshot } from "./collector";
import type { AgentSnapshot } from "@astack/agent-observability";
import { z } from "zod";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((path) => rm(path, { recursive: true, force: true })),
  );
});
async function home() {
  const path = await mkdtemp(join(tmpdir(), "agentlog-automations-"));
  directories.push(path);
  return path;
}
async function desktop(home: string) {
  await mkdir(join(home, "sqlite"));
  const db = new Database(join(home, "sqlite", "codex-dev.db"));
  db.exec(
    "CREATE TABLE automations (id TEXT PRIMARY KEY, name TEXT, status TEXT, rrule TEXT, next_run_at INTEGER); CREATE TABLE automation_runs (thread_id TEXT PRIMARY KEY, automation_id TEXT);",
  );
  db.query("INSERT INTO automations VALUES (?, ?, ?, ?, ?)").run(
    "daily-check",
    "Daily check",
    "ACTIVE",
    "FREQ=DAILY;BYHOUR=9;BYMINUTE=0",
    9000,
  );
  db.query("INSERT INTO automation_runs VALUES (?, ?)").run(
    "scheduled-session",
    "daily-check",
  );
  db.query("INSERT INTO automation_runs VALUES (?, ?)").run(
    "deleted-session",
    "deleted-task",
  );
  return db;
}
const machineId = "00000000-0000-4000-8000-000000000001";
const thread = () =>
  threadSchema.parse({
    id: "scheduled-session",
    cwd: "/fixture",
    source: "vscode",
    originator: "Codex Desktop",
    threadSource: "automation",
    cliVersion: "fixture",
    createdAt: 1,
    updatedAt: 100,
  });
const turn = () =>
  turnSchema.parse({
    id: "turn",
    status: "completed",
    startedAt: 1,
    completedAt: 2,
    items: [
      {
        id: "prompt",
        type: "userMessage",
        content: [
          {
            type: "text",
            text: "Automation: Daily check\nAutomation ID: daily-check\nRead the private report.",
          },
        ],
      },
    ],
  });
const options = () => ({
  thread: thread(),
  turn: turn(),
  machine: { machineId, machineName: "Fixture", captureContent: false },
  signatureKey: "fixture",
  observedAt: 3000,
});

test("structured automation capture works without prompt content and ordinary quoted headers are not classified", async () => {
  const scheduled = await normalizeTurn(options());
  expect(scheduled.run.automation).toEqual({
    provider: "codex",
    id: null,
    name: null,
    schedule: null,
  });
  expect(JSON.stringify(scheduled.events)).not.toContain(
    "Read the private report",
  );
  const ordinary = await normalizeTurn({
    ...options(),
    thread: { ...thread(), threadSource: undefined },
  });
  expect(ordinary.run.automation).toBeUndefined();
  expect(
    ordinary.events.find((event) => event.kind === "user_prompt")?.data.content,
  ).toBe("[WITHHELD]");
});

test("read-only desktop records enrich tasks and deleted definitions retain the task identity", async () => {
  const path = await home();
  const db = await desktop(path);
  const reader = new CodexAutomations(path);
  const automation = reader.lookup("scheduled-session", 3000);
  expect(automation).toEqual({
    provider: "codex",
    id: "daily-check",
    name: "Daily check",
    schedule: {
      description: "Daily · 09:00",
      state: "active",
      nextRunAt: 9000,
      observedAt: 3000,
    },
  });
  expect(reader.lookup("deleted-session", 3000)).toEqual({
    provider: "codex",
    id: "deleted-task",
    name: null,
    schedule: null,
  });
  expect(reader.lookup("ordinary-session", 3000)).toBeUndefined();
  db.query(
    "UPDATE automations SET status = ?, next_run_at = NULL WHERE id = ?",
  ).run("PAUSED", "daily-check");
  expect(reader.lookup("scheduled-session", 4000)?.schedule).toMatchObject({
    state: "paused",
    nextRunAt: null,
  });
  db.query("UPDATE automations SET next_run_at = -1 WHERE id = ?").run(
    "daily-check",
  );
  expect(reader.lookup("scheduled-session", 5000)).toEqual({
    provider: "codex",
    id: "daily-check",
    name: "Daily check",
    schedule: null,
  });
  const captured = await normalizeTurn({
    ...options(),
    automation,
    knownSecrets: ["Daily check"],
  });
  expect(captured.run.automation?.name).toBe("[REDACTED]");
  const store = new LocalStore(join(path, "queue"));
  persistSnapshot(store, captured);
  const retained = store.getRecord(`run:${captured.run.id}`);
  expect(
    retained?.kind === "run"
      ? retained.value.automation?.schedule?.description
      : null,
  ).toBe("Daily · 09:00");
  store.close();
  reader.close();
  expect(
    db.query("SELECT status FROM automations WHERE id = ?").get("daily-check"),
  ).toEqual({ status: "PAUSED" });
  db.close();
});

test("missing and incompatible desktop databases leave native automation detection usable without creating files", async () => {
  const path = await home();
  const missing = new CodexAutomations(path);
  expect(missing.lookup("scheduled-session", 1000)).toBeUndefined();
  missing.close();
  expect(
    await stat(join(path, "sqlite", "codex-dev.db")).catch(() => null),
  ).toBeNull();
  await mkdir(join(path, "sqlite"));
  const db = new Database(join(path, "sqlite", "codex-dev.db"));
  db.exec("CREATE TABLE unrelated (id TEXT)");
  db.close();
  const incompatible = new CodexAutomations(path);
  const captured = await normalizeTurn({
    ...options(),
    automation: incompatible.lookup(thread().id, 1000),
  });
  expect(captured.run.automation?.provider).toBe("codex");
  incompatible.close();
});

test("collector upgrades replay retained automation history once and preserve run outcomes and trace identities", async () => {
  const path = await home();
  const db = await desktop(path);
  db.close();
  const store = new LocalStore(join(path, "queue"));
  const config = configSchema.parse({
    machineId,
    machineName: "Fixture",
    endpoint: "http://127.0.0.1:1",
    tokenFile: "/unused",
    homes: [{ path, label: "fixture" }],
    schemaVersion: 1,
    since: 0,
    captureContent: false,
  });
  const original = await normalizeTurn({
    ...options(),
    thread: { ...thread(), threadSource: undefined },
  });
  original.run.outcome = "success";
  persistSnapshot(store, original);
  store.setMeta(`codex:${path}:false:updated`, "1000");
  store.setMeta(`codex:${path}:true:updated`, "1000");
  const reader = {
    initialize: async () => {},
    close: async () => {},
    request: async (method: string, raw: unknown) => {
      if (method === "thread/list")
        return {
          data: z.object({ archived: z.boolean() }).parse(raw).archived
            ? []
            : [{ ...thread(), id: "recent-session", updatedAt: 900 }, thread()],
          nextCursor: null,
        };
      if (method === "thread/turns/list")
        return { data: [turn()], nextCursor: null };
      throw new Error("Unexpected operation");
    },
  };
  const adapter = new CodexAdapter(config, path, store, "fixture", [], reader);
  adapter.setProjects([
    {
      projectId: "fixture-project",
      name: "Fixture",
      enabled: true,
      repositories: [],
      folders: [{ machineId, path: "/fixture" }],
    },
  ]);
  const capture = async () => {
    const runs: AgentSnapshot[] = [];
    for await (const snapshot of adapter.collect()) {
      persistSnapshot(store, snapshot);
      runs.push(snapshot);
    }
    return runs;
  };
  expect((await capture()).map((snapshot) => snapshot.run.sessionId)).toEqual([
    "recent-session",
    "scheduled-session",
  ]);
  const enriched = store.getRecord(`run:${original.run.id}`);
  if (enriched?.kind !== "run") throw new Error("Missing replayed run");
  expect(enriched.value.automation?.id).toBe("daily-check");
  expect(enriched.value.outcome).toBe("success");
  expect(store.events(original.run.id).map((event) => event.id)).toEqual(
    original.events.map((event) => event.id),
  );
  expect((await capture()).map((snapshot) => snapshot.run.sessionId)).toEqual([
    "recent-session",
  ]);
  // A less complete provider view must not erase captured task metadata.
  persistSnapshot(store, {
    ...original,
    run: {
      ...original.run,
      source: "t3:fixture",
      automation: { provider: "codex", id: null, name: null, schedule: null },
    },
  });
  const overlap = store.getRecord(`run:${original.run.id}`);
  expect(overlap?.kind === "run" ? overlap.value.automation?.id : null).toBe(
    "daily-check",
  );
  await adapter.close();
  store.close();
});
