import { z } from "zod";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import {
  eventSchema,
  runSchema,
  workReferenceSchema,
} from "@astack/agent-observability";
import {
  environmentSecrets,
  redactText,
} from "@astack/agent-observability/redaction";
import { linkSession, refreshRun } from "./context";
import { runIdentity, capability } from "./adapters/codex";
import { LocalStore } from "./store";
import { loadConfig } from "./config";
import { cachedProjects } from "./projects";
import { resolveProject } from "@astack/agent-observability/projects";

const hookSchema = z.object({
  session_id: z.string(),
  turn_id: z.string().optional(),
  cwd: z.string(),
  hook_event_name: z.string(),
  model: z.string().optional(),
  tool_name: z.string().optional(),
  tool_use_id: z.string().optional(),
  tool_input: z.unknown().optional(),
});
export const hookEvents = [
  "SessionStart",
  "UserPromptSubmit",
  "PostToolUse",
  "Stop",
  "Interrupt",
  "SubagentStart",
  "SubagentStop",
];
export async function captureHook(directory: string, raw: unknown) {
  const hook = hookSchema.parse(raw);
  const config = await loadConfig(directory);
  const token = (await readFile(config.tokenFile, "utf8")).trim();
  const store = new LocalStore(directory, [
    ...environmentSecrets(process.env),
    token,
  ]);
  try {
    const prior = store
      .runsForSession(hook.session_id)
      .find((r) => r.cwd === hook.cwd);
    const project = resolveProject(cachedProjects(store), {
      machineId: config.machineId,
      cwd: hook.cwd,
      ...(prior?.repo ? { repo: prior.repo } : {}),
    });
    if (!project) return;
    const workId = process.env.ASTACK_WORK_ID;
    const projectId = project.projectId;
    if (workId || projectId)
      linkSession(store, hook.session_id, {
        ...(workId
          ? {
              work: workReferenceSchema.parse({
                id: workId,
                ...(projectId ? { projectId } : {}),
              }),
            }
          : {}),
        ...(projectId ? { projectId } : {}),
      });
    if (!hook.turn_id) return;
    const runId = runIdentity(config.machineId, hook.session_id, hook.turn_id);
    const now = Date.now();
    if (hook.tool_use_id)
      store.setMeta(
        `timing:${hook.session_id}:${hook.tool_use_id}`,
        String(now),
      );
    let skill = null;
    if (hook.hook_event_name === "PostToolUse") {
      const input = z
        .object({
          file_path: z.string().optional(),
          path: z.string().optional(),
          command: z.string().optional(),
        })
        .safeParse(hook.tool_input);
      if (input.success) {
        const path =
          input.data.file_path ??
          input.data.path ??
          input.data.command?.match(
            /(?:cat|read_file)\s+['"]?([^'"\s;]+\/(?:SKILL|AGENTS)\.md)/,
          )?.[1];
        if (path) skill = await capability(path, hook.cwd, "read", "use_time");
      }
    }
    const kind =
      hook.hook_event_name === "Interrupt"
        ? "intervention"
        : skill?.kind === "skill"
          ? "skill_loaded"
          : skill
            ? "instruction_loaded"
            : null;
    if (kind) {
      const key = createHash("sha256")
        .update(
          JSON.stringify([
            hook.hook_event_name,
            hook.tool_use_id ?? now,
            skill?.path,
          ]),
        )
        .digest("hex");
      store.put({
        kind: "event",
        value: eventSchema.parse({
          id: `${runId}:hook:${key}`,
          runId,
          sequence: Math.min(2_000_000_000, Math.floor(now / 1000)),
          kind,
          title: skill
            ? `Observed ${skill.kind}: ${skill.name}`
            : "User interrupted the agent",
          timestamp: now,
          observedAt: now,
          timing: "hook",
          ...(skill ? { skill } : {}),
          data: { source: "trusted_async_hook" },
        }),
      });
    }
    const previous = store.getRecord(`run:${runId}`);
    if (previous?.kind === "run") {
      const run = previous.value;
      if (hook.hook_event_name === "Stop") {
        run.completedAt = now;
        run.status = "completed";
      }
      run.lastObservedAt = now;
      refreshRun(store, runSchema.parse(run));
    }
  } finally {
    store.close();
  }
}
export function hookDefinitions(executable: string, directory: string) {
  const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
  const command = `${quote(executable)} --state ${quote(directory)} hook || true`;
  return {
    description:
      "Astack Agent Observatory: asynchronous metadata capture. No agent decisions or context output.",
    hooks: Object.fromEntries(
      hookEvents.map((name) => [
        name,
        [{ hooks: [{ type: "command", command, async: true, timeout: 3 }] }],
      ]),
    ),
  };
}
