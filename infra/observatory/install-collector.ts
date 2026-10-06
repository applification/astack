import { mkdir, rename, readFile, writeFile, access } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { z } from "zod";
import { configSchema } from "../../packages/agentlog/src/config";

const options: Record<string, string> = {};
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key || !value || !["--endpoint", "--codex-home", "--name"].includes(key))
    throw new Error(
      "Usage: bun infra/observatory/install-collector.ts --endpoint <ingestion-url> [--codex-home <path>] [--name <machine-name>]",
    );
  options[key] = value;
}
const args = z
  .object({
    "--endpoint": z.url(),
    "--codex-home": z.string().optional(),
    "--name": z.string().optional(),
  })
  .parse(options);
const root = resolve(import.meta.dir, "../..");
const state = join(homedir(), ".agentlog");
const bin = join(homedir(), ".local/share/astack/observatory/bin");
await mkdir(bin, { recursive: true, mode: 0o700 });
const candidate = join(bin, "agentlog.next");
const executable = join(bin, "agentlog");
function run(command: string[]) {
  execFileSync(command[0] ?? "", command.slice(1), {
    cwd: root,
    stdio: "inherit",
  });
}
run([
  "bun",
  "build",
  "packages/agentlog/src/cli.ts",
  "--compile",
  "--outfile",
  candidate,
]);
if (process.platform === "darwin")
  run(["codesign", "--force", "--sign", "-", candidate]);
await rename(candidate, executable);
let exists = false;
try {
  await access(join(state, "config.json"));
  exists = true;
} catch {}
if (!exists)
  run([
    executable,
    "--state",
    state,
    "init",
    "--endpoint",
    args["--endpoint"],
    ...(args["--codex-home"]
      ? ["--codex-home", resolve(args["--codex-home"])]
      : []),
  ]);
const config = configSchema.parse(
  JSON.parse(await readFile(join(state, "config.json"), "utf8")),
);
if (config.endpoint !== args["--endpoint"])
  throw new Error(
    "Existing endpoint differs; update the existing config explicitly",
  );
config.codexBinary = Bun.which("codex") ?? config.codexBinary;
if (args["--name"]) config.machineName = args["--name"];
await writeFile(
  join(state, "config.json"),
  JSON.stringify(config, null, 2) + "\n",
  { mode: 0o600 },
);
run([
  executable,
  "--state",
  state,
  "enrollment",
  "--output",
  join(state, "enrollment.json"),
]);
if (process.platform === "darwin")
  run([executable, "--state", state, "service", "--executable", executable]);
process.stdout.write(
  "Collector installed. Register enrollment.json on Otis before forwarding can succeed.\n",
);
