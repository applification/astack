import {
  conversationSchema,
  type Conversation,
} from "@astack/agent-observability/conversations";
import { z } from "zod";
import { createHash, createHmac } from "node:crypto";
import { readFile, lstat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import {
  eventSchema,
  runSchema,
  skillUseSchema,
  type AgentEvent,
  type AgentSnapshot,
  type SkillUse,
  type WorkReference,
  launchContextSchema,
} from "@astack/agent-observability";
import { detectProblems } from "@astack/agent-observability/analysis";
import { delegationSchema } from "@astack/agent-observability/delegation";
import { redact, redactText } from "@astack/agent-observability/redaction";
import { CodexReader } from "./rpc";
import { CodexAutomations } from "./codex-automations";
import {
  automationSchema,
  type Automation,
} from "@astack/agent-observability/automations";
import type { CollectorConfig } from "../config";
import type { LocalStore } from "../store";
import { localRepository } from "../git";
import {
  resolveProject,
  type Project,
} from "@astack/agent-observability/projects";

const base = { id: z.string() };
const inputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("text"), text: z.string() }),
  z.object({ type: z.literal("skill"), name: z.string(), path: z.string() }),
]);
const itemSchemas = {
  userMessage: z.object({
    ...base,
    type: z.literal("userMessage"),
    content: z.array(z.unknown()),
  }),
  agentMessage: z.object({
    ...base,
    type: z.literal("agentMessage"),
    text: z.string(),
  }),
  commandExecution: z.object({
    ...base,
    type: z.literal("commandExecution"),
    command: z.string(),
    status: z.string(),
    aggregatedOutput: z.string().nullable().optional(),
    exitCode: z.number().nullable().optional(),
    durationMs: z.number().nonnegative().nullable().optional(),
    commandActions: z
      .array(
        z.object({
          type: z.string(),
          path: z.string().nullable().optional(),
          name: z.string().nullable().optional(),
        }),
      )
      .default([]),
  }),
  mcpToolCall: z.object({
    ...base,
    type: z.literal("mcpToolCall"),
    server: z.string(),
    tool: z.string(),
    status: z.string(),
    arguments: z.unknown(),
    result: z.unknown().optional(),
    error: z.unknown().optional(),
    durationMs: z.number().nonnegative().nullable().optional(),
  }),
  fileChange: z.object({
    ...base,
    type: z.literal("fileChange"),
    status: z.string(),
    changes: z.array(z.object({ path: z.string(), kind: z.unknown() })),
  }),
  collabAgentToolCall: z.object({
    ...base,
    type: z.literal("collabAgentToolCall"),
    tool: z.string(),
    status: z.string(),
    receiverThreadIds: z.array(z.string()).default([]),
  }),
  dynamicToolCall: z.object({
    ...base,
    type: z.literal("dynamicToolCall"),
    tool: z.string(),
    namespace: z.string().nullable().optional(),
    status: z.string(),
    arguments: z.unknown().optional(),
    success: z.boolean().nullable().optional(),
  }),
  functionCallOutput: z.object({
    ...base,
    type: z.literal("functionCallOutput"),
    name: z.string(),
    output: z.unknown(),
  }),
};
const itemDiscriminant = z.object({ id: z.string(), type: z.string() });
export const turnSchema = z.object({
  id: z.string(),
  status: z.string(),
  startedAt: z.number().nullable().optional(),
  completedAt: z.number().nullable().optional(),
  durationMs: z.number().nullable().optional(),
  error: z.unknown().optional(),
  items: z.array(z.unknown()).default([]),
});
export const threadSchema = z.object({
  id: z.string(),
  cwd: z.string(),
  source: z.unknown(),
  originator: z.string().nullable().optional(),
  threadSource: z.string().nullable().optional(),
  cliVersion: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  model: z.string().nullable().optional(),
  parentThreadId: z.string().nullable().optional(),
  forkedFromId: z.string().nullable().optional(),
  gitInfo: z
    .object({
      sha: z.string().nullable().optional(),
      branch: z.string().nullable().optional(),
      originUrl: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  turns: z.array(turnSchema).default([]),
});

type NativeThread = z.infer<typeof threadSchema>;
export async function resolveCodexConversation(
  thread: NativeThread,
  loadParent: (id: string) => Promise<NativeThread | null>,
): Promise<Conversation | null> {
  const visited = new Set<string>();
  let current = thread;
  for (let depth = 0; depth < 16; depth++) {
    if (visited.has(current.id)) return null;
    visited.add(current.id);
    if (!current.parentThreadId) {
      const subagentSource =
        current.source === "subagent" ||
        (typeof current.source === "object" &&
          current.source !== null &&
          "subagent" in current.source);
      if (current.parentThreadId === undefined && subagentSource) return null;
      const reference = (sessionId: string) =>
        ({ kind: "codex", sessionId }) as const;
      const parentId = thread.parentThreadId ?? thread.forkedFromId;
      return conversationSchema.parse({
        self: reference(thread.id),
        root: reference(current.id),
        ...(parentId
          ? {
              parent: {
                reference: reference(parentId),
                relationship: thread.parentThreadId ? "subagent" : "fork",
              },
            }
          : {}),
      });
    }
    const parent = await loadParent(current.parentThreadId);
    if (!parent || parent.id !== current.parentThreadId) return null;
    current = parent;
  }
  return null;
}
const listSchema = z.object({
  data: z.array(threadSchema),
  nextCursor: z.string().nullable(),
});
const turnListSchema = z.object({
  data: z.array(turnSchema),
  nextCursor: z.string().nullable(),
});
const sourceKinds = [
  "cli",
  "vscode",
  "exec",
  "appServer",
  "subAgent",
  "subAgentReview",
  "subAgentCompact",
  "subAgentThreadSpawn",
  "subAgentOther",
  "unknown",
];
const isTest = (command: string) =>
  /\b(?:pytest|jest|vitest|cargo\s+test|bun\s+test|(?:npm|pnpm|bun)\s+(?:run\s+)?(?:[\w.-]+:)*(?:test|check)(?::[\w.-]+)*|xcodebuild\s+test)\b/i.test(
    command,
  );
export const runIdentity = (
  machineId: string,
  sessionId: string,
  attemptId: string,
) => `${machineId}:codex:${sessionId}:${attemptId}`;

let hashProbes = 0;
async function safeCapabilityHash(full: string): Promise<string | null> {
  // Historical paths can be FIFOs, remote mounts or cloud placeholders. Never let
  // one block collection or prompt for macOS protected-folder access.
  const protectedRoots = [
    "/Volumes",
    ...[
      "Documents",
      "Desktop",
      "Downloads",
      "Library/CloudStorage",
      "Library/Mobile Documents",
    ].map((path) => resolve(homedir(), path)),
  ];
  if (
    process.platform === "darwin" &&
    protectedRoots.some((path) => full === path || full.startsWith(`${path}/`))
  )
    return null;
  if (hashProbes >= 1) return null;
  hashProbes++;
  const controller = new AbortController();
  const probe = (async () => {
    const stat = await lstat(full);
    if (!stat.isFile() || stat.size > 1024 * 1024) return null;
    const content = await readFile(full, { signal: controller.signal });
    return createHash("sha256").update(content).digest("hex");
  })()
    .catch(() => null)
    .finally(() => {
      hashProbes--;
    });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, 750);
  });
  try {
    return await Promise.race([probe, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function capability(
  path: string,
  cwd: string,
  evidence: SkillUse["evidence"],
  provenance: SkillUse["provenance"],
): Promise<SkillUse | null> {
  const full = resolve(cwd, path);
  const kind =
    basename(full) === "SKILL.md"
      ? "skill"
      : ["AGENTS.md", "CLAUDE.md"].includes(basename(full))
        ? "instruction"
        : null;
  if (!kind) return null;
  const hash = await safeCapabilityHash(full);
  return skillUseSchema.parse({
    kind,
    name: kind === "skill" ? basename(dirname(full)) : full,
    path: full,
    hash,
    provenance,
    evidence,
  });
}

export async function normalizeTurn(options: {
  thread: z.infer<typeof threadSchema>;
  turn: z.infer<typeof turnSchema>;
  machine: Pick<CollectorConfig, "machineId" | "machineName"> & {
    captureContent: boolean;
  };
  signatureKey: string;
  knownSecrets?: readonly string[];
  observedAt: number;
  work?: WorkReference;
  projectId?: string;
  automation?: Automation;
  conversation?: Conversation | null;
}): Promise<AgentSnapshot> {
  const { thread, turn, machine, observedAt } = options;
  const conversation =
    options.conversation === undefined
      ? await resolveCodexConversation(thread, async () => null)
      : options.conversation;
  const safeText = (value: string) => redactText(value, options.knownSecrets);
  const safeData = (value: unknown) => redact(value, options.knownSecrets);
  const runId = runIdentity(machine.machineId, thread.id, turn.id);
  const automation =
    options.automation ??
    (thread.threadSource === "automation"
      ? ({
          provider: "codex",
          id: null,
          name: null,
          schedule: null,
        } satisfies Automation)
      : undefined);
  const events: AgentEvent[] = [];
  const signature = (value: string) =>
    createHmac("sha256", options.signatureKey).update(value).digest("hex");
  function emit(
    itemId: string,
    sequence: number,
    kind: AgentEvent["kind"],
    title: string,
    extra: Partial<AgentEvent> = {},
  ) {
    events.push(
      eventSchema.parse({
        id: `${runId}:${itemId}`,
        runId,
        sequence,
        kind,
        title,
        observedAt,
        timestamp: null,
        timing: "unavailable",
        ...extra,
      }),
    );
  }
  const startedAt = (turn.startedAt ?? thread.createdAt) * 1000;
  const completedAt = turn.completedAt == null ? null : turn.completedAt * 1000;
  emit("start", 0, "run_start", "Agent turn started", {
    timestamp: turn.startedAt == null ? null : startedAt,
    timing: turn.startedAt == null ? "unavailable" : "agent",
  });
  const coverage = [
    "Persisted app-server history; live state in other clients may be unavailable",
    "Individual item timestamps and token counts are unavailable",
    "Skill hashes captured at observation time; historical versions may differ",
  ];
  let unknown = 0;
  for (const [index, raw] of turn.items.entries()) {
    const discriminator = itemDiscriminant.safeParse(raw);
    if (!discriminator.success) {
      unknown++;
      continue;
    }
    const seq = index * 100 + 100;
    const itemId = discriminator.data.id;
    switch (discriminator.data.type) {
      case "userMessage": {
        const item = itemSchemas.userMessage.parse(raw);
        const inputs = item.content.flatMap((value) => {
          const result = inputSchema.safeParse(value);
          return result.success ? [result.data] : [];
        });
        const text = inputs
          .filter((i) => i.type === "text")
          .map((i) => i.text)
          .join("\n");
        emit(`${itemId}:prompt`, seq, "user_prompt", "User prompt", {
          data: machine.captureContent
            ? { content: safeText(text) }
            : { content: "[WITHHELD]", characters: text.length },
        });
        for (const [i, input] of inputs.entries())
          if (input.type === "skill") {
            const skill = await capability(
              input.path,
              thread.cwd,
              "explicit_input",
              "observation_time",
            );
            if (skill)
              emit(
                `${itemId}:skill:${i}`,
                seq + i + 1,
                "skill_loaded",
                `Skill input: ${input.name}`,
                { skill },
              );
          }
        break;
      }
      case "agentMessage": {
        const item = itemSchemas.agentMessage.parse(raw);
        emit(itemId, seq, "assistant_output", "Assistant output", {
          data: machine.captureContent
            ? { content: safeText(item.text) }
            : { content: "[WITHHELD]", characters: item.text.length },
        });
        break;
      }
      case "commandExecution": {
        const item = itemSchemas.commandExecution.parse(raw);
        const testing = isTest(item.command);
        const commandSignature = signature(item.command);
        const command = testing ? "Test/check command" : "Shell command";
        emit(
          `${itemId}:call`,
          seq,
          testing ? "test_run" : "shell_command",
          command,
          {
            tool: "shell",
            signature: commandSignature,
            data: {
              command: machine.captureContent
                ? safeText(item.command)
                : "[WITHHELD]",
            },
          },
        );
        if (item.status !== "inProgress")
          emit(
            `${itemId}:result`,
            seq + 1,
            testing ? "test_result" : "shell_result",
            `${testing ? "Test/check" : "Shell"} result`,
            {
              tool: "shell",
              signature: commandSignature,
              failed:
                item.status === "failed" ||
                (item.exitCode != null && item.exitCode !== 0),
              ...(item.durationMs == null
                ? {}
                : { durationMs: item.durationMs }),
              data: {
                status: item.status,
                exitCode: item.exitCode ?? null,
                ...(machine.captureContent
                  ? { output: safeText(item.aggregatedOutput ?? "") }
                  : { output: "[WITHHELD]" }),
              },
            },
          );
        for (const [i, action] of item.commandActions.slice(0, 40).entries())
          if (action.type === "read" && action.path) {
            emit(
              `${itemId}:read:${i}`,
              seq + 2 + i * 2,
              "file_read",
              `Read ${safeText(action.path)}`,
              { data: { path: safeText(action.path) } },
            );
            const skill = await capability(
              action.path,
              thread.cwd,
              "read",
              "observation_time",
            );
            if (skill && item.exitCode === 0)
              emit(
                `${itemId}:capability:${i}`,
                seq + 3 + i * 2,
                skill.kind === "skill" ? "skill_loaded" : "instruction_loaded",
                `${skill.kind === "skill" ? "Skill read" : "Instructions read"}: ${skill.name}`,
                { skill },
              );
          }
        break;
      }
      case "mcpToolCall": {
        const item = itemSchemas.mcpToolCall.parse(raw);
        const tool = `${item.server}/${item.tool}`;
        const sig = signature(`${tool}:${JSON.stringify(item.arguments)}`);
        emit(`${itemId}:call`, seq, "mcp_call", `MCP ${tool}`, {
          tool,
          signature: sig,
          data: machine.captureContent
            ? { arguments: safeData(item.arguments) }
            : { arguments: "[WITHHELD]" },
        });
        if (item.status !== "inProgress")
          emit(
            `${itemId}:result`,
            seq + 1,
            "mcp_result",
            `MCP result: ${tool}`,
            {
              tool,
              signature: sig,
              failed:
                item.status === "failed" ||
                item.error != null ||
                z.object({ isError: z.literal(true) }).safeParse(item.result)
                  .success,
              ...(item.durationMs == null
                ? {}
                : { durationMs: item.durationMs }),
              data: {
                status: item.status,
                ...(machine.captureContent
                  ? {
                      result: safeData(item.result),
                      error: safeData(item.error),
                    }
                  : { result: "[WITHHELD]" }),
              },
            },
          );
        break;
      }
      case "fileChange": {
        const item = itemSchemas.fileChange.parse(raw);
        emit(itemId, seq, "file_edit", `${item.changes.length} file changes`, {
          failed: item.status === "failed",
          data: {
            status: item.status,
            paths: item.changes.map((c) => safeText(c.path)),
          },
        });
        break;
      }
      case "collabAgentToolCall": {
        const item = itemSchemas.collabAgentToolCall.parse(raw);
        emit(
          itemId,
          seq,
          item.status === "inProgress" ? "tool_call" : "tool_result",
          `Agent coordination: ${item.tool}`,
          {
            tool: item.tool,
            failed: item.status === "failed",
            data: { sessions: item.receiverThreadIds, status: item.status },
          },
        );
        break;
      }
      case "dynamicToolCall": {
        const item = itemSchemas.dynamicToolCall.parse(raw);
        const tool = [item.namespace, item.tool].filter(Boolean).join("/");
        emit(
          itemId,
          seq,
          item.status === "inProgress" ? "tool_call" : "tool_result",
          `Tool ${tool}`,
          {
            tool,
            failed: item.success === false || item.status === "failed",
            data: machine.captureContent
              ? { arguments: safeData(item.arguments), status: item.status }
              : { status: item.status },
          },
        );
        break;
      }
      case "functionCallOutput": {
        const item = itemSchemas.functionCallOutput.parse(raw);
        emit(itemId, seq, "tool_result", `Tool output: ${item.name}`, {
          tool: item.name,
          data: machine.captureContent
            ? { output: safeData(item.output) }
            : { output: "[WITHHELD]" },
        });
        break;
      }
      case "reasoning":
        break; // Deliberately do not collect hidden reasoning.
      default:
        unknown++;
    }
  }
  if (turn.startedAt == null)
    coverage.push(
      "Turn start is unavailable; session creation time is used for listing only",
    );
  if (unknown) coverage.push(`${unknown} unsupported items omitted`);
  const status =
    turn.status === "failed"
      ? "failed"
      : completedAt !== null
        ? turn.status === "interrupted"
          ? "interrupted"
          : "completed"
        : turn.startedAt == null
          ? "unknown"
          : "running";
  if (turn.error != null)
    emit("error", turn.items.length * 100 + 200, "error", "Agent error", {
      failed: true,
      signature: signature(JSON.stringify(turn.error)),
      data: machine.captureContent
        ? { error: safeData(turn.error) }
        : { error: "[WITHHELD]" },
    });
  if (completedAt !== null)
    emit(
      "complete",
      turn.items.length * 100 + 300,
      "run_complete",
      `Agent turn ${status}`,
      { timestamp: completedAt, timing: "agent" },
    );
  const run = runSchema.parse({
    id: runId,
    agent: "codex",
    agentVersion: thread.cliVersion,
    machineId: machine.machineId,
    machineName: machine.machineName,
    sessionId: thread.id,
    sessionReferences: [{ kind: "codex", sessionId: thread.id }],
    delegations: turn.items
      .flatMap((raw) => {
        const parsed = itemSchemas.collabAgentToolCall.safeParse(raw);
        if (
          !parsed.success ||
          !["spawnAgent", "spawn_agent"].includes(parsed.data.tool)
        )
          return [];
        return parsed.data.receiverThreadIds.map((sessionId) =>
          delegationSchema.parse({
            id: `${runId}:delegate:${parsed.data.id}:${sessionId}`,
            source: "codex",
            child: { kind: "codex", sessionId },
            title: "Delegated agent",
            // A completed spawn tool call says nothing about the child's outcome.
            status: "unknown",
            startedAt: null,
            completedAt: null,
          }),
        );
      })
      .slice(0, 32),
    attemptId: turn.id,
    ...(thread.parentThreadId
      ? { parentSessionId: thread.parentThreadId }
      : {}),
    ...(conversation ? { conversation } : {}),
    source:
      thread.originator ??
      (typeof thread.source === "string" ? thread.source : "subagent"),
    ...(automation
      ? { automation: automationSchema.parse(safeData(automation)) }
      : {}),
    cwd: safeText(thread.cwd),
    ...(thread.gitInfo?.originUrl
      ? { repo: safeText(thread.gitInfo.originUrl) }
      : {}),
    ...(thread.gitInfo?.branch
      ? { branch: safeText(thread.gitInfo.branch) }
      : {}),
    ...(thread.gitInfo?.sha ? { commit: thread.gitInfo.sha } : {}),
    ...(thread.model ? { model: thread.model } : {}),
    title: `${basename(thread.cwd) || "Workspace"} · Codex turn ${turn.id.slice(0, 8)}`,
    startedAt,
    startTimeKnown: turn.startedAt != null,
    completedAt,
    status,
    lastObservedAt: observedAt,
    lastActivityAt: (turn.completedAt ?? thread.updatedAt) * 1000,
    ...(options.work ? { work: options.work } : {}),
    ...(options.projectId ? { projectId: options.projectId } : {}),
    skills: [
      ...new Map(
        events.flatMap((e) =>
          e.skill
            ? [[JSON.stringify(e.skill), e.skill] satisfies [string, SkillUse]]
            : [],
        ),
      ).values(),
    ].slice(0, 250),
    tools: [...new Set(events.flatMap((e) => (e.tool ? [e.tool] : [])))].slice(
      0,
      250,
    ),
    findings: [],
    eventCount: events.length,
    contentCapture: machine.captureContent,
    coverage,
  });
  run.findings = detectProblems(run, events, observedAt);
  return { run, events };
}

export class CodexAdapter {
  readonly agent = "codex";
  private reader: Pick<CodexReader, "initialize" | "request" | "close">;
  private initialized = false;
  private projects: readonly Project[] = [];
  setProjects(projects: readonly Project[]) {
    this.projects = projects;
  }
  constructor(
    private config: CollectorConfig,
    private home: string,
    private store: LocalStore,
    private signatureKey: string,
    private readonly knownSecrets: readonly string[] = [],
    reader?: Pick<CodexReader, "initialize" | "request" | "close">,
  ) {
    this.reader = reader ?? new CodexReader(config.codexBinary, home);
  }
  async *collect(): AsyncIterable<AgentSnapshot> {
    if (!this.projects.some((p) => p.enabled)) return;
    // Cache only within this poll; subsequent polls see origin/folder changes.
    const repositories = new Map<string, string | null>();
    const ancestry = new Map<string, NativeThread>();
    if (!this.initialized) {
      await this.reader.initialize();
      this.initialized = true;
    }
    const automationVersion = `codex:${this.home}:automation-capture-version`;
    const replayAutomations = this.store.getMeta(automationVersion) !== "1";
    const conversationVersion = `codex:${this.home}:conversation-capture-version`;
    const replayConversations = this.store.getMeta(conversationVersion) !== "1";
    const automations = new CodexAutomations(this.home);
    try {
      for (const archived of [false, true]) {
        const checkpoint = `codex:${this.home}:${archived}:updated`;
        const since =
          Number(
            (replayAutomations || replayConversations
              ? null
              : this.store.getMeta(checkpoint)) ?? this.config.since / 1000,
          ) - 2;
        let cursor: string | null = null;
        let newest = since + 2;
        do {
          const page = listSchema.parse(
            await this.reader.request("thread/list", {
              limit: 100,
              sortKey: "updated_at",
              sortDirection: "desc",
              sourceKinds,
              archived,
              ...(cursor ? { cursor } : {}),
            }),
          );
          let past = false;
          for (const thread of page.data) {
            if (thread.updatedAt < since) {
              past = true;
              break;
            }
            newest = Math.max(newest, thread.updatedAt);
            let resolvedThread = thread;
            if (!thread.gitInfo?.originUrl?.trim()) {
              if (!repositories.has(thread.cwd))
                repositories.set(thread.cwd, await localRepository(thread.cwd));
              const repo = repositories.get(thread.cwd);
              if (repo)
                resolvedThread = {
                  ...thread,
                  gitInfo: { ...thread.gitInfo, originUrl: repo },
                };
            }
            const project = resolveProject(this.projects, {
              machineId: this.config.machineId,
              cwd: thread.cwd,
              ...(resolvedThread.gitInfo?.originUrl
                ? { repo: resolvedThread.gitInfo.originUrl }
                : {}),
            });
            if (!project) continue;
            ancestry.set(thread.id, resolvedThread);
            const conversation = await resolveCodexConversation(
              resolvedThread,
              async (parentId) => {
                let parent = ancestry.get(parentId);
                if (!parent) {
                  try {
                    parent = z.object({ thread: threadSchema }).parse(
                      await this.reader.request("thread/read", {
                        threadId: parentId,
                        includeTurns: false,
                      }),
                    ).thread;
                  } catch {
                    return null;
                  }
                  if (parent.id !== parentId) return null;
                  ancestry.set(parentId, parent);
                }
                if (!repositories.has(parent.cwd))
                  repositories.set(
                    parent.cwd,
                    await localRepository(parent.cwd),
                  );
                const parentProject = resolveProject(this.projects, {
                  machineId: this.config.machineId,
                  cwd: parent.cwd,
                  ...((parent.gitInfo?.originUrl ??
                  repositories.get(parent.cwd))
                    ? {
                        repo:
                          parent.gitInfo?.originUrl ??
                          repositories.get(parent.cwd)!,
                      }
                    : {}),
                });
                return parentProject?.projectId === project.projectId
                  ? parent
                  : null;
              },
            );
            const automation = automations.lookup(thread.id, Date.now());
            let turnCursor: string | null = null;
            do {
              const turns = turnListSchema.parse(
                await this.reader.request("thread/turns/list", {
                  threadId: thread.id,
                  limit: 50,
                  sortDirection: "desc",
                  itemsView: "full",
                  ...(turnCursor ? { cursor: turnCursor } : {}),
                }),
              );
              for (const turn of turns.data) {
                if (
                  (turn.startedAt ?? thread.createdAt) * 1000 <
                  this.config.since
                )
                  continue;
                const context = this.store.getMeta(`context:${thread.id}`);
                const parsed = context
                  ? launchContextSchema.parse(JSON.parse(context))
                  : {};
                const snapshot = await normalizeTurn({
                  thread: resolvedThread,
                  turn,
                  machine: this.config,
                  signatureKey: this.signatureKey,
                  knownSecrets: this.knownSecrets,
                  observedAt: Date.now(),
                  ...parsed,
                  projectId: project.projectId,
                  conversation,
                  ...(automation ? { automation } : {}),
                });
                if (resolvedThread !== thread)
                  snapshot.run.coverage.push(
                    "Repository resolved from local Git at capture time; native origin unavailable.",
                  );
                if (!conversation)
                  snapshot.run.coverage.push(
                    "Orchestration ancestry unavailable or outside the enrolled project; no thread group inferred.",
                  );
                yield snapshot;
              }
              turnCursor = turns.nextCursor;
            } while (turnCursor);
          }
          cursor = past ? null : page.nextCursor;
        } while (cursor);
        this.store.setMeta(checkpoint, String(newest));
      }
      this.store.setMeta(automationVersion, "1");
      this.store.setMeta(conversationVersion, "1");
    } finally {
      automations.close();
    }
  }
  async close() {
    await this.reader.close();
  }
}
