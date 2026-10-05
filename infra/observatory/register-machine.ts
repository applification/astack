import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";

const file = process.argv[2];
if (!file)
  throw new Error(
    "Usage: bun infra/observatory/register-machine.ts enrollment.json",
  );
const enrollment = z
  .object({
    machineId: z.string().uuid(),
    machineName: z.string(),
    tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict()
  .parse(JSON.parse(await readFile(resolve(file), "utf8")));
const runtime = join(homedir(), ".local/share/astack/observatory");
const settingsPath = join(runtime, "backend-settings.env");
const settings = await readFile(settingsPath, "utf8");
const encoded = settings
  .split("\n")
  .find((line) => line.startsWith("AGENTLOG_MACHINES="))
  ?.slice("AGENTLOG_MACHINES=".length);
if (!encoded) throw new Error("Initialize the private Otis backend first");
const credentials = z
  .array(
    z.object({
      machineId: z.string().uuid(),
      tokenHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
  )
  .max(100)
  .parse(
    JSON.parse(
      encoded.startsWith('"') ? z.string().parse(JSON.parse(encoded)) : encoded,
    ),
  );
const next = [
  ...credentials.filter((value) => value.machineId !== enrollment.machineId),
  { machineId: enrollment.machineId, tokenHash: enrollment.tokenHash },
];
if (next.length > 100) throw new Error("Machine limit reached");
const value = JSON.stringify(next);
const valueFile = join(runtime, "environment-values/AGENTLOG_MACHINES");
await writeFile(valueFile, value, { mode: 0o600 });
execFileSync(
  "bunx",
  ["convex", "env", "set", "AGENTLOG_MACHINES", "--from-file", valueFile],
  { cwd: resolve(import.meta.dir, "../../packages/backend"), stdio: "ignore" },
);
await writeFile(
  settingsPath,
  settings.replace(
    /^AGENTLOG_MACHINES=.*$/m,
    `AGENTLOG_MACHINES=${JSON.stringify(value)}`,
  ),
  { mode: 0o600 },
);
process.stdout.write(
  `Registered machine ${enrollment.machineId}. Existing credentials retained.\n`,
);
