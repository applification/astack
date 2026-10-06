import { spawn } from "node:child_process";
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
  rename,
} from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout as pause } from "node:timers/promises";
import { z } from "zod";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@astack/observatory-backend/api";
import {
  namingInputSchema,
  namingOutputSchema,
  namingModel,
  namingPrompt,
  parseNamingOutput,
  type NamingInput,
  type NamingOutput,
} from "@astack/agent-observability/naming";
import {
  redactText,
  environmentSecrets,
} from "@astack/agent-observability/redaction";

const privateUrl = z.url().refine((value) => {
  const url = new URL(value);
  return (
    !url.username &&
    !url.password &&
    ((url.protocol === "https:" && url.hostname.endsWith(".ts.net")) ||
      (url.protocol === "http:" &&
        ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)))
  );
});
export const namingConfigSchema = z
  .object({
    backendUrl: privateUrl,
    authUrl: privateUrl,
    viewerTokenFile: z.string().min(1),
    codexBinary: z.string().min(1),
    codexHome: z.string().min(1),
    model: z.string().min(1).max(100).default(namingModel),
  })
  .strict();
export type NamingConfig = z.infer<typeof namingConfigSchema>;
export async function configureNaming(directory: string, config: NamingConfig) {
  process.umask(0o077);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  await writeFile(
    join(directory, "names-config.json"),
    JSON.stringify(namingConfigSchema.parse(config), null, 2) + "\n",
    { mode: 0o600 },
  );
}
export async function loadNamingConfig(directory: string) {
  return namingConfigSchema.parse(
    JSON.parse(await readFile(join(directory, "names-config.json"), "utf8")),
  );
}

/** Uses saved Codex ChatGPT auth, with no API-key or project-config fallback. */
export async function generateNames(
  config: Pick<NamingConfig, "codexBinary" | "codexHome" | "model">,
  inputs: readonly NamingInput[],
  options: { signal: AbortSignal; timeoutMs?: number },
): Promise<NamingOutput> {
  options.signal.throwIfAborted();
  const prompt = namingPrompt(inputs);
  const directory = await mkdtemp(join(tmpdir(), "astack-names-"));
  await chmod(directory, 0o700);
  try {
    const schemaFile = join(directory, "schema.json");
    const outputFile = join(directory, "result.json");
    await writeFile(
      schemaFile,
      JSON.stringify(z.toJSONSchema(namingOutputSchema)),
      { mode: 0o600 },
    );
    // Exclude inherited keys and host integrations from the child process.
    const env: NodeJS.ProcessEnv = { CODEX_HOME: config.codexHome };
    for (const key of ["PATH", "HOME", "USER", "TMPDIR", "SystemRoot"])
      if (process.env[key]) env[key] = process.env[key];
    const disabled = [
      "shell_tool",
      "apply_patch_freeform",
      "code_mode_host",
      "multi_agent",
      "plugins",
      "hooks",
      "memories",
      "browser_use",
      "computer_use",
      "image_generation",
      "view_image",
      "skill_search",
      "sleep_tool",
    ];
    const args = [
      "exec",
      "--model",
      config.model,
      "--ephemeral",
      "--ignore-user-config",
      "--sandbox",
      "read-only",
      "--skip-git-repo-check",
      "-C",
      directory,
      "--output-schema",
      schemaFile,
      "--output-last-message",
      outputFile,
      "-c",
      'forced_login_method="chatgpt"',
      "-c",
      'model_reasoning_effort="low"',
      "-c",
      'web_search="disabled"',
      ...disabled.flatMap((feature) => ["--disable", feature]),
      "-",
    ];
    await new Promise<void>((resolve, reject) => {
      const child = spawn(config.codexBinary, args, {
        env,
        cwd: directory,
        detached: process.platform !== "win32",
        stdio: ["pipe", "ignore", "ignore"],
      });
      let interrupted = false;
      const stop = () => {
        interrupted = true;
        try {
          if (process.platform !== "win32" && child.pid)
            process.kill(-child.pid, "SIGKILL");
          else child.kill("SIGKILL");
        } catch {
          /* Already exited. */
        }
      };
      const timer = setTimeout(stop, options.timeoutMs ?? 90_000);
      options.signal.addEventListener("abort", stop, { once: true });
      const cleanup = () => {
        clearTimeout(timer);
        options.signal.removeEventListener("abort", stop);
      };
      child.once("error", () => {
        cleanup();
        reject(new Error("naming_codex_unavailable"));
      });
      child.once("close", (code) => {
        cleanup();
        if (interrupted)
          reject(
            new Error(
              options.signal.aborted ? "naming_cancelled" : "naming_timeout",
            ),
          );
        else if (code !== 0) reject(new Error("naming_codex_failed"));
        else resolve();
      });
      child.stdin.on("error", () => {
        /* Exit handling reports a closed input. */
      });
      child.stdin.end(prompt);
      if (options.signal.aborted) stop();
    });
    if ((await stat(outputFile)).size > 32_000)
      throw new Error("naming_output_too_large");
    const output = parseNamingOutput(
      JSON.parse(await readFile(outputFile, "utf8")),
      inputs,
    );
    const secrets = environmentSecrets(process.env);
    return parseNamingOutput(
      {
        names: output.names.map((name) => ({
          ...name,
          title: redactText(name.title, secrets),
        })),
      },
      inputs,
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const claimSchema = namingInputSchema.extend({ claim: z.string().uuid() });
const backfillSchema = z.object({
  cursor: z.string().nullable(),
  done: z.boolean(),
});
export async function nameActivities(
  directory: string,
  options: { once?: boolean; backfill?: boolean; signal: AbortSignal },
) {
  const config = await loadNamingConfig(directory);
  const boundedFetch: typeof fetch = Object.assign(
    (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
      fetch(input, {
        ...init,
        signal: AbortSignal.any([options.signal, AbortSignal.timeout(15_000)]),
      }),
    { preconnect: fetch.preconnect },
  );
  const client = new ConvexHttpClient(config.backendUrl, {
    fetch: boundedFetch,
    logger: false,
  });
  let authenticatedAt = 0;
  let failures = 0;
  let names = 0;
  let scanned = 0;
  let backfill: z.infer<typeof backfillSchema> = { cursor: null, done: false };
  const cursorFile = join(directory, "names-backfill.json");
  if (options.backfill) {
    try {
      backfill = backfillSchema.parse(
        JSON.parse(await readFile(cursorFile, "utf8")),
      );
    } catch (error) {
      if (!(
        error instanceof Error &&
        "code" in error &&
        error.code === "ENOENT"
      ))
        throw error;
    }
  }
  while (!options.signal.aborted) {
    let claims: z.infer<typeof claimSchema>[] = [];
    try {
      if (!authenticatedAt || Date.now() - authenticatedAt > 10 * 60_000) {
        const credential = (
          await readFile(config.viewerTokenFile, "utf8")
        ).trim();
        const response = await fetch(config.authUrl, {
          method: "POST",
          headers: { authorization: `Bearer ${credential}` },
          signal: AbortSignal.any([
            options.signal,
            AbortSignal.timeout(10_000),
          ]),
        });
        if (!response.ok) throw new Error("naming_auth_unavailable");
        client.setAuth(
          z.object({ token: z.string().min(1) }).parse(await response.json())
            .token,
        );
        authenticatedAt = Date.now();
      }
      if (options.backfill && !backfill.done) {
        const page = await client.mutation(api.naming.backfill, {
          paginationOpts: { cursor: backfill.cursor, numItems: 3 },
        });
        backfill = { cursor: page.continueCursor, done: page.isDone };
        const candidate = `${cursorFile}.${crypto.randomUUID()}.tmp`;
        try {
          await writeFile(candidate, JSON.stringify(backfill), { mode: 0o600 });
          await rename(candidate, cursorFile);
        } finally {
          await rm(candidate, { force: true });
        }
        scanned += page.count;
      }
      claims = z
        .array(claimSchema)
        .parse(await client.mutation(api.naming.claim, {}));
      if (claims.length) {
        const inputs = claims.map(({ claim: _claim, ...input }) => input);
        const result = await generateNames(config, inputs, {
          signal: options.signal,
        });
        names += await client.mutation(api.naming.complete, {
          model: config.model,
          names: result.names.map((name) => {
            const claim = claims.find((item) => item.key === name.key);
            if (!claim) throw new Error("naming_claim_missing");
            return { ...name, claim: claim.claim };
          }),
        });
      }
      failures = 0;
      if (options.once) return { names, scanned };
    } catch {
      if (options.signal.aborted) return { names, scanned };
      failures++;
      authenticatedAt = 0;
      if (claims.length) {
        try {
          await client.mutation(api.naming.fail, {
            claims: claims.map(({ key, claim }) => ({ key, claim })),
          });
        } catch {
          /* Expiring claims allow another worker to recover. */
        }
      }
      // Raw errors and Codex diagnostics can contain private request content.
      process.stderr.write(
        "Naming unavailable; existing headings remain visible.\n",
      );
      if (options.once) throw new Error("naming_unavailable");
    }
    const delay = failures
      ? Math.min(300_000, 5000 * 2 ** Math.min(failures, 6))
      : options.backfill && !backfill.done
        ? 1000
        : 30_000;
    try {
      await pause(delay, undefined, { signal: options.signal });
    } catch {
      if (!options.signal.aborted) throw new Error("naming_wait_failed");
    }
  }
  return { names, scanned };
}
