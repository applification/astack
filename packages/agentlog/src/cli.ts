#!/usr/bin/env bun
import { Command } from "commander";
import { createHash, randomBytes } from "node:crypto";
import { installService } from "./service";
import { spawn } from "node:child_process";
import { writeFile, readFile, mkdir } from "node:fs/promises";
import { resolve, join, basename } from "node:path";
import { z } from "zod";
import { workReferenceSchema, eventSchema } from "@astack/agent-observability";
import { initialize, defaultStateDir, loadConfig } from "./config";
import { collect, health } from "./collector";
import { captureHook, hookDefinitions } from "./hooks";
import { LocalStore } from "./store";
import { environmentSecrets } from "@astack/agent-observability/redaction";
import { linkSession, refreshRun } from "./context";
import { runIdentity } from "./adapters/codex";
import { approvedRun } from "./projects";
import { configureNaming, namingConfigSchema, nameActivities } from "./naming";

const program = new Command()
  .name("agentlog")
  .description("Private, fail-open agent telemetry collector")
  .version("0.1.0")
  .option("--state <directory>", "Private state directory", defaultStateDir());
const state = () => resolve(z.string().parse(program.opts().state));
program
  .command("names-configure")
  .description(
    "Configure the independent owner-authenticated Codex naming worker",
  )
  .requiredOption("--backend-url <url>")
  .requiredOption("--auth-url <url>", "Private Observatory /auth/session URL")
  .requiredOption(
    "--viewer-token-file <path>",
    "Owner viewer credential file, separate from machine ingestion",
  )
  .option("--codex-home <path>", "Codex home signed in with ChatGPT")
  .option("--model <model>", "Subscription model", "gpt-6-luna")
  .action(async (options: unknown) => {
    const args = z
      .object({
        backendUrl: z.string(),
        authUrl: z.string(),
        viewerTokenFile: z.string(),
        codexHome: z.string().optional(),
        model: z.string(),
      })
      .parse(options);
    const config = await loadConfig(state());
    const home = args.codexHome ?? config.homes[0]?.path;
    if (!home) throw new Error("No signed-in Codex home configured");
    await configureNaming(
      state(),
      namingConfigSchema.parse({
        ...args,
        viewerTokenFile: resolve(args.viewerTokenFile),
        codexHome: resolve(home),
        codexBinary: config.codexBinary,
      }),
    );
    process.stdout.write(
      "Naming configured. Run agentlog names --backfill, or install its separate names-service.\n",
    );
  });
program
  .command("names")
  .description(
    "Generate cached Work and activity names independently of capture",
  )
  .option(
    "--once",
    "Process at most one backfill page and one ready naming batch",
  )
  .option("--backfill", "Resume queuing historical eligible requests")
  .action(async (options: unknown) => {
    const args = z
      .object({
        once: z.boolean().optional(),
        backfill: z.boolean().optional(),
      })
      .parse(options);
    const controller = new AbortController();
    process.once("SIGINT", () => controller.abort());
    process.once("SIGTERM", () => controller.abort());
    const result = await nameActivities(state(), {
      ...args,
      signal: controller.signal,
    });
    process.stdout.write(JSON.stringify(result) + "\n");
  });
program
  .command("names-service")
  .requiredOption("--executable <path>")
  .action(async (options: unknown) => {
    const args = z.object({ executable: z.string() }).parse(options);
    await installService(state(), resolve(args.executable), "names");
    process.stdout.write(
      "Naming registered with launchd independently of the collector.\n",
    );
  });
program
  .command("content")
  .description(
    "Enable redacted conversation/tool content, or capture metadata only",
  )
  .argument("<mode>", "on or off")
  .action(async (mode: unknown) => {
    const captureContent = z.enum(["on", "off"]).parse(mode) === "on";
    const config = await loadConfig(state());
    await writeFile(
      join(state(), "config.json"),
      JSON.stringify({ ...config, captureContent }, null, 2) + "\n",
      { mode: 0o600 },
    );
    if (config.captureContent !== captureContent) {
      const store = new LocalStore(state());
      try {
        store.resetCaptureCheckpoints();
      } finally {
        store.close();
      }
    }
    process.stdout.write(
      `${captureContent ? "Redacted content" : "Metadata-only"} capture configured. Restart the collector to apply and re-read available history.\n`,
    );
  });
program
  .command("backfill")
  .option("--since <date>", "ISO date; omitted captures all persisted history")
  .action(async (options: unknown) => {
    const args = z.object({ since: z.string().optional() }).parse(options);
    const config = await loadConfig(state());
    const since = args.since ? Date.parse(args.since) : 0;
    if (!Number.isFinite(since) || since < 0) throw new Error("Invalid date");
    await writeFile(
      join(state(), "config.json"),
      JSON.stringify({ ...config, since }, null, 2) + "\n",
      { mode: 0o600 },
    );
    const store = new LocalStore(state());
    try {
      store.resetCaptureCheckpoints();
    } finally {
      store.close();
    }
    process.stdout.write(
      "Backfill configured. Restart the collector; existing identities and redacted records are preserved.\n",
    );
  });
program
  .command("init")
  .requiredOption("--endpoint <url>")
  .option("--token-file <path>")
  .option("--codex-home <path>")
  .action(async (options: unknown) => {
    const args = z
      .object({
        endpoint: z.string(),
        tokenFile: z.string().optional(),
        codexHome: z.string().optional(),
      })
      .parse(options);
    const tokenFile = args.tokenFile
      ? resolve(args.tokenFile)
      : join(state(), "ingest-token");
    if (!args.tokenFile) {
      await mkdir(state(), { recursive: true, mode: 0o700 });
      await writeFile(tokenFile, randomBytes(32).toString("hex") + "\n", {
        mode: 0o600,
        flag: "wx",
      });
    }
    const config = await initialize(state(), {
      endpoint: args.endpoint,
      tokenFile,
      ...(args.codexHome ? { codexHome: resolve(args.codexHome) } : {}),
    });
    process.stdout.write(
      JSON.stringify({
        machineId: config.machineId,
        machineName: config.machineName,
        config: join(state(), "config.json"),
      }) + "\n",
    );
  });
program
  .command("enrollment")
  .requiredOption("--output <path>")
  .action(async (options: unknown) => {
    const args = z.object({ output: z.string() }).parse(options);
    const config = await loadConfig(state());
    const token = (await readFile(config.tokenFile, "utf8")).trim();
    await writeFile(
      resolve(args.output),
      JSON.stringify(
        {
          machineId: config.machineId,
          machineName: config.machineName,
          tokenHash: createHash("sha256").update(token).digest("hex"),
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    process.stdout.write(
      "Enrollment written. It contains a credential hash, never the ingestion key.\n",
    );
  });
program
  .command("service")
  .requiredOption("--executable <path>")
  .action(async (options: unknown) => {
    const args = z.object({ executable: z.string() }).parse(options);
    await installService(state(), resolve(args.executable));
    process.stdout.write(
      "Collector registered with launchd. Verify source/forward health with agentlog status.\n",
    );
  });
program
  .command("outcome")
  .requiredOption("--session <id>")
  .requiredOption("--turn <id>")
  .requiredOption("--value <outcome>")
  .action(async (options: unknown) => {
    const args = z
      .object({
        session: z.string(),
        turn: z.string(),
        value: z.enum(["unknown", "success", "failure"]),
      })
      .parse(options);
    const config = await loadConfig(state());
    const store = new LocalStore(state(), environmentSecrets(process.env));
    try {
      const run = approvedRun(
        store,
        runIdentity(config.machineId, args.session, args.turn),
      );
      if (!run) throw new Error("Run outside enabled project capture");
      store.put({
        kind: "run",
        value: { ...run, outcome: args.value },
      });
    } finally {
      store.close();
    }
  });
program
  .command("collect")
  .option("--once")
  .action(async (options: unknown) => {
    const args = z.object({ once: z.boolean().optional() }).parse(options);
    const controller = new AbortController();
    process.once("SIGINT", () => controller.abort());
    process.once("SIGTERM", () => controller.abort());
    const result = await collect(state(), {
      once: args.once,
      signal: controller.signal,
    });
    if (result) process.stdout.write(JSON.stringify(result) + "\n");
  });
program.command("status").action(async () => {
  process.stdout.write(
    JSON.stringify(health(state(), await loadConfig(state())), null, 2) + "\n",
  );
});
program.command("hook").action(async () => {
  // Always exit successfully and emit no feedback that could alter the agent loop.
  try {
    const raw = await Bun.stdin.text();
    if (raw.length <= 4 * 1024 * 1024)
      await captureHook(state(), JSON.parse(raw));
  } catch {
  } finally {
    process.stdout.write("{}\n");
    process.exitCode = 0;
  }
});
program
  .command("hooks")
  .requiredOption("--executable <path>")
  .option(
    "--install",
    "Merge into the first configured Codex home; native trust review is still required",
  )
  .action(async (options: unknown) => {
    const args = z
      .object({ executable: z.string(), install: z.boolean().optional() })
      .parse(options);
    const definitions = hookDefinitions(resolve(args.executable), state());
    if (!args.install) {
      process.stdout.write(JSON.stringify(definitions, null, 2) + "\n");
      return;
    }
    const config = await loadConfig(state());
    const home = config.homes[0];
    if (!home) throw new Error("No Codex home");
    const path = join(home.path, "hooks.json");
    const existingSchema = z
      .object({ hooks: z.record(z.string(), z.array(z.unknown())).default({}) })
      .passthrough();
    let existing = existingSchema.parse({});
    try {
      existing = existingSchema.parse(JSON.parse(await readFile(path, "utf8")));
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
    for (const [name, groups] of Object.entries(definitions.hooks)) {
      const prior = existing.hooks[name] ?? [];
      const command = groups[0]?.hooks[0]?.command;
      existing.hooks[name] = [
        ...prior.filter(
          (group) => !JSON.stringify(group).includes(command ?? "__never__"),
        ),
        ...groups,
      ];
    }
    await mkdir(home.path, { recursive: true });
    await writeFile(path, JSON.stringify(existing, null, 2) + "\n", {
      mode: 0o600,
    });
    process.stdout.write(
      "Installed asynchronous hooks. Review and trust them using Codex /hooks. Automatic persisted capture works without hooks.\n",
    );
  });
program
  .command("link")
  .requiredOption("--session <id>")
  .option("--work <id>")
  .option("--project <id>")
  .option("--url <url>")
  .action(async (options: unknown) => {
    const args = z
      .object({
        session: z.string(),
        work: z.string().optional(),
        project: z.string().optional(),
        url: z.string().optional(),
      })
      .parse(options);
    const store = new LocalStore(state(), environmentSecrets(process.env));
    try {
      linkSession(store, args.session, {
        ...(args.work
          ? {
              work: workReferenceSchema.parse({
                id: args.work,
                ...(args.project ? { projectId: args.project } : {}),
                ...(args.url ? { url: args.url } : {}),
              }),
            }
          : {}),
        ...(args.project ? { projectId: args.project } : {}),
      });
    } finally {
      store.close();
    }
  });
program
  .command("workflow")
  .requiredOption("--session <id>")
  .requiredOption("--turn <id>")
  .requiredOption("--name <name>")
  .requiredOption("--step <step>")
  .action(async (options: unknown) => {
    const args = z
      .object({
        session: z.string(),
        turn: z.string(),
        name: z.string(),
        step: z.string(),
      })
      .parse(options);
    const config = await loadConfig(state());
    const store = new LocalStore(state(), environmentSecrets(process.env));
    try {
      const runId = runIdentity(config.machineId, args.session, args.turn);
      if (!approvedRun(store, runId))
        throw new Error("Run outside enabled project capture");
      store.put({
        kind: "event",
        value: eventSchema.parse({
          id: `${runId}:workflow:${crypto.randomUUID()}`,
          runId,
          sequence: Math.floor(Date.now() / 1000),
          kind: "workflow_step",
          title: args.step,
          timestamp: Date.now(),
          observedAt: Date.now(),
          timing: "hook",
          skill: {
            name: args.name,
            kind: "workflow",
            hash: null,
            provenance: "declared",
            evidence: "declared",
          },
          data: {},
        }),
      });
      const prior = store.getRecord(`run:${runId}`);
      if (prior?.kind === "run") refreshRun(store, prior.value);
    } finally {
      store.close();
    }
  });
program
  .command("run")
  .allowUnknownOption()
  .argument("<command>")
  .argument("[args...]")
  .option("--work <id>")
  .option("--project <id>")
  .action(async (command: string, args: string[], options: unknown) => {
    const context = z
      .object({ work: z.string().optional(), project: z.string().optional() })
      .parse(options);
    const structured =
      basename(command) === "codex" &&
      args.includes("exec") &&
      args.includes("--json");
    const child = spawn(command, args, {
      stdio: structured ? ["inherit", "pipe", "inherit"] : "inherit",
      env: {
        ...process.env,
        ...(context.work ? { ASTACK_WORK_ID: context.work } : {}),
        ...(context.project ? { ASTACK_PROJECT_ID: context.project } : {}),
      },
    });
    if (structured && child.stdout) {
      let pending = "";
      child.stdout.on("data", (chunk: Buffer) => {
        process.stdout.write(chunk);
        pending += chunk.toString("utf8");
        const lines = pending.split("\n");
        pending = lines.pop() ?? "";
        if (pending.length > 1024 * 1024) pending = "";
        for (const line of lines) {
          let raw: unknown;
          try {
            raw = JSON.parse(line);
          } catch {
            continue;
          }
          const start = z
            .object({
              type: z.literal("thread.started"),
              thread_id: z.string(),
            })
            .safeParse(raw);
          if (!start.success) continue;
          // Correlation must never change the launched agent's exit status.
          try {
            const store = new LocalStore(
              state(),
              environmentSecrets(process.env),
            );
            try {
              linkSession(store, start.data.thread_id, {
                ...(context.work
                  ? {
                      work: {
                        id: context.work,
                        ...(context.project
                          ? { projectId: context.project }
                          : {}),
                      },
                    }
                  : {}),
                ...(context.project ? { projectId: context.project } : {}),
              });
            } finally {
              store.close();
            }
          } catch {}
        }
      });
    }
    for (const signal of ["SIGINT", "SIGTERM"] as const)
      process.on(signal, () => child.kill(signal));
    const code = await new Promise<number>((resolve) => {
      child.once("error", () => resolve(127));
      child.once("exit", (code) => resolve(code ?? 1));
    });
    process.exitCode = code;
  });
try {
  await program.parseAsync();
} catch {
  process.stderr.write(
    "agentlog: operation failed. Check configuration and private service availability.\n",
  );
  process.exitCode = 1;
}
