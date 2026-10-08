import { readFile, lstat } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import {
  eventCapabilities,
  runSchema,
  type AgentSnapshot,
  type AgentAdapter,
} from "@astack/agent-observability";
import { detectProblems } from "@astack/agent-observability/analysis";
import { environmentSecrets } from "@astack/agent-observability/redaction";
import { CodexAdapter } from "./adapters/codex";
import { T3Adapter } from "./adapters/t3";
import { readT3Credential } from "./adapters/t3-rpc";
import { LocalStore } from "./store";
import { drainQueue } from "./delivery";
import { loadConfig, type CollectorConfig } from "./config";
import { syncProjects, cachedProjects } from "./projects";
import { publishEvaluationTasks } from "./evaluation-tasks";
import { resolveProject } from "@astack/agent-observability/projects";
import {
  mergeDelegations,
  mergeSessionReferences,
} from "@astack/agent-observability/delegation";
import type { Project } from "@astack/agent-observability/projects";
import { mergeAutomation } from "@astack/agent-observability/automations";
import { mergeConversations } from "@astack/agent-observability/conversations";
import {
  isHostObservation,
  observationAnchorKey,
} from "./adapters/t3-observations";

type CaptureAdapter = AgentAdapter & {
  setProjects(projects: readonly Project[]): void;
  readonly deferredTurns?: number;
};

export async function readSecretFile(path: string) {
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
  const owner = store.getRecord(`run:${snapshot.run.id}`);
  function persistObservation(event: AgentSnapshot["events"][number]) {
    store.put({ kind: "event", value: event });
    if (event.delegationResult) {
      const key = observationAnchorKey(event.delegationResult);
      if (!store.getMeta(key)) store.setMeta(key, event.runId);
    }
  }
  // A native Codex turn can be visible through both APIs. Its first source owns
  // its event set, so a later overlap never duplicates events or rewrites history.
  if (
    owner?.kind === "run" &&
    owner.value.agent === "codex" &&
    owner.value.source !== snapshot.run.source &&
    (owner.value.source.startsWith("t3:") ||
      snapshot.run.source.startsWith("t3:"))
  ) {
    // Either host can add verified identities and task facts; the first source
    // continues to own all trace events and assessed outcomes.
    const automation = mergeAutomation(
      owner.value.automation,
      snapshot.run.automation,
    );
    const conversation = mergeConversations(
      owner.value.conversation,
      snapshot.run.conversation,
    );
    const merged = runSchema.parse({
      ...owner.value,
      ...(conversation !== undefined ? { conversation } : {}),
      ...(automation ? { automation } : {}),
      sessionReferences: mergeSessionReferences(
        owner.value.sessionReferences,
        snapshot.run.sessionReferences,
      ),
      delegations: mergeDelegations(
        owner.value.delegations,
        snapshot.run.delegations,
      ),
    });
    store.put({ kind: "run", value: merged });
    for (const event of snapshot.events)
      if (isHostObservation(event, merged)) persistObservation(event);
    return;
  }
  for (const event of snapshot.events) {
    if (event.kind === "delegation_result") {
      if (isHostObservation(event, snapshot.run)) persistObservation(event);
      continue;
    }
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
  const events = store
    .events(snapshot.run.id)
    .filter((event) => event.kind !== "delegation_result");
  const previous = store.getRecord(`run:${snapshot.run.id}`);
  const run = snapshot.run;
  if (previous?.kind === "run") {
    const automation = mergeAutomation(
      previous.value.automation,
      run.automation,
    );
    if (automation) run.automation = automation;
    const conversation = mergeConversations(
      previous.value.conversation,
      run.conversation,
    );
    if (conversation !== undefined) run.conversation = conversation;
    else delete run.conversation;
    run.sessionReferences = mergeSessionReferences(
      previous.value.sessionReferences,
      run.sessionReferences,
    );
    run.delegations = mergeDelegations(
      previous.value.delegations,
      run.delegations,
    );
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
      events.flatMap((event) =>
        eventCapabilities(event).map(
          (skill) => [JSON.stringify(skill), skill] as const,
        ),
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
    ...(
      await Promise.all(
        config.t3Sources.map(async (source) => {
          try {
            return [await readT3Credential(source.tokenFile)];
          } catch {
            return [];
          } // Unavailable T3 credentials must not stop native capture.
        }),
      )
    ).flat(),
  ];
  const store = new LocalStore(directory, secrets);
  const signatureKey =
    store.getMeta("signatureKey") ?? randomBytes(32).toString("hex");
  store.setMeta("signatureKey", signatureKey);
  const sources: { key: string; create: () => CaptureAdapter }[] = [
    ...config.homes.map((home) => ({
      key: home.path,
      create: () =>
        new CodexAdapter(config, home.path, store, signatureKey, secrets),
    })),
    ...config.t3Sources.map((source) => ({
      key: `t3:${source.environmentId}`,
      create: () => new T3Adapter(config, source, store, signatureKey, secrets),
    })),
  ];
  const adapters = sources.map((source) => ({
    ...source,
    adapter: source.create(),
  }));
  const deliveryController = new AbortController();
  const signal = AbortSignal.any([
    deliveryController.signal,
    ...(options.signal ? [options.signal] : []),
  ]);
  let delivery: Promise<void> | undefined;
  let deliveryFailure: unknown;
  try {
    do {
      const projects = await syncProjects(store, config, token);
      for (const entry of adapters) entry.adapter.setProjects(projects);
      if (!options.once && !delivery)
        delivery = drainQueue(store, config, token, { signal }).catch(
          (error: unknown) => {
            deliveryFailure = error;
            deliveryController.abort();
          },
        );
      for (const entry of adapters) {
        try {
          for await (const snapshot of entry.adapter.collect())
            persistSnapshot(store, snapshot);
          store.setMeta(
            `health:${entry.key}`,
            JSON.stringify({
              status: entry.adapter.deferredTurns ? "partial" : "ok",
              at: Date.now(),
              ...(entry.adapter.deferredTurns
                ? {
                    diagnostic: "t3_codex_identity_pending",
                    deferredTurns: entry.adapter.deferredTurns,
                  }
                : {}),
            }),
          );
        } catch (error) {
          const diagnostic =
            error instanceof z.ZodError
              ? error.issues
                  .map((issue) => ({ code: issue.code, path: issue.path }))
                  .slice(0, 10)
              : error instanceof Error &&
                  /^(?:codex|t3)_[a-z0-9_-]+$/.test(error.message)
                ? error.message
                : "capture_unavailable";
          store.setMeta(
            `health:${entry.key}`,
            JSON.stringify({
              status: "capture_error",
              at: Date.now(),
              diagnostic,
            }),
          );
          await entry.adapter.close();
          entry.adapter = entry.create();
        }
      }
      for (const run of store.runsForSession()) {
        if (!resolveProject(projects, run)) continue;
        if (run.completedAt !== null) continue;
        const findings = detectProblems(run, store.events(run.id));
        if (JSON.stringify(findings) !== JSON.stringify(run.findings))
          store.put({ kind: "run", value: { ...run, findings } });
      }
      publishEvaluationTasks(store);
      if (options.once) {
        await drainQueue(store, config, token, { signal, once: true });
        return { pending: store.pending() };
      }
      await new Promise<void>((resolve) => {
        const done = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", done);
          resolve();
        };
        const timer = setTimeout(done, config.pollSeconds * 1000);
        signal.addEventListener("abort", done, { once: true });
        if (signal.aborted) done();
      });
    } while (!signal.aborted);
    if (deliveryFailure) throw deliveryFailure;
  } finally {
    deliveryController.abort();
    await delivery;
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
      t3: config.t3Sources.map((source) => ({
        label: source.label,
        environmentId: source.environmentId,
        health: JSON.parse(
          store.getMeta(`health:t3:${source.environmentId}`) ?? "null",
        ),
      })),
    };
  } finally {
    store.close();
  }
}
