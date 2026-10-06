import { afterEach, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { convexTest } from "convex-test";
import { runSchema, type AgentSnapshot } from "@astack/agent-observability";
import { projectSchema } from "@astack/agent-observability/projects";
import schema from "../../backend/convex/schema";
import { api } from "../../backend/convex/_generated/api";
import { CodexAdapter, threadSchema } from "./adapters/codex";
import { configSchema, initialize } from "./config";
import { persistSnapshot } from "./collector";
import { localRepository } from "./git";
import { captureHook } from "./hooks";
import { LocalStore, forward } from "./store";

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
async function directory() {
  const dir = await mkdtemp(join(tmpdir(), "agentlog-worktree-"));
  directories.push(dir);
  return dir;
}
function git(args: string[]) {
  return execFileSync(
    "git",
    ["-c", "core.hooksPath=/dev/null", "-c", "commit.gpgSign=false", ...args],
    {
      encoding: "utf8",
      env: {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            ([key]) => !key.startsWith("GIT_"),
          ),
        ),
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  ).trim();
}
async function repository(
  remote = "https://fixture-token@github.com/fixture/worktree.git",
) {
  const dir = await directory();
  const main = join(dir, "main");
  git(["init", "--quiet", main]);
  git([
    "-C",
    main,
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.test",
    "commit",
    "--quiet",
    "--allow-empty",
    "-m",
    "Fixture",
  ]);
  git(["-C", main, "config", "--local", "remote.origin.url", remote]);
  const worktree = join(dir, `conversation-${crypto.randomUUID()}`);
  git(["-C", main, "worktree", "add", "--quiet", "--detach", worktree, "HEAD"]);
  return { dir, main, worktree };
}
const machineId = "00000000-0000-4000-8000-000000000001";
const project = projectSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000100",
  name: "Fixture",
  enabled: true,
  repositories: ["github.com/fixture/worktree"],
  folders: [],
});

test("new detached worktrees and subfolders resolve through shared Git config without credentials or stale caches", async () => {
  const { main, worktree } = await repository();
  const child = join(worktree, "nested");
  await mkdir(child);
  expect(await localRepository(main)).toBe("github.com/fixture/worktree");
  expect(await localRepository(worktree)).toBe("github.com/fixture/worktree");
  expect(await localRepository(child)).toBe("github.com/fixture/worktree");
  git([
    "-C",
    main,
    "config",
    "--local",
    "remote.origin.url",
    "git@github.com:Fixture/Changed.git",
  ]);
  expect(await localRepository(worktree)).toBe("github.com/fixture/changed");
  git(["-C", main, "config", "--local", "extensions.worktreeConfig", "true"]);
  git([
    "-C",
    worktree,
    "config",
    "--worktree",
    "remote.origin.url",
    "https://github.com/fixture/override.git",
  ]);
  expect(await localRepository(worktree)).toBe("github.com/fixture/override");
});

test("missing/invalid origins and inherited Git overrides cannot turn an unrelated folder into an enrolled repo", async () => {
  const { dir, main, worktree } = await repository();
  const unrelated = await directory();
  const global = join(dir, "fake-global");
  await writeFile(
    global,
    '[remote "origin"]\nurl = https://github.com/fixture/worktree.git\n',
  );
  const originalDir = process.env.GIT_DIR;
  const originalGlobal = process.env.GIT_CONFIG_GLOBAL;
  try {
    process.env.GIT_DIR = join(main, ".git");
    process.env.GIT_CONFIG_GLOBAL = global;
    expect(await localRepository(unrelated)).toBeNull();
    expect(await localRepository(worktree)).toBe("github.com/fixture/worktree");
  } finally {
    if (originalDir === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = originalDir;
    if (originalGlobal === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = originalGlobal;
  }
  git(["-C", main, "config", "--local", "--unset", "remote.origin.url"]);
  git(["-C", main, "config", "--local", "include.path", global]);
  expect(await localRepository(worktree)).toBeNull();
  git([
    "-C",
    main,
    "config",
    "--local",
    "remote.origin.url",
    "file:///private/repo",
  ]);
  expect(await localRepository(worktree)).toBeNull();
  expect(await localRepository(join(dir, "gone"))).toBeNull();
  expect(await localRepository("relative/path")).toBeNull();
});

test("a blocking Git config is killed within the lookup budget", async () => {
  const { main } = await repository();
  const config = join(main, ".git", "config");
  await rm(config);
  execFileSync("mkfifo", [config]);
  const start = Date.now();
  expect(await localRepository(main)).toBeNull();
  expect(Date.now() - start).toBeLessThan(2500);
});

test("missing metadata in an unlisted worktree captures before full turns, forwards through native Convex and preserves native conflicts", async () => {
  const { dir, worktree } = await repository();
  const unrelated = await repository(
    "https://github.com/fixture/unregistered.git",
  );
  const missing = join(dir, "deleted-worktree");
  const thread = threadSchema.parse({
    id: "fallback",
    cwd: worktree,
    source: "cli",
    cliVersion: "fixture",
    createdAt: 1,
    updatedAt: 100,
  });
  const threads = [
    thread,
    { ...thread, id: "unregistered", cwd: unrelated.worktree },
    { ...thread, id: "gone", cwd: missing },
    {
      ...thread,
      id: "native-conflict",
      gitInfo: { originUrl: "https://github.com/fixture/unregistered.git" },
    },
    {
      ...thread,
      id: "native",
      cwd: missing,
      gitInfo: { originUrl: "git@github.com:fixture/worktree.git" },
    },
  ];
  const reads: string[] = [];
  const reader = {
    initialize: async () => {},
    close: async () => {},
    request: async (method: string, raw: unknown) => {
      if (method === "thread/list") {
        const args = z.object({ archived: z.boolean() }).parse(raw);
        return { data: args.archived ? [] : threads, nextCursor: null };
      }
      if (method === "thread/turns/list") {
        const args = z.object({ threadId: z.string() }).parse(raw);
        reads.push(args.threadId);
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
      }
      throw new Error("Unexpected source operation");
    },
  };
  const config = configSchema.parse({
    schemaVersion: 1,
    machineId,
    machineName: "Fixture",
    endpoint: "http://127.0.0.1:1234",
    tokenFile: "/unused",
    homes: [{ path: dir, label: "fixture" }],
    since: 0,
  });
  const store = new LocalStore(dir);
  const adapter = new CodexAdapter(config, dir, store, "fixture", [], reader);
  const capture = async () => {
    const snapshots: AgentSnapshot[] = [];
    for await (const snapshot of adapter.collect()) snapshots.push(snapshot);
    return snapshots;
  };
  let server: ReturnType<typeof Bun.serve> | undefined;
  const ownerId = "00000000-0000-4000-8000-000000000010";
  const credential = "fixture-machine-key";
  const originalOwner = process.env.OBSERVATORY_OWNER_ID;
  const originalMachines = process.env.AGENTLOG_MACHINES;
  try {
    expect(await capture()).toEqual([]);
    adapter.setProjects([project]);
    store.setMeta("projectPolicy", JSON.stringify([project]));
    const snapshots = await capture();
    expect(reads).toEqual(["fallback", "native"]);
    expect(snapshots[0]?.run.repo).toBe("github.com/fixture/worktree");
    expect(snapshots[0]?.run.coverage).toContain(
      "Repository resolved from local Git at capture time; native origin unavailable.",
    );
    expect(snapshots[1]?.run.repo).toBe("git@github.com:fixture/worktree.git");
    for (const snapshot of snapshots) persistSnapshot(store, snapshot);
    expect(JSON.stringify(store.batch(machineId))).not.toContain(
      "fixture-token",
    );
    adapter.setProjects([{ ...project, enabled: false }]);
    expect(await capture()).toEqual([]);
    expect(reads).toEqual(["fallback", "native"]);

    process.env.OBSERVATORY_OWNER_ID = ownerId;
    process.env.AGENTLOG_MACHINES = JSON.stringify([
      {
        machineId,
        tokenHash: createHash("sha256").update(credential).digest("hex"),
      },
    ]);
    const backend = convexTest(schema, {
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
    const owner = backend.withIdentity({ subject: ownerId });
    await owner.mutation(api.projects.save, { project });
    server = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      fetch: async (request) =>
        backend.fetch("/agentlog/ingest", {
          method: "POST",
          headers: request.headers,
          body: await request.text(),
        }),
    });
    await forward(
      store,
      { machineId, endpoint: `http://127.0.0.1:${server.port}` },
      credential,
    );
    expect(store.pending()).toBe(0);
    const page = await owner.query(api.observatory.runs, {
      projectId: project.projectId,
      filters: [],
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(2);
    const recovered = page.page
      .map((raw) => runSchema.parse(JSON.parse(raw)))
      .find((r) => r.sessionId === "fallback");
    expect(recovered?.repo).toBe("github.com/fixture/worktree");
    expect(recovered?.projectId).toBe(project.projectId);
  } finally {
    server?.stop(true);
    await adapter.close();
    store.close();
    if (originalOwner === undefined) delete process.env.OBSERVATORY_OWNER_ID;
    else process.env.OBSERVATORY_OWNER_ID = originalOwner;
    if (originalMachines === undefined) delete process.env.AGENTLOG_MACHINES;
    else process.env.AGENTLOG_MACHINES = originalMachines;
  }
});

test("an early trusted hook can match an unlisted worktree before its first native snapshot", async () => {
  const { dir, worktree } = await repository();
  const state = join(dir, "state");
  const tokenFile = join(dir, "token");
  await writeFile(tokenFile, "fixture-key");
  await initialize(state, { endpoint: "http://127.0.0.1:1234", tokenFile });
  const config = configSchema.parse(
    JSON.parse(await Bun.file(join(state, "config.json")).text()),
  );
  const policy = { ...project, folders: [] };
  const setup = new LocalStore(state);
  setup.setMeta("projectPolicy", JSON.stringify([policy]));
  setup.close();
  await captureHook(state, {
    session_id: "early",
    turn_id: "turn",
    cwd: worktree,
    hook_event_name: "Interrupt",
  });
  const store = new LocalStore(state);
  try {
    expect(store.events(`${config.machineId}:codex:early:turn`)).toHaveLength(
      1,
    );
    expect(JSON.parse(store.getMeta("context:early") ?? "{}").projectId).toBe(
      project.projectId,
    );
    store.setMeta(
      "projectPolicy",
      JSON.stringify([{ ...policy, enabled: false }]),
    );
  } finally {
    store.close();
  }
  await captureHook(state, {
    session_id: "paused",
    turn_id: "turn",
    cwd: worktree,
    hook_event_name: "Interrupt",
  });
  const paused = new LocalStore(state);
  try {
    expect(paused.getMeta("context:paused")).toBeNull();
    expect(paused.events(`${config.machineId}:codex:paused:turn`)).toEqual([]);
  } finally {
    paused.close();
  }
});
