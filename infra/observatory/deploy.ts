import { cp, mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve, join } from "node:path";
import { execFileSync } from "node:child_process";

import { configSchema } from "../../packages/agentlog/src/config";
import { installBackendStartup } from "./startup";

const root = resolve(import.meta.dir, "../..");
const runtime = join(homedir(), ".local/share/astack/observatory");
const state = join(homedir(), ".agentlog");
function run(
  args: string[],
  cwd = root,
  environment: Record<string, string> = {},
) {
  execFileSync(args[0] ?? "", args.slice(1), {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...environment },
  });
}
const deploymentEnvironment = await readFile(join(runtime, ".env"), "utf8");
const cloud = deploymentEnvironment.match(/^CONVEX_CLOUD_ORIGIN=(.+)$/m)?.[1];
const site = deploymentEnvironment.match(/^CONVEX_SITE_ORIGIN=(.+)$/m)?.[1];
if (
  !cloud ||
  !site ||
  new URL(cloud).protocol !== "https:" ||
  new URL(site).protocol !== "https:"
)
  throw new Error(
    "The private deployment needs configured HTTPS Convex origins.",
  );
run(["bun", "run", "observatory:build"], root, {
  VITE_CONVEX_URL: cloud,
  VITE_CONVEX_SITE_URL: site,
});
await writeFile(
  join(runtime, "compose.yml"),
  (await readFile(join(root, "infra/observatory/compose.yml"), "utf8")).replace(
    "../../apps/observatory/dist:",
    "./dist:",
  ),
);
await cp(join(root, "apps/observatory/dist"), join(runtime, "dist"), {
  recursive: true,
});
await mkdir(join(runtime, "bin"), { recursive: true, mode: 0o700 });
const candidate = join(runtime, "bin/agentlog.next");
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
await rename(candidate, join(runtime, "bin/agentlog"));
const config = configSchema.parse(
  JSON.parse(await readFile(join(state, "config.json"), "utf8")),
);
config.codexBinary = execFileSync("which", ["codex"], {
  encoding: "utf8",
}).trim();
await writeFile(
  join(state, "config.json"),
  JSON.stringify(config, null, 2) + "\n",
  { mode: 0o600 },
);
run(["docker", "compose", "up", "-d", "--wait"], runtime);
run(
  ["docker", "compose", "exec", "-T", "web", "nginx", "-s", "reload"],
  runtime,
);
run([
  "tailscale",
  "serve",
  "--bg",
  "--https=8450",
  "--yes",
  "http://127.0.0.1:4180",
]);
run([
  "tailscale",
  "serve",
  "--bg",
  "--https=8453",
  "--yes",
  "http://127.0.0.1:6792",
]);
if (process.platform === "darwin")
  run([
    join(runtime, "bin/agentlog"),
    "--state",
    state,
    "service",
    "--executable",
    join(runtime, "bin/agentlog"),
  ]);
await installBackendStartup(runtime);
process.stdout.write(
  "Private Observatory deployed; portable collector installed and supervised.\n",
);
