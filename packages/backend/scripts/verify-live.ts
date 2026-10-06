// Checks the actual private deployment without writing credentials or raw telemetry to reports.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { z } from "zod";
import { runSchema } from "@astack/agent-observability";

const runtime = join(homedir(), ".local/share/astack/observatory");
const site = "https://otis.tail12a0a0.ts.net:8452";
const cloud = "https://otis.tail12a0a0.ts.net:8451";
const viewer = (
  await readFile(join(runtime, "viewer-access-key"), "utf8")
).trim();
const ingest = (
  await readFile(join(homedir(), ".agentlog/ingest-token"), "utf8")
).trim();
const config = z
  .object({ machineId: z.string() })
  .parse(
    JSON.parse(
      await readFile(join(homedir(), ".agentlog/config.json"), "utf8"),
    ),
  );
const results: Record<string, boolean | number | string> = {
  at: new Date().toISOString(),
};
function assert(name: string, success: boolean) {
  results[name] = success;
  if (!success) throw new Error(`Live proof failed: ${name}`);
}
async function session(key?: string) {
  return fetch(`${site}/auth/session`, {
    method: key ? "POST" : "GET",
    headers: key ? { authorization: `Bearer ${key}` } : {},
    signal: AbortSignal.timeout(10_000),
  });
}
assert("missing_identity_denied", (await session()).status === 401);
assert(
  "wrong_viewer_denied",
  (await session("invalid-viewer-credential")).status === 401,
);
assert("machine_key_cannot_read", (await session(ingest)).status === 401);
assert(
  "missing_ingest_credential_denied",
  (await fetch(`${site}/agentlog/ingest`, { method: "POST" })).status === 401,
);
assert(
  "machine_impersonation_denied",
  (
    await fetch(`${site}/agentlog/ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${ingest}` },
      body: JSON.stringify({
        schemaVersion: 1,
        machineId: crypto.randomUUID(),
        records: [],
      }),
    })
  ).status !== 200,
);
const response = await session(viewer);
assert("owner_session_allowed", response.status === 200);
const { token } = z.object({ token: z.string() }).parse(await response.json());
const owner = new ConvexHttpClient(cloud);
owner.setAuth(token);
const anonymous = new ConvexHttpClient(cloud);
let denied = false;
try {
  await anonymous.query(api.observatory.machines, {});
} catch {
  denied = true;
}
assert("native_query_requires_jwt", denied);
const page = await owner.query(api.observatory.runs, {
  filters: [{ dimension: "machine", value: config.machineId }],
  paginationOpts: { numItems: 100, cursor: null },
});
results.runsInFirstPage = page.page.length;
results.runsWithContentCaptureInPage = page.page
  .map((value) => runSchema.parse(JSON.parse(value)))
  .filter((run) => run.contentCapture).length;
results.runsWithSkillEvidenceInPage = page.page
  .map((value) => runSchema.parse(JSON.parse(value)))
  .filter((run) => run.skills.length > 0).length;
results.capabilityGroupsInFirstPage = (
  await owner.query(api.observatory.capabilities, {
    paginationOpts: { numItems: 100, cursor: null },
  })
).page.length;
const stable = page.page
  .map((value) => runSchema.parse(JSON.parse(value)))
  .find((run) => run.completedAt !== null && run.contentCapture);
if (!stable) throw new Error("A captured completed run is required");
const before = await owner.query(api.observatory.run, { runId: stable.id });
const trace = await owner.query(api.observatory.trace, {
  runId: stable.id,
  paginationOpts: { numItems: 100, cursor: null },
});
assert("real_persisted_trace_present", trace.page.length > 0);
results.traceEventsInFirstPage = trace.page.length;
assert(
  "redacted_content_present",
  trace.page.some((value) => {
    const event = z
      .object({ data: z.record(z.string(), z.json()) })
      .parse(JSON.parse(value));
    return ["content", "command", "output", "arguments", "result"].some(
      (key) => {
        const detail = event.data[key];
        return (
          detail !== undefined &&
          detail !== null &&
          detail !== "" &&
          detail !== "[WITHHELD]"
        );
      },
    );
  }),
);
if (process.env.OBSERVATORY_RESTART_PROOF === "1") {
  execFileSync("docker", ["compose", "restart", "backend"], {
    cwd: runtime,
    stdio: "ignore",
  });
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      ready = (
        await fetch("http://127.0.0.1:3220/version", {
          signal: AbortSignal.timeout(1000),
        })
      ).ok;
    } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert("backend_ready_after_restart", ready);
  assert(
    "same_run_retained_after_restart",
    (await owner.query(api.observatory.run, { runId: stable.id })) === before,
  );
}
const directory = resolve(import.meta.dir, "../../../.proof/agent-observatory");
await mkdir(directory, { recursive: true });
await writeFile(
  join(directory, "live-service.json"),
  JSON.stringify(results, null, 2) + "\n",
);
process.stdout.write(JSON.stringify(results) + "\n");
