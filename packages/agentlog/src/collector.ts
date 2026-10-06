import { readFile, lstat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  runSchema,
  type AgentSnapshot,
  type AgentAdapter,
} from "@astack/agent-observability";
import { detectProblems } from "@astack/agent-observability/analysis";
import { environmentSecrets } from "@astack/agent-observability/redaction";
import { CodexAdapter } from "./adapters/codex";
import { LocalStore, forward } from "./store";
import { loadConfig, type CollectorConfig } from "./config";
import { syncProjects, cachedProjects } from "./projects";
import { resolveProject } from "@astack/agent-observability/projects";

async function readSecretFile(path: string) {
  const info = await lstat(path);
  if (!info.isFile() || info.size > 1024 * 1024)
    throw new Error("Invalid credential file");
  const value = (
    await readFile(path, {
      encoding: "utf8",
      signal: AbortSignal.timeout(1000),
    })
  ).trim();
  if (!value) throw new Error("Empty credential file");
  return value;
}

export function persistSnapshot(store: LocalStore, snapshot: AgentSnapshot) {
  for (const event of snapshot.events) {
    const previous = store.getRecord(`event:${event.id}`);
    if (event.skill && previous?.kind === "event" && previous.value.skill)
      event.skill = previous.value.skill;
    const hint = store.getMeta(
      `timing:${snapshot.run.sessionId}:${event.id.split(":").at(-2)}`,
    );
    if (
      hint &&
      [
        "shell_result",
        "test_result",
        "mcp_result",
        "tool_result",
        "file_edit",
      ].includes(event.kind)
    ) {
      event.timestamp = Number(hint);
      event.timing = "hook";
    }
    store.put({ kind: "event", value: event });
  }
  const events = store.events(snapshot.run.id);
  const previous = store.getRecord(`run:${snapshot.run.id}`);
  const run = snapshot.run;
  if (previous?.kind === "run") {
    if (!run.work && previous.value.work) run.work = previous.value.work;
    if (!run.projectId && previous.value.projectId)
      run.projectId = previous.value.projectId;
    run.outcome = previous.value.outcome;
    // A trusted Stop hook can supply completion before stored history catches up.
    if (
      run.status !== "failed" &&
      run.completedAt === null &&
      previous.value.completedAt !== null
    ) {
      run.completedAt = previous.value.completedAt;
      run.status = previous.value.status;
    }
  }
  run.skills = [
    ...new Map(
      events.flatMap((e) =>
        e.skill
          ? [
              [JSON.stringify(e.skill), e.skill] satisfies [
                string,
                NonNullable<typeof e.skill>,
              ],
            ]
          : [],
      ),
    ).values(),
  ].slice(0, 250);
  run.tools = [
    ...new Set(events.flatMap((e) => (e.tool ? [e.tool] : []))),
  ].slice(0, 250);
  run.eventCount = events.length;
  run.findings = detectProblems(run, events);
  store.put({ kind: "run", value: runSchema.parse(run) });
  if (
    resolveProject(cachedProjects(store), run)?.projectId === run.projectId &&
    run.projectId
  )
    store.requeueExcluded(run.id);
}

export async function collect(
  directory: string,
  options: { once?: boolean; signal?: AbortSignal } = {},
) {
  const config = await loadConfig(directory);
  const token = (await readFile(config.tokenFile, "utf8")).trim();
  if (!token) throw new Error("Missing ingestion credential");
  const secrets = [
    ...environmentSecrets(process.env),
    token,
    ...(await Promise.all(config.secretFiles.map(readSecretFile))),
  ];
  const store = new LocalStore(directory, secrets);
  const signatureKey =
    store.getMeta("signatureKey") ?? randomBytes(32).toString("hex");
  store.setMeta("signatureKey", signatureKey);
  const adapters: { home: string; adapter: CodexAdapter }[] = config.homes.map(
    (home) => ({
      home: home.path,
      adapter: new CodexAdapter(
        config,
        home.path,
        store,
        signatureKey,
        secrets,
      ),
    }),
  );
  let failureCount = 0;
  let retryAt = 0;
  try {
    do {
      const projects = await syncProjects(store, config, token);
      for (const entry of adapters) entry.adapter.setProjects(projects);
      for (const entry of adapters) {
        try {
          for await (const snapshot of entry.adapter.collect())
            persistSnapshot(store, snapshot);
          store.setMeta(
            `health:${entry.home}`,
            JSON.stringify({ status: "ok", at: Date.now() }),
          );
        } catch (error) {
          const diagnostic =
            error instanceof z.ZodError
              ? error.issues
                  .map((issue) => ({ code: issue.code, path: issue.path }))
                  .slice(0, 10)
              : error instanceof Error &&
                  /^codex_[a-z0-9_-]+$/.test(error.message)
                ? error.message
                : "capture_unavailable";
          store.setMeta(
            `health:${entry.home}`,
            JSON.stringify({
              status: "capture_error",
              at: Date.now(),
              diagnostic,
            }),
          );
          await entry.adapter.close();
          entry.adapter = new CodexAdapter(
            config,
            entry.home,
            store,
            signatureKey,
            secrets,
          );
        }
      }
      for (const run of store.runsForSession()) {
        if (!resolveProject(projects, run)) continue;
        if (run.completedAt !== null) continue;
        const findings = detectProblems(run, store.events(run.id));
        if (JSON.stringify(findings) !== JSON.stringify(run.findings))
          store.put({ kind: "run", value: { ...run, findings } });
      }
      if (Date.now() >= retryAt) {
        try {
          // Bound each flush so capturing other homes and shutdown remain responsive.
          for (let batches = 0; batches < 20 && store.pending(); batches++)
            await forward(store, config, token);
          failureCount = 0;
          retryAt = 0;
          store.setMeta(
            "forwardHealth",
            JSON.stringify({ status: "ok", at: Date.now() }),
          );
        } catch (error) {
          retryAt =
            Date.now() +
            Math.min(300_000, 1000 * 2 ** Math.min(++failureCount, 8)) +
            Math.random() * 1000;
          const diagnostic =
            error instanceof Error &&
            /^(ingestion_http_\d+|invalid_ingestion_ack)$/.test(error.message)
              ? error.message
              : "network_unavailable";
          store.setMeta(
            "forwardHealth",
            JSON.stringify({
              status: "offline",
              at: Date.now(),
              retryAt,
              diagnostic,
            }),
          );
        }
      }
      if (options.once) return { pending: store.pending() };
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          options.signal?.removeEventListener("abort", done);
          resolve();
        };
        const timer = setTimeout(done, config.pollSeconds * 1000);
        options.signal?.addEventListener("abort", done, { once: true });
        if (options.signal?.aborted) done();
      });
    } while (!options.signal?.aborted);
  } finally {
    await Promise.all(adapters.map((entry) => entry.adapter.close()));
    store.close();
  }
}

export function health(directory: string, config: CollectorConfig) {
  const store = new LocalStore(directory);
  try {
    return {
      machineId: config.machineId,
      machineName: config.machineName,
      contentCapture: config.captureContent,
      pending: store.pending(),
      projects: store.getMeta("projectHealth")
        ? JSON.parse(store.getMeta("projectHealth") ?? "{}")
        : null,
      forward: store.getMeta("forwardHealth")
        ? JSON.parse(store.getMeta("forwardHealth") ?? "{}")
        : null,
      homes: config.homes.map((home) => ({
        label: home.label,
        health: store.getMeta(`health:${home.path}`)
          ? JSON.parse(store.getMeta(`health:${home.path}`) ?? "{}")
          : null,
      })),
    };
  } finally {
    store.close();
  }
}
