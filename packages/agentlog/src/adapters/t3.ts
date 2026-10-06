import { createHash, createHmac } from "node:crypto";
import { basename } from "node:path";
import { z } from "zod";
import {
  eventSchema,
  runSchema,
  launchContextSchema,
  type AgentEvent,
  type AgentSnapshot,
} from "@astack/agent-observability";
import { redact, redactText } from "@astack/agent-observability/redaction";
import {
  resolveProject,
  repositoryIdentity,
  type Project,
} from "@astack/agent-observability/projects";
import { detectProblems } from "@astack/agent-observability/analysis";
import type { CollectorConfig, T3Source } from "../config";
import type { LocalStore } from "../store";
import { localRepository } from "../git";
import { capability, runIdentity } from "./codex";
import { T3Reader } from "./t3-rpc";
import { claudeVersion } from "./claude-version";

const id = z.string().min(1).max(512);
const date = z.iso
  .datetime({ offset: true })
  .transform((value) => Date.parse(value));
const ref = z.object({
  driver: id,
  nativeId: id.nullable(),
  strength: z.enum(["strong", "weak", "none"]),
});
const model = z.object({ instanceId: id, model: id });
const shellThread = z.object({
  id,
  projectId: id,
  worktreePath: z.string().nullable(),
  branch: z.string().nullable(),
  updatedAt: date,
  status: z.string(),
  latestRunId: id.nullable(),
  latestRunCompletedAt: date.nullable().optional(),
});
export const t3ShellSchema = z.object({
  snapshotSequence: z.number().int().nonnegative(),
  projects: z.array(
    z.object({
      id,
      workspaceRoot: z.string(),
      repositoryIdentity: z
        .object({
          canonicalKey: z.string().min(1).max(4096),
          origin: z
            .object({ canonicalKey: z.string().min(1).max(4096) })
            .optional(),
        })
        .nullable()
        .optional(),
    }),
  ),
  threads: z.array(shellThread),
  archivedThreads: z.array(shellThread).default([]),
});
const archivedSchema = z.object({ threads: z.array(shellThread) });
const baseItem = z.object({
  id,
  type: z.string(),
  threadId: id,
  runId: id.nullable(),
  providerThreadId: id.nullable(),
  providerTurnId: id.nullable(),
  nativeItemRef: ref.nullable(),
  ordinal: z.number().int().nonnegative(),
  status: z.string(),
  startedAt: date.nullable(),
  completedAt: date.nullable(),
  updatedAt: date,
});
const messageItem = baseItem.extend({
  type: z.enum(["user_message", "assistant_message"]),
  text: z.string(),
});
const commandItem = baseItem.extend({
  type: z.literal("command_execution"),
  input: z.string(),
  output: z.string().optional(),
  exitCode: z.number().int().optional(),
  outputIndicatesFailure: z.boolean().optional(),
});
const toolItem = baseItem.extend({
  type: z.literal("dynamic_tool"),
  toolName: z.string().nullable(),
  input: z.unknown(),
  output: z.unknown().optional(),
  outputOmitted: z.boolean().optional(),
});
const fileItem = baseItem.extend({
  type: z.literal("file_change"),
  fileName: z.string(),
  diffStr: z.string().optional(),
  newStr: z.string().optional(),
});
const subagentItem = baseItem.extend({
  type: z.literal("subagent"),
  childThreadId: id.nullable(),
  prompt: z.string(),
  result: z.string().nullable(),
});
const errorItem = baseItem.extend({
  type: z.literal("error"),
  failure: z.object({ message: z.string() }),
});
const interruptItem = baseItem.extend({
  type: z.literal("run_interrupt_result"),
  message: z.string(),
});
const supportedItem = z.union([
  messageItem,
  commandItem,
  toolItem,
  fileItem,
  subagentItem,
  errorItem,
  interruptItem,
]);
export const t3ProjectionSchema = z.object({
  thread: z.object({
    id,
    lineage: z.object({ parentThreadId: id.nullable() }),
  }),
  runs: z.array(
    z.object({
      id,
      modelSelection: model,
      startedAt: date.nullable(),
      requestedAt: date,
      completedAt: date.nullable(),
      status: z.string(),
    }),
  ),
  attempts: z.array(
    z.object({
      id,
      runId: id,
      providerThreadId: id,
      nativeThreadId: id.optional(),
      attemptOrdinal: z.number().int().positive(),
    }),
  ),
  providerThreads: z.array(
    z.object({
      id,
      driver: id,
      providerInstanceId: id,
      nativeThreadRef: ref.nullable(),
    }),
  ),
  providerTurns: z.array(
    z.object({
      id,
      providerThreadId: id,
      runAttemptId: id.nullable(),
      nativeTurnRef: ref.nullable(),
      ordinal: z.number().int().positive(),
      status: z.string(),
      startedAt: date.nullable(),
      completedAt: date.nullable(),
    }),
  ),
  // Local items only. Inherited history belongs to its original conversation.
  turnItems: z.array(z.unknown()),
});
type Projection = z.infer<typeof t3ProjectionSchema>;
type Turn = Projection["providerTurns"][number];
type Item = z.infer<typeof supportedItem>;
const snapshotSchema = z.object({ projection: z.unknown() });
export type T3ReadSource = Pick<
  T3Reader,
  | "initialize"
  | "shell"
  | "archived"
  | "thread"
  | "item"
  | "close"
  | "secrets"
  | "serverVersion"
>;
const successful = (status: string) => status === "completed";
const finished = (status: string) =>
  ["completed", "failed", "interrupted", "cancelled"].includes(status);
const testing = (command: string) =>
  /\b(?:pytest|jest|vitest|cargo\s+test|bun\s+test|(?:npm|pnpm|bun)\s+(?:run\s+)?(?:[\w.-]+:)*(?:test|check)(?::[\w.-]+)*|xcodebuild\s+test)\b/i.test(
    command,
  );

function codexIdentity(
  provider: Projection["providerThreads"][number],
  attempt: Projection["attempts"][number] | undefined,
  turn: Turn,
) {
  if (provider.driver !== "codex") return null;
  const session =
    attempt?.nativeThreadId ??
    (provider.nativeThreadRef?.strength === "strong" &&
    provider.nativeThreadRef.driver === "codex"
      ? provider.nativeThreadRef.nativeId
      : null);
  const nativeTurn =
    turn.nativeTurnRef?.strength === "strong" &&
    turn.nativeTurnRef.driver === "codex"
      ? turn.nativeTurnRef.nativeId
      : null;
  return session && nativeTurn ? { session, turn: nativeTurn } : null;
}

export async function normalizeT3Turn(options: {
  projection: Projection;
  turn: Turn;
  config: CollectorConfig;
  source: T3Source;
  cwd: string;
  repo?: string;
  branch?: string;
  projectId: string;
  store: LocalStore;
  signatureKey: string;
  secrets: readonly string[];
  observedAt: number;
}): Promise<AgentSnapshot | null> {
  const { projection, turn, config, source, store, observedAt } = options;
  const provider = projection.providerThreads.find(
    (entry) => entry.id === turn.providerThreadId,
  );
  const attempt = projection.attempts.find(
    (entry) => entry.id === turn.runAttemptId,
  );
  const appRun = projection.runs.find((entry) => entry.id === attempt?.runId);
  if (!provider || !appRun) return null;
  const agent = provider.driver === "claudeAgent" ? "claude" : provider.driver;
  const native = codexIdentity(provider, attempt, turn);
  const nativeSession = native?.session;
  const nativeTurn = native?.turn;
  // Never create a provisional Codex run which later duplicates its native turn.
  if (agent === "codex" && (!nativeSession || !nativeTurn)) return null;
  const scope = createHash("sha256")
    .update(
      `${source.environmentId}:${provider.providerInstanceId}:${projection.thread.id}`,
    )
    .digest("hex")
    .slice(0, 24);
  const runId =
    agent === "codex" && nativeSession && nativeTurn
      ? runIdentity(config.machineId, nativeSession, nativeTurn)
      : `${config.machineId}:t3:${scope}:${turn.id}`;
  const previous = store.getRecord(`run:${runId}`);
  const origin = `t3:${source.environmentId}`;
  if (previous?.kind === "run" && previous.value.source !== origin) return null;
  const sessionId =
    previous?.kind === "run"
      ? previous.value.sessionId
      : agent === "codex" && nativeSession
        ? nativeSession
        : `t3:${source.environmentId}:${projection.thread.id}`;
  const context = store.getMeta(`context:${sessionId}`);
  const binding = context ? launchContextSchema.parse(JSON.parse(context)) : {};
  const safe = (text: string) => redactText(text, options.secrets);
  const data = (value: unknown) => redact(value, options.secrets);
  const signature = (value: string) =>
    createHmac("sha256", options.signatureKey).update(value).digest("hex");
  const events: AgentEvent[] = [];
  const coverage = [
    "T3 provider-turn capture; T3 run and native turn are separate identities",
    "Times are recorded by T3; unavailable native facts remain unknown",
    "Skill hashes are observation-time evidence; automatically supplied instructions are not inferred",
  ];
  let agentVersion =
    previous?.kind === "run" ? previous.value.agentVersion : undefined;
  if (agent === "claude") {
    const session =
      provider.nativeThreadRef?.driver === "claudeAgent" &&
      provider.nativeThreadRef.strength === "strong"
        ? provider.nativeThreadRef.nativeId
        : null;
    if (session && turn.startedAt !== null) {
      const version = await claudeVersion({
        home: config.claudeHome,
        cwd: options.cwd,
        sessionId: session,
        startedAt: turn.startedAt,
        completedAt: turn.completedAt,
      });
      if (version.kind === "known") agentVersion = version.version;
      else if (version.kind === "conflicting") agentVersion = undefined;
    }
    coverage.push(
      "Claude CLI version uses matching native session records within this turn; missing or conflicting evidence remains unknown",
    );
  }
  const emit = (
    itemId: string,
    sequence: number,
    kind: AgentEvent["kind"],
    title: string,
    extra: Partial<AgentEvent> = {},
  ) => {
    events.push(
      eventSchema.parse({
        id: `${runId}:t3:${itemId}`,
        runId,
        sequence,
        kind,
        title,
        timestamp: null,
        observedAt,
        timing: "unavailable",
        ...extra,
      }),
    );
  };
  emit("start", 0, "run_start", "Agent turn started", {
    timestamp: turn.startedAt,
    timing: turn.startedAt === null ? "unavailable" : "agent",
    data: {
      t3ThreadId: projection.thread.id,
      t3RunId: appRun.id,
      t3TurnId: turn.id,
      t3ParentThreadId: projection.thread.lineage.parentThreadId,
      providerInstanceId: provider.providerInstanceId,
    },
  });
  const firstTurn = projection.providerTurns
    .filter(
      (entry) =>
        projection.attempts.find((a) => a.id === entry.runAttemptId)?.runId ===
        appRun.id,
    )
    .sort(
      (a, b) =>
        (projection.attempts.find((entry) => entry.id === a.runAttemptId)
          ?.attemptOrdinal ?? 0) -
          (projection.attempts.find((entry) => entry.id === b.runAttemptId)
            ?.attemptOrdinal ?? 0) || a.ordinal - b.ordinal,
    )[0];
  let unsupported = 0;
  const rawItems = projection.turnItems.filter((raw) => {
    const result = baseItem.safeParse(raw);
    if (!result.success) {
      unsupported++;
      return false;
    }
    const item = result.data;
    if (
      item.threadId !== projection.thread.id ||
      item.type === "reasoning" ||
      item.type === "secret_request"
    )
      return false;
    return (
      item.providerTurnId === turn.id ||
      (item.providerTurnId === null &&
        item.runId === appRun.id &&
        firstTurn?.id === turn.id)
    );
  });
  for (const raw of rawItems) {
    const parsed = supportedItem.safeParse(raw);
    if (!parsed.success) {
      unsupported++;
      continue;
    }
    const item: Item = parsed.data;
    const seq = item.ordinal * 100 + 100;
    const failed = item.status === "failed";
    const time = {
      timestamp: item.startedAt,
      timing: item.startedAt === null ? "unavailable" : "agent",
    } satisfies Pick<AgentEvent, "timestamp" | "timing">;
    switch (item.type) {
      case "user_message":
      case "assistant_message":
        emit(
          item.id,
          seq,
          item.type === "user_message" ? "user_prompt" : "assistant_output",
          item.type === "user_message" ? "User prompt" : "Assistant output",
          {
            ...time,
            data: {
              content: config.captureContent ? safe(item.text) : "[WITHHELD]",
            },
          },
        );
        break;
      case "command_execution": {
        const isTest = testing(item.input);
        const sig = signature(item.input);
        emit(
          `${item.id}:call`,
          seq,
          isTest ? "test_run" : "shell_command",
          isTest ? "Test/check command" : "Shell command",
          {
            ...time,
            tool: "shell",
            signature: sig,
            data: {
              command: config.captureContent ? safe(item.input) : "[WITHHELD]",
            },
          },
        );
        if (finished(item.status))
          emit(
            `${item.id}:result`,
            seq + 1,
            isTest ? "test_result" : "shell_result",
            isTest ? "Test/check result" : "Shell result",
            {
              tool: "shell",
              signature: sig,
              failed:
                failed ||
                item.outputIndicatesFailure === true ||
                (item.exitCode !== undefined && item.exitCode !== 0),
              timestamp: item.completedAt,
              timing: item.completedAt === null ? "unavailable" : "agent",
              data: {
                exitCode: item.exitCode ?? null,
                output: config.captureContent
                  ? safe(item.output ?? "")
                  : "[WITHHELD]",
              },
            },
          );
        const match = item.input.match(
          /^\s*(?:cat|read_file)\s+(?:'([^']+)'|"([^"]+)"|([^\s;|&]+))\s*$/,
        );
        const path = match?.[1] ?? match?.[2] ?? match?.[3];
        if (path && successful(item.status) && item.exitCode === 0) {
          const skill = await capability(
            path,
            options.cwd,
            "read",
            "observation_time",
          );
          if (skill)
            emit(
              `${item.id}:skill`,
              seq + 2,
              skill.kind === "skill" ? "skill_loaded" : "instruction_loaded",
              "Capability read",
              { skill },
            );
        }
        break;
      }
      case "dynamic_tool": {
        const tool = item.toolName ?? "unknown";
        const mcp = /^mcp(?:__|\/)/i.test(tool);
        const sig = signature(`${tool}:${JSON.stringify(item.input)}`);
        const toolFailed =
          failed ||
          z.object({ isError: z.literal(true) }).safeParse(item.output).success;
        emit(
          `${item.id}:call`,
          seq,
          mcp ? "mcp_call" : "tool_call",
          "Tool call",
          {
            ...time,
            tool: safe(tool).slice(0, 512),
            signature: sig,
            data: {
              arguments: config.captureContent
                ? data(item.input)
                : "[WITHHELD]",
            },
          },
        );
        if (finished(item.status))
          emit(
            `${item.id}:result`,
            seq + 1,
            mcp ? "mcp_result" : "tool_result",
            "Tool result",
            {
              tool: safe(tool).slice(0, 512),
              signature: sig,
              failed: toolFailed,
              timestamp: item.completedAt,
              timing: item.completedAt === null ? "unavailable" : "agent",
              data: {
                result: config.captureContent
                  ? data(item.output ?? null)
                  : "[WITHHELD]",
                ...(item.outputOmitted ? { omitted: "T3 omitted output" } : {}),
              },
            },
          );
        if (successful(item.status) && !toolFailed) {
          const input = z
            .object({
              file_path: z.string().optional(),
              path: z.string().optional(),
              skill: z.string().min(1).max(512).optional(),
            })
            .safeParse(item.input);
          if (input.success && /(?:^|[/.])Read$/i.test(tool)) {
            const path = input.data.file_path ?? input.data.path;
            if (path) {
              emit(`${item.id}:read`, seq + 2, "file_read", "File read", {
                data: { path: safe(path) },
              });
              const skill = await capability(
                path,
                options.cwd,
                "read",
                "observation_time",
              );
              if (skill)
                emit(
                  `${item.id}:skill`,
                  seq + 3,
                  skill.kind === "skill"
                    ? "skill_loaded"
                    : "instruction_loaded",
                  "Capability read",
                  { skill },
                );
            }
          } else if (
            input.success &&
            /(?:^|[/.])Skill$/i.test(tool) &&
            input.data.skill
          ) {
            emit(
              `${item.id}:skill`,
              seq + 2,
              "skill_loaded",
              "Explicit skill invocation",
              {
                skill: {
                  kind: "skill",
                  name: safe(input.data.skill),
                  hash: null,
                  provenance: "declared",
                  evidence: "explicit_input",
                },
              },
            );
          }
        }
        break;
      }
      case "file_change":
        emit(item.id, seq, "file_edit", "File change", {
          ...time,
          failed,
          data: {
            paths: [safe(item.fileName)],
            ...(config.captureContent
              ? { output: safe(item.diffStr ?? item.newStr ?? "") }
              : {}),
          },
        });
        break;
      case "subagent":
        emit(
          item.id,
          seq,
          finished(item.status) ? "subagent_result" : "subagent_start",
          "Subagent activity",
          {
            ...time,
            failed,
            data: {
              session: item.childThreadId,
              ...(config.captureContent
                ? {
                    arguments: safe(item.prompt),
                    result: item.result === null ? null : safe(item.result),
                  }
                : {}),
            },
          },
        );
        break;
      case "error":
        emit(item.id, seq, "error", "Agent error", {
          failed: true,
          signature: signature(item.failure.message),
          data: {
            error: config.captureContent
              ? safe(item.failure.message)
              : "[WITHHELD]",
          },
        });
        break;
      case "run_interrupt_result":
        emit(
          item.id,
          seq,
          "intervention",
          "Agent interruption recorded by T3",
          {
            ...time,
            data: {
              content: config.captureContent
                ? safe(item.message)
                : "[WITHHELD]",
            },
          },
        );
        break;
    }
  }
  if (unsupported) coverage.push(`${unsupported} unsupported T3 items omitted`);
  const status =
    turn.status === "failed"
      ? "failed"
      : ["interrupted", "cancelled"].includes(turn.status)
        ? "interrupted"
        : turn.status === "completed"
          ? "completed"
          : turn.status === "running"
            ? "running"
            : "unknown";
  if (finished(turn.status))
    emit("complete", 2_000_000_000, "run_complete", `Agent turn ${status}`, {
      timestamp: turn.completedAt,
      timing: turn.completedAt === null ? "unavailable" : "agent",
    });
  const run = runSchema.parse({
    id: runId,
    agent,
    ...(agentVersion ? { agentVersion } : {}),
    machineId: config.machineId,
    machineName: config.machineName,
    sessionId,
    attemptId: nativeTurn ?? turn.id,
    source: origin,
    cwd: safe(options.cwd),
    ...(options.repo ? { repo: safe(options.repo) } : {}),
    ...(options.branch ? { branch: safe(options.branch) } : {}),
    model: appRun.modelSelection.model,
    title: `${basename(options.cwd) || "Workspace"} · ${agent} turn ${(nativeTurn ?? turn.id).slice(0, 8)}`,
    startedAt: turn.startedAt ?? appRun.startedAt ?? appRun.requestedAt,
    startTimeKnown: turn.startedAt !== null,
    completedAt: turn.completedAt,
    status,
    lastObservedAt: observedAt,
    lastActivityAt: events.reduce(
      (last, event) => Math.max(last, event.timestamp ?? 0),
      turn.completedAt ?? turn.startedAt ?? appRun.requestedAt,
    ),
    ...(agent !== "codex" && projection.thread.lineage.parentThreadId
      ? {
          parentSessionId: `t3:${source.environmentId}:${projection.thread.lineage.parentThreadId}`,
        }
      : {}),
    ...binding,
    projectId: options.projectId,
    skills: events.flatMap((e) => (e.skill ? [e.skill] : [])).slice(0, 250),
    tools: [...new Set(events.flatMap((e) => (e.tool ? [e.tool] : [])))].slice(
      0,
      250,
    ),
    findings: [],
    eventCount: events.length,
    contentCapture: config.captureContent,
    coverage,
  });
  run.findings = detectProblems(run, events, observedAt);
  return {
    run: runSchema.parse(data(run)),
    events: events.map((event) => eventSchema.parse(data(event))),
  };
}

export class T3Adapter {
  readonly agent = "t3";
  deferredTurns = 0;
  private projects: readonly Project[] = [];
  readonly reader: T3ReadSource;
  constructor(
    private readonly config: CollectorConfig,
    private readonly source: T3Source,
    private readonly store: LocalStore,
    private readonly signatureKey: string,
    private readonly knownSecrets: readonly string[] = [],
    reader?: T3ReadSource,
  ) {
    this.reader = reader ?? new T3Reader(source);
  }
  setProjects(projects: readonly Project[]) {
    this.projects = projects;
  }
  async *collect(): AsyncIterable<AgentSnapshot> {
    this.deferredTurns = 0;
    if (!this.projects.some((project) => project.enabled)) return;
    await this.reader.initialize();
    const shell = t3ShellSchema.parse(await this.reader.shell());
    const archived = archivedSchema.parse(await this.reader.archived());
    const threads = new Map(
      [...shell.threads, ...shell.archivedThreads, ...archived.threads].map(
        (thread) => [thread.id, thread],
      ),
    );
    const repositories = new Map<string, string | null>();
    for (const thread of threads.values()) {
      const t3Project = shell.projects.find((p) => p.id === thread.projectId);
      const cwd = thread.worktreePath ?? t3Project?.workspaceRoot;
      if (!cwd) continue;
      if (!repositories.has(cwd))
        repositories.set(cwd, await localRepository(cwd));
      const localRepo = repositories.get(cwd);
      const recorded = t3Project?.repositoryIdentity;
      // T3's origin keeps a fork distinct from the canonical upstream repository.
      const repo =
        localRepo ??
        (recorded
          ? repositoryIdentity(
              recorded.origin?.canonicalKey ?? recorded.canonicalKey,
            )
          : null) ??
        undefined;
      const project = resolveProject(this.projects, {
        machineId: this.config.machineId,
        cwd,
        ...(repo ? { repo } : {}),
      });
      if (!project) continue;
      const checkpoint = `t3:${this.source.environmentId}:${thread.id}:updated`;
      const fingerprint = createHash("sha256")
        .update(JSON.stringify({ captureVersion: 2, thread }))
        .digest("hex");
      if (
        !["running", "starting", "waiting", "preparing"].includes(
          thread.status,
        ) &&
        this.store.getMeta(checkpoint) === fingerprint
      )
        continue;
      const projection = t3ProjectionSchema.parse(
        snapshotSchema.parse(await this.reader.thread(thread.id)).projection,
      );
      if (projection.thread.id !== thread.id)
        throw new Error("t3_thread_mismatch");
      for (const [index, raw] of projection.turnItems.entries()) {
        const item = baseItem
          .extend({ outputOmitted: z.boolean().optional() })
          .safeParse(raw);
        if (
          item.success &&
          item.data.threadId === thread.id &&
          !["reasoning", "secret_request"].includes(item.data.type) &&
          item.data.outputOmitted
        ) {
          const full = z
            .object({ item: z.unknown() })
            .parse(await this.reader.item(thread.id, item.data.id));
          const identity = baseItem.safeParse(full.item);
          if (
            !identity.success ||
            identity.data.id !== item.data.id ||
            identity.data.threadId !== thread.id
          )
            throw new Error("t3_item_mismatch");
          projection.turnItems[index] = full.item;
        }
      }
      let deferred = 0;
      for (const turn of projection.providerTurns) {
        const appRun = projection.runs.find(
          (run) =>
            run.id ===
            projection.attempts.find(
              (attempt) => attempt.id === turn.runAttemptId,
            )?.runId,
        );
        if (
          (turn.startedAt ?? appRun?.startedAt ?? appRun?.requestedAt ?? 0) <
          this.config.since
        )
          continue;
        const provider = projection.providerThreads.find(
          (entry) => entry.id === turn.providerThreadId,
        );
        const attempt = projection.attempts.find(
          (entry) => entry.id === turn.runAttemptId,
        );
        if (
          provider?.driver === "codex" &&
          !codexIdentity(provider, attempt, turn)
        ) {
          deferred++;
          continue;
        }
        const snapshot = await normalizeT3Turn({
          projection,
          turn,
          config: this.config,
          source: this.source,
          cwd,
          ...(repo ? { repo } : {}),
          ...(thread.branch ? { branch: thread.branch } : {}),
          projectId: project.projectId,
          store: this.store,
          signatureKey: this.signatureKey,
          secrets: [...this.knownSecrets, ...this.reader.secrets],
          observedAt: Date.now(),
        });
        if (snapshot) {
          if (repo)
            snapshot.run.coverage.push(
              localRepo
                ? "Repository resolved from local Git at capture time; not a historical origin."
                : "Repository supplied by T3 project metadata; not a historical native origin.",
            );
          yield snapshot;
        }
      }
      this.deferredTurns += deferred;
      // Advance only after the consumer has durably persisted every yielded turn.
      // Missing native identities are retried even if shell metadata is unchanged.
      if (!deferred) this.store.setMeta(checkpoint, fingerprint);
    }
  }
  close() {
    return this.reader.close();
  }
}
