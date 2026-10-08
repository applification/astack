import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  CodexAdapter,
  resolveCodexConversation,
  threadSchema,
  normalizeTurn,
  turnSchema,
} from "./adapters/codex";
import { runConversation } from "@astack/agent-observability/conversations";
import { configSchema } from "./config";
import { LocalStore } from "./store";
import { projectSchema } from "@astack/agent-observability/projects";
import { z } from "zod";

const thread = (id: string, parentThreadId: string | null = null) =>
  threadSchema.parse({
    id,
    parentThreadId,
    cwd: "/fixture",
    source: parentThreadId ? { subAgent: "review" } : "cli",
    cliVersion: "fixture",
    createdAt: 1,
    updatedAt: 10,
  });
test("native ancestry resolves nested children and keeps forks, missing parents and cycles distinct", async () => {
  const root = thread("root");
  const child = {
    ...thread("child", "root"),
    forkedFromId: "unrelated-history",
  };
  const nested = thread("nested", "child");
  const metadata = new Map([root, child].map((value) => [value.id, value]));
  const resolve = (value: ReturnType<typeof thread>) =>
    resolveCodexConversation(value, async (id) => metadata.get(id) ?? null);
  expect(await resolve(nested)).toMatchObject({
    self: { sessionId: "nested" },
    root: { sessionId: "root" },
    parent: { reference: { sessionId: "child" }, relationship: "subagent" },
  });
  const fork = { ...thread("fork"), forkedFromId: "root" };
  metadata.set("fork", fork);
  expect(await resolve(thread("fork-child", "fork"))).toMatchObject({
    root: { sessionId: "fork" },
  });
  expect(await resolve(fork)).toMatchObject({
    root: { sessionId: "fork" },
    parent: { relationship: "fork" },
  });
  expect(await resolve(thread("missing-child", "missing"))).toBeNull();
  metadata.set("child", thread("child", "nested"));
  metadata.set("nested", nested);
  expect(await resolve(nested)).toBeNull();
  expect(
    await resolve({
      ...thread("ambiguous"),
      parentThreadId: undefined,
      source: { subAgent: "review" },
    }),
  ).toBeNull();
});

test("unavailable native ancestry survives originator normalization without manufacturing a root", async () => {
  const snapshot = await normalizeTurn({
    thread: {
      ...thread("unavailable"),
      parentThreadId: undefined,
      source: { subAgent: "review" },
      originator: "codex_cli_rs",
    },
    turn: turnSchema.parse({
      id: "turn",
      status: "completed",
      startedAt: 1,
      completedAt: 2,
      items: [],
    }),
    machine: {
      machineId: "00000000-0000-4000-8000-000000000001",
      machineName: "Synthetic",
      captureContent: true,
    },
    signatureKey: "fixture",
    observedAt: 2000,
  });
  expect(snapshot.run.source).toBe("codex_cli_rs");
  expect(snapshot.run.conversation).toBeNull();
  expect(runConversation(snapshot.run)).toBeNull();
});

test("native capture replays historical ancestry using metadata only and stops at project boundaries", async () => {
  const dir = await mkdtemp(join(tmpdir(), "native-conversations-"));
  const store = new LocalStore(dir);
  try {
    const machineId = "00000000-0000-4000-8000-000000000001";
    const config = configSchema.parse({
      schemaVersion: 1,
      machineId,
      machineName: "Synthetic",
      endpoint: "http://127.0.0.1:1234",
      tokenFile: "/unused",
      homes: [{ path: dir, label: "fixture" }],
      since: 0,
    });
    const project = projectSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000100",
      name: "Synthetic",
      enabled: true,
      folders: [{ machineId, path: "/fixture" }],
      repositories: [],
    });
    let root = thread("root");
    const child = thread("child", "root");
    const nested = thread("nested", "child");
    const reads: { method: string; id: string; includeTurns?: boolean }[] = [];
    const reader = {
      initialize: async () => {},
      close: async () => {},
      request: async (method: string, input: unknown) => {
        if (method === "thread/list") {
          const args = z.object({ archived: z.boolean() }).parse(input);
          return { data: args.archived ? [] : [nested], nextCursor: null };
        }
        const args = z
          .object({
            threadId: z.string(),
            includeTurns: z.boolean().optional(),
          })
          .parse(input);
        reads.push({
          method,
          id: args.threadId,
          ...(args.includeTurns === undefined
            ? {}
            : { includeTurns: args.includeTurns }),
        });
        if (method === "thread/read")
          return { thread: args.threadId === "root" ? root : child };
        if (method === "thread/turns/list")
          return {
            data: [
              {
                id: "turn",
                status: "completed",
                startedAt: 1,
                completedAt: 2,
                items: [],
              },
            ],
            nextCursor: null,
          };
        throw new Error("Unexpected native operation");
      },
    };
    store.setMeta(`codex:${dir}:automation-capture-version`, "1");
    store.setMeta(`codex:${dir}:conversation-capture-version`, "1");
    store.setMeta(`codex:${dir}:false:updated`, "1000");
    const adapter = new CodexAdapter(config, dir, store, "fixture", [], reader);
    adapter.setProjects([project]);
    const capture = async () => {
      const runs = [];
      for await (const snapshot of adapter.collect()) runs.push(snapshot.run);
      return runs;
    };
    const first = await capture();
    expect(first[0]?.conversation?.root).toEqual({
      kind: "codex",
      sessionId: "root",
    });
    expect(first[0]?.sessionReferences).not.toContainEqual({
      kind: "codex",
      sessionId: "root",
    });
    expect(reads).toEqual([
      { method: "thread/read", id: "child", includeTurns: false },
      { method: "thread/read", id: "root", includeTurns: false },
      { method: "thread/turns/list", id: "nested" },
    ]);
    expect(store.getMeta(`codex:${dir}:conversation-capture-version`)).toBe(
      "2",
    );
    store.setMeta(`codex:${dir}:false:updated`, "1000");
    expect(await capture()).toEqual([]);
    root = { ...root, cwd: "/private" };
    store.setMeta(`codex:${dir}:false:updated`, "0");
    const foreign = await capture();
    expect(foreign[0]?.conversation).toBeNull();
    expect(
      foreign[0]?.coverage.some((value) =>
        value.includes("ancestry unavailable"),
      ),
    ).toBe(true);
    expect(
      reads
        .filter((value) => value.method === "thread/turns/list")
        .map((value) => value.id),
    ).toEqual(["nested", "nested"]);
    await adapter.close();
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("completed native children recover late ancestry after the activity checkpoint advances and the adapter restarts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "native-ancestry-retry-"));
  const store = new LocalStore(dir);
  try {
    const machineId = "00000000-0000-4000-8000-000000000001";
    const config = configSchema.parse({
      schemaVersion: 1,
      machineId,
      machineName: "Synthetic",
      endpoint: "http://127.0.0.1:1234",
      tokenFile: "/unused",
      homes: [{ path: dir, label: "fixture" }],
      since: 0,
    });
    const project = projectSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000100",
      name: "Synthetic",
      enabled: true,
      folders: [{ machineId, path: "/fixture" }],
      repositories: [],
    });
    const child = { ...thread("child", "root"), updatedAt: 100 };
    const newer = { ...thread("newer"), updatedAt: 200 };
    const root = { ...thread("root"), updatedAt: 300 };
    let available = false;
    const reads: { method: string; id: string; includeTurns?: boolean }[] = [];
    const reader = {
      initialize: async () => {},
      close: async () => {},
      request: async (method: string, input: unknown) => {
        if (method === "thread/list") {
          const args = z.object({ archived: z.boolean() }).parse(input);
          return {
            data: args.archived
              ? []
              : available
                ? [root, newer, child]
                : [newer, child],
            nextCursor: null,
          };
        }
        const args = z
          .object({
            threadId: z.string(),
            includeTurns: z.boolean().optional(),
          })
          .parse(input);
        reads.push({
          method,
          id: args.threadId,
          ...(args.includeTurns === undefined
            ? {}
            : { includeTurns: args.includeTurns }),
        });
        if (method === "thread/read") {
          if (args.threadId === "root" && !available)
            throw new Error("Metadata not available yet");
          return { thread: args.threadId === "child" ? child : root };
        }
        if (method === "thread/turns/list")
          return {
            data: [
              {
                id: "turn",
                status: "completed",
                startedAt: 1,
                completedAt: 2,
                items: [],
              },
            ],
            nextCursor: null,
          };
        throw new Error("Unexpected native operation");
      },
    };
    const createAdapter = () => {
      const adapter = new CodexAdapter(
        config,
        dir,
        store,
        "fixture",
        [],
        reader,
      );
      adapter.setProjects([project]);
      return adapter;
    };
    const collect = async (adapter: CodexAdapter) => {
      const runs = [];
      for await (const snapshot of adapter.collect()) runs.push(snapshot.run);
      return runs;
    };
    const adapter = createAdapter();
    const first = await collect(adapter);
    expect(
      first.find((run) => run.sessionId === "child")?.conversation,
    ).toBeNull();
    expect(store.getMeta(`codex:${dir}:false:updated`)).toBe("200");
    expect(
      JSON.parse(store.getMeta(`codex:${dir}:conversation-pending`) ?? "[]"),
    ).toEqual(["child"]);
    reads.length = 0;
    await collect(adapter);
    expect(reads).toContainEqual({
      method: "thread/read",
      id: "child",
      includeTurns: false,
    });
    expect(
      reads.some(
        (read) => read.method === "thread/turns/list" && read.id === "child",
      ),
    ).toBe(false);
    await adapter.close();
    available = true;
    const restarted = createAdapter();
    const recovered = await collect(restarted);
    expect(recovered.filter((run) => run.sessionId === "child")).toHaveLength(
      1,
    );
    expect(
      recovered.find((run) => run.sessionId === "child")?.conversation?.root,
    ).toEqual({ kind: "codex", sessionId: "root" });
    expect(
      JSON.parse(store.getMeta(`codex:${dir}:conversation-pending`) ?? "[]"),
    ).toEqual([]);
    expect(store.getMeta(`codex:${dir}:false:updated`)).toBe("300");
    await restarted.close();
  } finally {
    store.close();
    await rm(dir, { recursive: true, force: true });
  }
});
