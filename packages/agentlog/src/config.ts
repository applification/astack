import { mkdir, chmod, readFile, writeFile } from "node:fs/promises";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { z } from "zod";

export const configSchema = z
  .object({
    schemaVersion: z.literal(1),
    machineId: z.string().uuid(),
    machineName: z.string().min(1).max(512),
    endpoint: z.url().refine((value) => {
      const url = new URL(value);
      return (
        (url.protocol === "https:" && url.hostname.endsWith(".ts.net")) ||
        (url.protocol === "http:" &&
          ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname))
      );
    }),
    tokenFile: z.string(),
    codexBinary: z.string().default("codex"),
    homes: z
      .array(z.object({ path: z.string(), label: z.string() }).strict())
      .min(1),
    pollSeconds: z.number().int().min(10).max(3600).default(30),
    captureContent: z.boolean().default(true),
    secretFiles: z.array(z.string().min(1)).max(100).default([]),
    since: z.number().nonnegative(),
  })
  .strict();
export type CollectorConfig = z.infer<typeof configSchema>;
export const defaultStateDir = () => join(homedir(), ".agentlog");
export async function initialize(
  directory: string,
  options: { endpoint: string; tokenFile: string; codexHome?: string },
) {
  process.umask(0o077);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const path = join(directory, "config.json");
  try {
    await readFile(path);
    throw new Error(
      "Already initialized; update the existing config explicitly",
    );
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT"))
      throw error;
  }
  const config = configSchema.parse({
    schemaVersion: 1,
    machineId: crypto.randomUUID(),
    machineName: hostname(),
    endpoint: options.endpoint,
    tokenFile: options.tokenFile,
    homes: [
      {
        path:
          options.codexHome ??
          process.env.CODEX_HOME ??
          join(homedir(), ".codex"),
        label: "default",
      },
    ],
    since: 0,
    codexBinary: Bun.which("codex") ?? "codex",
  });
  await writeFile(path, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
    flag: "wx",
  });
  return config;
}
export async function loadConfig(directory: string): Promise<CollectorConfig> {
  return configSchema.parse(
    JSON.parse(await readFile(join(directory, "config.json"), "utf8")),
  );
}
