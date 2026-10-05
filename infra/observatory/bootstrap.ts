// Initial private deployment on the owner-selected Otis machine. Never prints credentials.
import { mkdir, readFile, writeFile, copyFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import { generateKeyPair, exportPKCS8, exportJWK } from "jose";
import { z } from "zod";
import { configSchema } from "../../packages/agentlog/src/config";

const root = resolve(import.meta.dir, "../..");
const runtime = join(homedir(), ".local/share/astack/observatory");
const state = join(homedir(), ".agentlog");
process.umask(0o077);
await mkdir(runtime, { recursive: true, mode: 0o700 });
await mkdir(state, { recursive: true, mode: 0o700 });
async function command(args: string[], cwd = root) {
  const child = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`Command failed: ${args[0]} (${code})`);
  return out.trim();
}
async function exists(path: string) {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
const status = z
  .object({
    Self: z.object({
      DNSName: z.string(),
      UserID: z.union([z.number(), z.string()]),
    }),
    User: z.record(z.string(), z.object({ LoginName: z.string() })),
  })
  .parse(JSON.parse(await command(["tailscale", "status", "--json"])));
const dns = String(status.Self.DNSName).replace(/\.$/, "");
if (dns !== "otis.tail12a0a0.ts.net")
  throw new Error(
    "This bootstrap targets Otis; use the documented procedure on other machines",
  );
const owner = z
  .object({ LoginName: z.string() })
  .parse(status.User[String(status.Self.UserID)]).LoginName;
const cloud = `https://${dns}:8451`;
const site = `https://${dns}:8452`;
const web = `https://${dns}:8450`;
const envPath = join(runtime, ".env");
if (!(await exists(envPath))) {
  const convexImage =
    "ghcr.io/get-convex/convex-backend@sha256:d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4";
  const webImage =
    "nginx@sha256:0985e772fb9f729e6fa0980da05fca5d9c468e870eed43071545afa9d2e27d94";
  await command(["docker", "pull", convexImage]);
  await command(["docker", "pull", webImage]);
  await writeFile(
    envPath,
    `CONVEX_IMAGE=${convexImage}\nWEB_IMAGE=${webImage}\nINSTANCE_SECRET=${randomBytes(32).toString("hex")}\nCONVEX_CLOUD_ORIGIN=${cloud}\nCONVEX_SITE_ORIGIN=${site}\n`,
    { mode: 0o600, flag: "wx" },
  );
}
await copyFile(
  join(import.meta.dir, "compose.yml"),
  join(runtime, "compose.yml"),
);
// Runtime compose mounts copied build output, independent of this disposable worktree.
let compose = await readFile(join(runtime, "compose.yml"), "utf8");
compose = compose.replace("../../apps/observatory/dist:", "./dist:");
await writeFile(join(runtime, "compose.yml"), compose);
await copyFile(
  join(import.meta.dir, "nginx.conf"),
  join(runtime, "nginx.conf"),
);
await command(["docker", "compose", "up", "-d", "--wait", "backend"], runtime);
const adminPath = join(runtime, "deployment.env");
if (!(await exists(adminPath))) {
  const key = await command(
    ["docker", "compose", "exec", "-T", "backend", "./generate_admin_key.sh"],
    runtime,
  );
  await writeFile(
    adminPath,
    `CONVEX_SELF_HOSTED_URL=http://127.0.0.1:3220\nCONVEX_SELF_HOSTED_ADMIN_KEY=${JSON.stringify(key)}\n`,
    { mode: 0o600, flag: "wx" },
  );
}
await copyFile(adminPath, join(root, "packages/backend/.env.local"));
await chmod(join(root, "packages/backend/.env.local"), 0o600);
const tokenPath = join(state, "ingest-token");
if (!(await exists(tokenPath)))
  await writeFile(tokenPath, randomBytes(32).toString("hex") + "\n", {
    mode: 0o600,
    flag: "wx",
  });
const configPath = join(state, "config.json");
if (!(await exists(configPath)))
  await command([
    "bun",
    join(root, "packages/agentlog/src/cli.ts"),
    "--state",
    state,
    "init",
    "--endpoint",
    `${site}/agentlog/ingest`,
    "--token-file",
    tokenPath,
  ]);
const config = configSchema.parse(
  JSON.parse(await readFile(configPath, "utf8")),
);
// Capture all persisted history by default; an explicit since can limit a backfill.
if (!(await exists(join(runtime, "initialized")))) {
  config.since = 0;
  config.machineName = "Otis";
  await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", {
    mode: 0o600,
  });
}
const settingsPath = join(runtime, "backend-settings.env");
if (!(await exists(settingsPath))) {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const pem = await exportPKCS8(keys.privateKey);
  const jwk = await exportJWK(keys.publicKey);
  jwk.kid = "observatory-v1";
  jwk.alg = "RS256";
  jwk.use = "sig";
  const token = (await readFile(tokenPath, "utf8")).trim();
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  const digest = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  const settings = {
    OBSERVATORY_OWNER: owner,
    OBSERVATORY_AUTH_ISSUER: site,
    OBSERVATORY_UI_ORIGIN: web,
    OBSERVATORY_SIGNING_KEY: pem,
    OBSERVATORY_JWKS_URI: `data:application/json;base64,${Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64")}`,
    AGENTLOG_MACHINES: JSON.stringify([
      { machineId: config.machineId, tokenHash: digest },
    ]),
  };
  await writeFile(
    settingsPath,
    Object.entries(settings)
      .map(([name, value]) => `${name}=${JSON.stringify(value)}`)
      .join("\n") + "\n",
    { mode: 0o600, flag: "wx" },
  );
}
const viewerPath = join(runtime, "viewer-access-key");
if (!(await exists(viewerPath)))
  await writeFile(viewerPath, randomBytes(32).toString("hex") + "\n", {
    mode: 0o600,
    flag: "wx",
  });
let settings = await readFile(settingsPath, "utf8");
if (!settings.includes("OBSERVATORY_OWNER_ID=")) {
  settings += `OBSERVATORY_OWNER_ID=${crypto.randomUUID()}\n`;
  await writeFile(settingsPath, settings, { mode: 0o600 });
}
if (!settings.includes("OBSERVATORY_VIEWER_TOKEN_HASH=")) {
  settings += `OBSERVATORY_VIEWER_TOKEN_HASH=${createHash("sha256")
    .update((await readFile(viewerPath, "utf8")).trim())
    .digest("hex")}\n`;
  await writeFile(settingsPath, settings, { mode: 0o600 });
}
// Pass exact values through private files; dotenv does not unescape embedded JSON quotes.
const valuesDirectory = join(runtime, "environment-values");
await mkdir(valuesDirectory, { recursive: true, mode: 0o700 });
for (const line of settings.split("\n")) {
  const index = line.indexOf("=");
  if (index < 1) continue;
  const name = line.slice(0, index);
  const encoded = line.slice(index + 1);
  if (!/^[A-Z_]+$/.test(name)) throw new Error("Invalid setting name");
  const value = encoded.startsWith('"')
    ? JSON.parse(encoded)
    : encoded.startsWith("'")
      ? encoded.slice(1, -1)
      : encoded;
  if (typeof value !== "string") throw new Error("Invalid setting value");
  const file = join(valuesDirectory, name);
  await writeFile(file, value, { mode: 0o600 });
  await command(
    ["bunx", "convex", "env", "set", name, "--from-file", file],
    join(root, "packages/backend"),
  );
}
await command(
  ["bunx", "convex", "dev", "--once", "--typecheck", "disable"],
  join(root, "packages/backend"),
);
await writeFile(
  join(root, "apps/observatory/.env.local"),
  `VITE_CONVEX_URL=${cloud}\nVITE_CONVEX_SITE_URL=${site}\n`,
  { mode: 0o600 },
);
for (const [port, target] of [
  [8451, 3220],
  [8452, 3221],
] as const)
  await command([
    "tailscale",
    "serve",
    "--bg",
    `--https=${port}`,
    "--yes",
    `http://127.0.0.1:${target}`,
  ]);
await writeFile(join(runtime, "initialized"), new Date().toISOString() + "\n", {
  mode: 0o600,
});
process.stdout.write(
  JSON.stringify({
    runtime,
    state,
    web,
    cloud,
    site,
    machineId: config.machineId,
    backend: "ready",
  }) + "\n",
);
