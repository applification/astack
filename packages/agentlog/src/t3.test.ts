import { afterEach, expect, test } from "bun:test";
import {
  mkdtemp,
  rm,
  writeFile,
  mkdir,
  readFile,
  stat,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { createHash } from "node:crypto";
import { convexTest } from "convex-test";
import schema from "../../backend/convex/schema";
import { api } from "../../backend/convex/_generated/api";
import { filterOptionsSchema } from "@astack/agent-observability/filters";
import {
  configSchema,
  loadConfig,
  t3SourceSchema,
  type T3Source,
} from "./config";
import { LocalStore } from "./store";
import { persistSnapshot, collect, health } from "./collector";
import { envelopeSchema } from "@astack/agent-observability";
import { projectSchema } from "@astack/agent-observability/projects";
import {
  T3Adapter,
  normalizeT3Turn,
  t3ProjectionSchema,
  type T3ReadSource,
} from "./adapters/t3";
import { T3Reader } from "./adapters/t3-rpc";
import { configureT3 } from "./t3-config";
import {
  normalizeTurn,
  threadSchema,
  turnSchema,
  runIdentity,
} from "./adapters/codex";

const cleanup: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
const machineId = "00000000-0000-4000-8000-000000000001";
const environmentId = "00000000-0000-4000-8000-000000000002";
const projectId = "00000000-0000-4000-8000-000000000003";
const time = "2026-10-06T10:00:00.000Z";
const end = "2026-10-06T10:01:00.000Z";
const secret = "synthetic-private-t3-access-token";
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "agentlog-t3-"));
  cleanup.push(() => rm(dir, { recursive: true, force: true }));
  const source: T3Source = {
    url: "http://127.0.0.1:3773/",
    environmentId,
    tokenFile: join(dir, "t3.token"),
    label: "Fixture T3",
  };
  await writeFile(source.tokenFile, secret, { mode: 0o600 });
  const config = configSchema.parse({
    schemaVersion: 1,
    machineId,
    machineName: "Fixture",
    endpoint: "http://127.0.0.1:1/agentlog/ingest",
    tokenFile: join(dir, "ingest.token"),
    homes: [{ path: join(dir, "codex"), label: "native" }],
    t3Sources: [source],
    since: 0,
  });
  const store = new LocalStore(join(dir, "state"), [secret]);
  cleanup.push(() => store.close());
  const project = projectSchema.parse({
    projectId,
    name: "Fixture",
    enabled: true,
    repositories: [],
    folders: [{ machineId, path: dir }],
  });
  store.setMeta("projectPolicy", JSON.stringify([project]));
  return { dir, source, config, store, project };
}
function projection(driver = "claudeAgent", instance = "claude") {
  const native = (nativeId: string) => ({
    driver,
    nativeId,
    strength: "strong",
  });
  return {
    thread: { id: "app-thread", lineage: { parentThreadId: null } },
    runs: [
      {
        id: "app-run",
        modelSelection: {
          instanceId: instance,
          model: `${driver}-fixture-model`,
        },
        requestedAt: time,
        startedAt: time,
        completedAt: end,
        status: "completed",
      },
    ],
    attempts: [
      {
        id: "attempt",
        runId: "app-run",
        providerThreadId: "provider-thread",
        attemptOrdinal: 1,
      },
    ],
    providerThreads: [
      {
        id: "provider-thread",
        driver,
        providerInstanceId: instance,
        nativeThreadRef: native("native-session"),
      },
    ],
    providerTurns: [
      {
        id: "provider-turn",
        providerThreadId: "provider-thread",
        runAttemptId: "attempt",
        nativeTurnRef: native("native-turn"),
        ordinal: 1,
        startedAt: time,
        completedAt: end,
        status: "completed",
      },
    ],
    turnItems: [
      item("prompt", "user_message", {
        text: `Fix this ${secret}`,
        providerTurnId: null,
      }),
      item("reply", "assistant_message", { text: "Finished visible output" }),
      item("hidden", "reasoning", { text: "hidden-reasoning-fixture" }),
      item("secret", "secret_request", { label: "secret-request-fixture" }),
      item("command", "command_execution", {
        input: "bun test",
        output: `failure ${secret}`,
        exitCode: 1,
      }),
      item("mcp", "dynamic_tool", {
        toolName: "mcp__fixture__lookup",
        input: { key: secret },
        output: { isError: true, result: "fixture failure" },
      }),
      item("edit", "file_change", {
        fileName: "fixture.ts",
        diffStr: "+fixture",
      }),
      item("child", "subagent", {
        childThreadId: "child-thread",
        prompt: "inspect fixture",
        result: "fixture result",
      }),
    ],
  };
}
function item(id: string, type: string, extra: object = {}) {
  return {
    id,
    type,
    threadId: "app-thread",
    runId: "app-run",
    providerThreadId: "provider-thread",
    providerTurnId: "provider-turn",
    nativeItemRef: null,
    ordinal:
      ["prompt", "reply", "hidden", "command", "mcp", "edit", "child"].indexOf(
        id,
      ) + 1,
    status: "completed",
    startedAt: time,
    completedAt: end,
    updatedAt: end,
    ...extra,
  };
}
function shell(cwd: string) {
  const threads = [
    {
      id: "app-thread",
      projectId: "t3-project",
      worktreePath: null,
      branch: "fixture",
      updatedAt: end,
      status: "completed",
      latestRunId: "app-run",
      latestRunCompletedAt: end,
    },
  ];
  return {
    snapshotSequence: 1,
    projects: [{ id: "t3-project", workspaceRoot: cwd }],
    archivedThreads: threads.slice(0, 0),
    threads,
  };
}
async function snapshot(
  f: Awaited<ReturnType<typeof fixture>>,
  raw = projection(),
  captureContent = true,
) {
  const parsed = t3ProjectionSchema.parse(raw);
  const turn = parsed.providerTurns[0];
  if (!turn) throw new Error("missing fixture turn");
  return normalizeT3Turn({
    projection: parsed,
    turn,
    config: { ...f.config, captureContent },
    source: f.source,
    cwd: f.dir,
    projectId,
    store: f.store,
    signatureKey: "fixture-key",
    secrets: [secret],
    observedAt: Date.parse(end),
  });
}

test("Claude uses shared T3 records for readable redacted traces, failures, edits and subagents; reasoning stays absent", async () => {
  const f = await fixture();
  const result = await snapshot(f);
  expect(result?.run.agent).toBe("claude");
  expect(result?.run.model).toBe("claudeAgent-fixture-model");
  expect(result?.run.status).toBe("completed");
  expect(result?.run.outcome).toBe("unknown");
  expect(result?.events.map((e) => e.kind)).toEqual([
    "run_start",
    "user_prompt",
    "assistant_output",
    "test_run",
    "test_result",
    "mcp_call",
    "mcp_result",
    "file_edit",
    "subagent_result",
    "run_complete",
  ]);
  expect(result?.events.filter((e) => e.failed).map((e) => e.kind)).toEqual([
    "test_result",
    "mcp_result",
  ]);
  expect(JSON.stringify(result)).not.toContain(secret);
  expect(JSON.stringify(result)).not.toContain("hidden-reasoning-fixture");
  expect(JSON.stringify(result)).not.toContain("secret-request-fixture");
  expect(JSON.stringify(result?.run)).not.toContain("Fix this");
  if (!result) throw new Error("missing snapshot");
  persistSnapshot(f.store, result);
  expect(f.store.events(result.run.id)).toHaveLength(10);
});

test("metadata-only replay keeps stable identities and observations and removes readable T3 content", async () => {
  const f = await fixture();
  const readable = await snapshot(f);
  if (!readable) throw new Error("missing snapshot");
  persistSnapshot(f.store, readable);
  const withheld = await snapshot(f, projection(), false);
  if (!withheld) throw new Error("missing snapshot");
  withheld.events.forEach((event) => event.observedAt++);
  persistSnapshot(f.store, withheld);
  const events = f.store.events(readable.run.id);
  expect(events).toHaveLength(readable.events.length);
  expect(events.every((event) => event.observedAt === Date.parse(end))).toBe(
    true,
  );
  expect(JSON.stringify(events)).not.toContain("Finished visible output");
  expect(JSON.stringify(events)).not.toContain("inspect fixture");
  expect(events.find((e) => e.kind === "test_result")?.failed).toBe(true);
});

test("native Codex overlap preserves the first collector, annotations and event set in either capture order", async () => {
  const f = await fixture();
  const native = await normalizeTurn({
    thread: threadSchema.parse({
      id: "native-session",
      cwd: f.dir,
      source: "cli",
      cliVersion: "fixture",
      createdAt: Date.parse(time) / 1000,
      updatedAt: Date.parse(end) / 1000,
    }),
    turn: turnSchema.parse({
      id: "native-turn",
      status: "completed",
      startedAt: Date.parse(time) / 1000,
      completedAt: Date.parse(end) / 1000,
      items: [
        {
          id: "native-output",
          type: "agentMessage",
          text: "original native history",
        },
      ],
    }),
    machine: f.config,
    signatureKey: "fixture",
    observedAt: 1,
    projectId,
  });
  native.run.outcome = "success";
  native.run.work = { id: "AST-1" };
  persistSnapshot(f.store, native);
  expect(await snapshot(f, projection("codex", "codex"))).toBeNull();
  expect(f.store.runsForSession("native-session")[0]?.outcome).toBe("success");
  expect(f.store.runsForSession("native-session")[0]?.work?.id).toBe("AST-1");
  expect(f.store.events(native.run.id)).toHaveLength(native.events.length);
  const other = projection("codex", "codex");
  for (const turn of other.providerTurns)
    turn.nativeTurnRef.nativeId = "new-native-turn";
  const t3 = await snapshot(f, other);
  if (!t3) throw new Error("missing T3 Codex snapshot");
  expect(t3.run.id).toBe(
    runIdentity(machineId, "native-session", "new-native-turn"),
  );
  persistSnapshot(f.store, t3);
  const overlapping = structuredClone(native);
  overlapping.run.id = t3.run.id;
  overlapping.run.attemptId = "new-native-turn";
  overlapping.events.forEach((event) => {
    event.runId = t3.run.id;
    event.id = `${t3.run.id}:native-extra`;
  });
  persistSnapshot(f.store, overlapping);
  expect(f.store.events(t3.run.id)).toHaveLength(t3.events.length);
  expect(f.store.getRecord(`run:${t3.run.id}`)).toEqual({
    kind: "run",
    value: t3.run,
  });
});

test("multiple native turns, provider instances and providers stay distinct; weak Codex identities never produce provisional duplicates", async () => {
  const f = await fixture();
  const raw = projection("codex", "codex");
  const original = raw.providerTurns[0];
  if (!original) throw new Error("missing turn");
  const next = {
    ...original,
    id: "next-provider-turn",
    nativeTurnRef: { ...original.nativeTurnRef, nativeId: "next-native-turn" },
    ordinal: 2,
  };
  raw.providerTurns.push(next);
  const p = t3ProjectionSchema.parse(raw);
  const second = p.providerTurns[1];
  if (!second) throw new Error("missing second turn");
  const result = await normalizeT3Turn({
    projection: p,
    turn: second,
    config: f.config,
    source: f.source,
    cwd: f.dir,
    projectId,
    store: f.store,
    signatureKey: "fixture",
    secrets: [],
    observedAt: 1,
  });
  expect(result?.run.id).toBe(
    runIdentity(machineId, "native-session", "next-native-turn"),
  );
  expect(result?.events.some((e) => e.kind === "user_prompt")).toBe(false);
  const weak = projection("codex", "codex");
  for (const turn of weak.providerTurns) turn.nativeTurnRef.strength = "weak";
  expect(await snapshot(f, weak)).toBeNull();
  const claude1 = await snapshot(f, projection());
  const claude2 = await snapshot(
    f,
    projection("claudeAgent", "second-account"),
  );
  expect(claude1?.run.id).not.toBe(claude2?.run.id);
  expect(
    (await snapshot(f, projection("grok", "grok-account")))?.run.agent,
  ).toBe("grok");
});

test("Claude Read and Skill tools provide direct skill evidence; failed reads and automatic instructions do not", async () => {
  const f = await fixture();
  await mkdir(join(f.dir, "skill"));
  await writeFile(join(f.dir, "skill/SKILL.md"), "fixture skill");
  await writeFile(join(f.dir, "CLAUDE.md"), "fixture instruction");
  const raw = projection();
  raw.turnItems = [
    item("read-skill", "dynamic_tool", {
      ordinal: 1,
      toolName: "Read",
      input: { file_path: "skill/SKILL.md" },
      output: "fixture",
    }),
    item("read-instruction", "dynamic_tool", {
      ordinal: 2,
      toolName: "Read",
      input: { file_path: "CLAUDE.md" },
      output: "fixture",
    }),
    item("invoke", "dynamic_tool", {
      ordinal: 3,
      toolName: "Skill",
      input: { skill: "fixture:verify" },
      output: "fixture",
    }),
    item("failed-read", "dynamic_tool", {
      ordinal: 4,
      status: "failed",
      toolName: "Read",
      input: { file_path: "skill/SKILL.md" },
      output: "failed",
    }),
    item("errored-read", "dynamic_tool", {
      ordinal: 5,
      toolName: "Read",
      input: { file_path: "skill/SKILL.md" },
      output: { isError: true },
    }),
  ];
  const result = await snapshot(f, raw);
  expect(result?.run.skills.map((skill) => skill.name)).toEqual([
    "skill",
    join(f.dir, "CLAUDE.md"),
    "fixture:verify",
  ]);
  expect(result?.run.skills[0]?.hash).toHaveLength(64);
  expect(result?.run.skills[0]?.provenance).toBe("observation_time");
  expect(result?.run.skills[2]?.hash).toBeNull();
});

test("T3 matches enrollment before reading history, includes archives, and commits replay checkpoints only after persistence", async () => {
  const f = await fixture();
  const calls: string[] = [];
  const shellState = shell(f.dir);
  let archivedThreads = shellState.archivedThreads;
  const reader: T3ReadSource = {
    secrets: [],
    serverVersion: "fixture",
    initialize: async () => {
      calls.push("init");
    },
    shell: async () => shellState,
    archived: async () => ({ threads: archivedThreads }),
    thread: async (id) => {
      calls.push(id);
      return { projection: projection() };
    },
    item: async () => ({ item: null }),
    close: async () => {},
  };
  const adapter = new T3Adapter(
    f.config,
    f.source,
    f.store,
    "fixture",
    [],
    reader,
  );
  const drain = async () => {
    for await (const captured of adapter.collect())
      persistSnapshot(f.store, captured);
  };
  await drain();
  expect(calls).toEqual([]);
  adapter.setProjects([{ ...f.project, enabled: false }]);
  await drain();
  expect(calls).toEqual([]);
  adapter.setProjects([
    { ...f.project, folders: [{ machineId, path: `${f.dir}-unmatched` }] },
  ]);
  await drain();
  expect(calls).not.toContain("app-thread");
  adapter.setProjects([f.project]);
  const iterator = adapter.collect()[Symbol.asyncIterator]();
  const first = await iterator.next();
  expect(f.store.getMeta(`t3:${environmentId}:app-thread:updated`)).toBeNull();
  if (first.done) throw new Error("missing capture");
  persistSnapshot(f.store, first.value);
  await iterator.next();
  expect(
    f.store.getMeta(`t3:${environmentId}:app-thread:updated`),
  ).not.toBeNull();
  const count = calls.filter((id) => id === "app-thread").length;
  await drain();
  expect(calls.filter((id) => id === "app-thread")).toHaveLength(count);
  f.store.resetCaptureCheckpoints();
  archivedThreads = shellState.threads;
  shellState.threads = [];
  await drain();
  expect(f.store.runsForSession()).toHaveLength(1);
  expect(f.store.events(first.value.run.id)).toHaveLength(
    first.value.events.length,
  );
});

test("deferred Codex identities retry unchanged completed threads; omitted tool outputs use the full-item read", async () => {
  const f = await fixture();
  const raw = projection("codex", "codex");
  for (const turn of raw.providerTurns) turn.nativeTurnRef.strength = "weak";
  const calls: string[] = [];
  raw.turnItems = [
    item("omitted", "dynamic_tool", {
      toolName: "fixture-tool",
      input: {},
      outputOmitted: true,
    }),
  ];
  const fullItem = item("omitted", "dynamic_tool", {
    toolName: "fixture-tool",
    input: {},
    output: `restored output ${secret}`,
  });
  const reader: T3ReadSource = {
    secrets: [secret],
    serverVersion: "fixture",
    initialize: async () => {},
    shell: async () => shell(f.dir),
    archived: async () => ({ threads: [] }),
    thread: async () => ({ projection: raw }),
    item: async (threadId, itemId) => {
      calls.push(`${threadId}:${itemId}`);
      return { item: fullItem };
    },
    close: async () => {},
  };
  const adapter = new T3Adapter(
    f.config,
    f.source,
    f.store,
    "fixture",
    [],
    reader,
  );
  adapter.setProjects([f.project]);
  const drain = async () => {
    for await (const result of adapter.collect())
      persistSnapshot(f.store, result);
  };
  await drain();
  expect(adapter.deferredTurns).toBe(1);
  expect(f.store.runsForSession()).toHaveLength(0);
  expect(f.store.getMeta(`t3:${environmentId}:app-thread:updated`)).toBeNull();
  for (const turn of raw.providerTurns) turn.nativeTurnRef.strength = "strong";
  await drain();
  expect(adapter.deferredTurns).toBe(0);
  expect(f.store.runsForSession()).toHaveLength(1);
  expect(calls).toEqual(["app-thread:omitted", "app-thread:omitted"]);
  const run = f.store.runsForSession()[0];
  if (!run) throw new Error("missing captured run");
  expect(JSON.stringify(f.store.events(run.id))).toContain("restored output");
  expect(JSON.stringify(f.store.events(run.id))).not.toContain(secret);
});

test("an archived removed worktree can match T3's reported fork origin without inheriting upstream enrollment", async () => {
  const f = await fixture();
  const cwd = join(f.dir, "removed-worktree");
  let reads = 0;
  const reader: T3ReadSource = {
    secrets: [],
    serverVersion: "fixture",
    initialize: async () => {},
    shell: async () => ({
      ...shell(f.dir),
      threads: [],
      projects: [
        {
          id: "t3-project",
          workspaceRoot: f.dir,
          repositoryIdentity: {
            canonicalKey: "github.com/fixture/upstream",
            origin: { canonicalKey: "github.com/fixture/fork" },
          },
        },
      ],
    }),
    archived: async () => ({
      threads: shell(f.dir).threads.map((thread) => ({
        ...thread,
        worktreePath: cwd,
      })),
    }),
    thread: async () => {
      reads++;
      return { projection: projection() };
    },
    item: async () => ({ item: null }),
    close: async () => {},
  };
  const adapter = new T3Adapter(
    f.config,
    f.source,
    f.store,
    "fixture",
    [],
    reader,
  );
  adapter.setProjects([
    {
      ...f.project,
      repositories: ["github.com/fixture/upstream"],
      folders: [],
    },
  ]);
  for await (const result of adapter.collect())
    persistSnapshot(f.store, result);
  expect(reads).toBe(0);
  adapter.setProjects([
    { ...f.project, repositories: ["github.com/fixture/fork"], folders: [] },
  ]);
  for await (const result of adapter.collect())
    persistSnapshot(f.store, result);
  expect(reads).toBe(1);
  const run = f.store.runsForSession()[0];
  expect(run?.repo).toBe("github.com/fixture/fork");
  expect(run?.coverage).toContain(
    "Repository supplied by T3 project metadata; not a historical native origin.",
  );
});

async function transportFixture(f: Awaited<ReturnType<typeof fixture>>) {
  const calls: string[] = [];
  const server = Bun.serve<{ method?: string }>({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request, server) {
      const url = new URL(request.url);
      calls.push(`${request.method} ${url.pathname}`);
      if (url.pathname === "/.well-known/t3/environment")
        return Response.json({
          environmentId,
          orchestrationProtocolVersion: 2,
          serverVersion: "fixture",
        });
      if (url.pathname === "/oauth/token") {
        const form = new URLSearchParams(await request.text());
        expect(form.get("subject_token")).toBe("fixture-pairing-grant");
        expect(form.get("subject_token_type")).toBe(
          "urn:t3:params:oauth:token-type:environment-bootstrap",
        );
        expect(form.get("grant_type")).toBe(
          "urn:ietf:params:oauth:grant-type:token-exchange",
        );
        expect(form.get("scope")).toBe("orchestration:read");
        return Response.json({
          access_token: secret,
          token_type: "Bearer",
          expires_in: 3600,
          scope: "orchestration:read",
        });
      }
      if (url.pathname === "/ws") {
        if (
          url.searchParams.get("wsTicket") !== "one-use-fixture-ticket" ||
          url.searchParams.get("orchestrationProtocol") !== "2"
        )
          return new Response("denied", { status: 401 });
        if (server.upgrade(request, { data: {} })) return;
        return new Response("upgrade failed", { status: 400 });
      }
      if (request.headers.get("authorization") !== `Bearer ${secret}`)
        return new Response("private-error-body", { status: 401 });
      if (request.headers.get("x-t3-orchestration-protocol") !== "2")
        return new Response("protocol required", { status: 400 });
      if (url.pathname === "/api/auth/websocket-ticket")
        return Response.json({ ticket: "one-use-fixture-ticket" });
      if (url.pathname === "/api/orchestration/shell")
        return Response.json(shell(f.dir));
      if (url.pathname === "/api/orchestration/threads/app-thread")
        return Response.json({ projection: projection() });
      return new Response("missing", { status: 404 });
    },
    websocket: {
      message(socket, message) {
        const input = z
          .object({
            _tag: z.literal("Request"),
            id: z.string(),
            tag: z.enum([
              "orchestration.getArchivedShellSnapshot",
              "orchestration.getTurnItem",
            ]),
            payload: z.unknown(),
            headers: z.array(z.unknown()),
          })
          .parse(JSON.parse(String(message)));
        calls.push(input.tag);
        socket.send(
          JSON.stringify([
            {
              _tag: "Exit",
              requestId: input.id,
              exit: {
                _tag: "Success",
                value:
                  input.tag === "orchestration.getArchivedShellSnapshot"
                    ? { threads: [] }
                    : { item: null },
              },
            },
          ]),
        );
      },
    },
  });
  cleanup.push(() => {
    server.stop(true);
  });
  const source = { ...f.source, url: server.url.href };
  return { source, calls };
}

test("real HTTP/WebSocket reader uses only authenticated reads and pins environment identity before sending credentials", async () => {
  const f = await fixture();
  const { source, calls } = await transportFixture(f);
  const reader = new T3Reader(source);
  cleanup.push(() => reader.close());
  await reader.initialize();
  expect(await reader.shell()).toMatchObject({ snapshotSequence: 1 });
  expect(await reader.thread("app-thread")).toMatchObject({
    projection: { thread: { id: "app-thread" } },
  });
  expect(await reader.archived()).toEqual({ threads: [] });
  expect(await reader.item("app-thread", "tool")).toEqual({ item: null });
  expect(calls).toContain("orchestration.getArchivedShellSnapshot");
  expect(calls).toContain("orchestration.getTurnItem");
  const before = calls.length;
  const wrong = new T3Reader({ ...source, environmentId: projectId });
  await expect(wrong.initialize()).rejects.toThrow("t3_environment_mismatch");
  await wrong.close();
  expect(calls.slice(before)).toEqual(["GET /.well-known/t3/environment"]);
});

test("T3 rejects unsafe origins and exposed credential files, and discards private HTTP error bodies", async () => {
  const f = await fixture();
  for (const url of [
    "https://public.example/",
    "http://100.92.93.101/",
    "http://secret@localhost/",
    "http://localhost/?token=secret",
  ]) {
    expect(t3SourceSchema.safeParse({ ...f.source, url }).success).toBe(false);
  }
  const { source } = await transportFixture(f);
  await chmod(source.tokenFile, 0o644);
  const exposed = new T3Reader(source);
  await expect(exposed.initialize()).rejects.toThrow(
    "t3_credential_file_invalid",
  );
  await exposed.close();
  await chmod(source.tokenFile, 0o600);
  await writeFile(source.tokenFile, "wrong-fixture-token");
  const rejected = new T3Reader(source);
  cleanup.push(() => rejected.close());
  await rejected.initialize();
  await expect(rejected.shell()).rejects.toThrow("t3_http_401");
});

test("configuring T3 preserves native homes, credentials and capture settings and stores no token in config", async () => {
  const f = await fixture();
  const { source } = await transportFixture(f);
  await writeFile(
    join(f.dir, "config.json"),
    JSON.stringify({ ...f.config, t3Sources: [] }),
    { mode: 0o600 },
  );
  const state = new LocalStore(f.dir);
  state.setMeta("codex:fixture:false:updated", "keep-native-checkpoint");
  cleanup.push(() => state.close());
  const configured = await configureT3(f.dir, {
    url: source.url,
    label: "T3",
    credential: { kind: "access", path: source.tokenFile },
  });
  const next = await loadConfig(f.dir);
  expect(next.homes).toEqual(f.config.homes);
  expect(next.tokenFile).toBe(f.config.tokenFile);
  expect(next.captureContent).toBe(f.config.captureContent);
  expect(next.t3Sources).toEqual([configured]);
  expect(await readFile(join(f.dir, "config.json"), "utf8")).not.toContain(
    secret,
  );
  expect((await stat(join(f.dir, "config.json"))).mode & 0o077).toBe(0);
  expect(
    configSchema.parse({ ...f.config, t3Sources: undefined }).t3Sources,
  ).toEqual([]);
  expect(state.getMeta("codex:fixture:false:updated")).toBe(
    "keep-native-checkpoint",
  );
});

test("pairing exchange requests read-only access and saves the bearer privately without changing native capture", async () => {
  const f = await fixture();
  const { source } = await transportFixture(f);
  const pairingFile = join(f.dir, "pairing.token");
  await writeFile(pairingFile, "fixture-pairing-grant", { mode: 0o600 });
  await writeFile(
    join(f.dir, "config.json"),
    JSON.stringify({ ...f.config, t3Sources: [] }),
    { mode: 0o600 },
  );
  const configured = await configureT3(f.dir, {
    url: source.url,
    label: "T3",
    credential: { kind: "pairing", path: pairingFile },
  });
  expect(configured.tokenFile).toBe(join(f.dir, `t3-${environmentId}.token`));
  expect((await stat(configured.tokenFile)).mode & 0o077).toBe(0);
  expect((await readFile(configured.tokenFile, "utf8")).trim()).toBe(secret);
  expect((await loadConfig(f.dir)).homes).toEqual(f.config.homes);
});

test("the complete collector captures and forwards both sources; a T3 outage leaves native Codex working", async () => {
  const f = await fixture();
  const { source } = await transportFixture(f);
  const records: z.infer<typeof envelopeSchema>["records"] = [];
  const ownerId = "00000000-0000-4000-8000-000000000010";
  const ownerBefore = process.env.OBSERVATORY_OWNER_ID;
  const machinesBefore = process.env.AGENTLOG_MACHINES;
  process.env.OBSERVATORY_OWNER_ID = ownerId;
  process.env.AGENTLOG_MACHINES = JSON.stringify([
    {
      machineId,
      tokenHash: createHash("sha256")
        .update("fixture-ingest-token")
        .digest("hex"),
    },
  ]);
  cleanup.push(() => {
    if (ownerBefore === undefined) delete process.env.OBSERVATORY_OWNER_ID;
    else process.env.OBSERVATORY_OWNER_ID = ownerBefore;
    if (machinesBefore === undefined) delete process.env.AGENTLOG_MACHINES;
    else process.env.AGENTLOG_MACHINES = machinesBefore;
  });
  const convex = convexTest(schema, {
    "../../backend/convex/_generated/server.ts": () =>
      import("../../backend/convex/_generated/server"),
    "../../backend/convex/projects.ts": () =>
      import("../../backend/convex/projects"),
    "../../backend/convex/observatory.ts": () =>
      import("../../backend/convex/observatory"),
    "../../backend/convex/ingestion.ts": () =>
      import("../../backend/convex/ingestion"),
    "../../backend/convex/auth.ts": () => import("../../backend/convex/auth"),
    "../../backend/convex/http.ts": () => import("../../backend/convex/http"),
  });
  const owner = convex.withIdentity({ subject: ownerId });
  await owner.mutation(api.projects.save, { project: f.project });
  const backend = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(request) {
      const path = new URL(request.url).pathname;
      const body = request.method === "POST" ? await request.text() : undefined;
      if (body) records.push(...envelopeSchema.parse(JSON.parse(body)).records);
      return convex.fetch(path, {
        method: request.method,
        headers: request.headers,
        ...(body ? { body } : {}),
      });
    },
  });
  cleanup.push(() => {
    backend.stop(true);
  });
  await writeFile(f.config.tokenFile, "fixture-ingest-token", { mode: 0o600 });
  const nativeThread = {
    id: "native-session",
    cwd: f.dir,
    source: "cli",
    cliVersion: "fixture",
    createdAt: Date.parse(time) / 1000,
    updatedAt: Date.parse(end) / 1000,
  };
  const nativeTurn = {
    id: "native-turn",
    status: "completed",
    startedAt: Date.parse(time) / 1000,
    completedAt: Date.parse(end) / 1000,
    items: [
      {
        id: "native-output",
        type: "agentMessage",
        text: `native fixture ${secret}`,
      },
    ],
  };
  const binary = join(f.dir, "codex-fixture");
  await writeFile(
    binary,
    `#!/usr/bin/env bun
import { createInterface } from "node:readline";
const thread = ${JSON.stringify(nativeThread)};
const turn = ${JSON.stringify(nativeTurn)};
createInterface({ input: process.stdin }).on("line", line => {
  const message = JSON.parse(line);
  if (message.id === undefined) return;
  const result = message.method === "initialize" ? {} : message.method === "thread/list" ? { data: message.params.archived ? [] : [thread], nextCursor: null } : { data: [turn], nextCursor: null };
  process.stdout.write(JSON.stringify({ id: message.id, result }) + "\\n");
});
`,
    { mode: 0o700 },
  );
  const config = {
    ...f.config,
    codexBinary: binary,
    endpoint: new URL("/agentlog/ingest", backend.url).href,
    t3Sources: [source],
  };
  await writeFile(join(f.dir, "config.json"), JSON.stringify(config), {
    mode: 0o600,
  });
  const capture = async () => {
    // The same behavioral assertions can exercise the independently compiled CLI.
    const portable = process.env.AGENTLOG_PORTABLE_BINARY;
    if (!portable) return collect(f.dir, { once: true });
    const child = Bun.spawn([portable, "--state", f.dir, "collect", "--once"], {
      stdout: "pipe",
      stderr: "ignore",
    });
    const output = await new Response(child.stdout).text();
    expect(await child.exited).toBe(0);
    return z.object({ pending: z.number() }).parse(JSON.parse(output));
  };
  expect(await capture()).toEqual({ pending: 0 });
  const runRecords = records.flatMap((entry) =>
    entry.record.kind === "run" ? [entry.record.value] : [],
  );
  expect(runRecords.map((run) => run.agent).sort()).toEqual([
    "claude",
    "codex",
  ]);
  const page = await owner.query(api.observatory.runs, {
    projectId,
    filters: [{ dimension: "agent", value: "claude" }],
    paginationOpts: { numItems: 10, cursor: null },
  });
  expect(page.page).toHaveLength(1);
  const storedClaude = page.page[0];
  if (!storedClaude) throw new Error("missing stored Claude run");
  expect(JSON.parse(storedClaude).agent).toBe("claude");
  const choices = await owner.query(api.observatory.filterOptions, {
    projectId,
    paginationOpts: { numItems: 50, cursor: null },
  });
  expect(
    choices.page
      .flatMap((raw) => filterOptionsSchema.parse(JSON.parse(raw)))
      .filter((choice) => choice.dimension === "agent")
      .map((choice) => choice.value)
      .sort(),
  ).toEqual(["claude", "codex"]);
  expect(JSON.stringify(records)).not.toContain(secret);
  expect(health(f.dir, config).t3[0]?.health.status).toBe("ok");
  const unavailable = {
    ...config,
    t3Sources: [{ ...source, tokenFile: join(f.dir, "missing.token") }],
  };
  await writeFile(join(f.dir, "config.json"), JSON.stringify(unavailable), {
    mode: 0o600,
  });
  await capture();
  const status = health(f.dir, unavailable);
  expect(status.homes[0]?.health.status).toBe("ok");
  expect(status.t3[0]?.health.status).toBe("capture_error");
  expect(JSON.stringify(status)).not.toContain(secret);
});
