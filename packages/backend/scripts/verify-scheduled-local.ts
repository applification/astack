// Disposable synthetic proof; rejects hosted deployments and never reads Otis credentials.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { generateKeyPair, exportPKCS8, exportJWK } from "jose";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex/_generated/api";
import { LocalStore, forward } from "../../agentlog/src/store";
import { runSchema } from "@astack/agent-observability";
import {
  automationFixtureRuns,
  automationFixtureMachine,
} from "@astack/agent-observability/automation-fixtures";
import { automationKey } from "@astack/agent-observability/automations";

const root = resolve(import.meta.dir, "../../..");
const backend = join(root, "packages/backend");
const env = await readFile(join(backend, ".env.local"), "utf8");
if (!/^CONVEX_DEPLOYMENT=anonymous:/m.test(env))
  throw new Error("Anonymous local deployment required");
const loopback = z.string().regex(/^http:\/\/127\.0\.0\.1:\d+$/);
const url = loopback.parse(env.match(/^CONVEX_URL=(.+)$/m)?.[1]);
const site = loopback.parse(env.match(/^CONVEX_SITE_URL=(.+)$/m)?.[1]);
const directory = join(root, ".proof/observatory-scheduled/local");
await mkdir(directory, { recursive: true });
const viewer = "local-scheduled-viewer";
const machineKeys = new Map([
  [automationFixtureMachine, "local-scheduled-desktop"],
  ["00000000-0000-4000-8000-000000000002", "local-scheduled-laptop"],
]);
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const { publicKey, privateKey } = await generateKeyPair("RS256", {
  extractable: true,
});
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "observatory-v1",
  alg: "RS256",
  use: "sig",
};
for (const [name, value] of [
  ["OBSERVATORY_AUTH_ISSUER", site],
  [
    "OBSERVATORY_JWKS_URI",
    "data:application/json;base64," +
      Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64"),
  ],
  ["OBSERVATORY_SIGNING_KEY", await exportPKCS8(privateKey)],
  ["OBSERVATORY_OWNER_ID", "00000000-0000-4000-8000-000000000010"],
  ["OBSERVATORY_OWNER", "scheduled-fixture@example.test"],
  ["OBSERVATORY_VIEWER_TOKEN_HASH", hash(viewer)],
  ["OBSERVATORY_UI_ORIGIN", "http://127.0.0.1:7412"],
  [
    "AGENTLOG_MACHINES",
    JSON.stringify(
      [...machineKeys].map(([machineId, key]) => ({
        machineId,
        tokenHash: hash(key),
      })),
    ),
  ],
] satisfies [string, string][]) {
  const child = Bun.spawnSync(
    ["bun", "x", "--no-install", "convex", "env", "set", name, "--", value],
    { cwd: backend, stdout: "pipe", stderr: "pipe" },
  );
  if (child.exitCode !== 0)
    throw new Error("Local environment setup failed: " + name);
}
const { adminKey } = z
  .object({ adminKey: z.string() })
  .parse(
    JSON.parse(
      await readFile(
        join(backend, ".convex/local/default/config.json"),
        "utf8",
      ),
    ),
  );
const push = Bun.spawnSync(
  [
    "bun",
    "x",
    "--no-install",
    "convex",
    "deploy",
    "--url",
    url,
    "--admin-key",
    adminKey,
    "--yes",
    "--typecheck",
    "disable",
  ],
  {
    cwd: backend,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
  },
);
if (push.exitCode !== 0) throw new Error("Local backend push failed");
const session = await fetch(site + "/auth/session", {
  method: "POST",
  headers: { authorization: "Bearer " + viewer },
});
if (!session.ok) throw new Error("Local owner authentication failed");
const { token } = z.object({ token: z.string() }).parse(await session.json());
const owner = new ConvexHttpClient(url);
owner.setAuth(token);
const anonymous = new ConvexHttpClient(url);
let anonymousDenied = false;
try {
  await anonymous.query(api.observatory.runs, {
    filters: [{ dimension: "scheduled", value: "yes" }],
    paginationOpts: { numItems: 10, cursor: null },
  });
} catch {
  anonymousDenied = true;
}
if (!anonymousDenied) throw new Error("Anonymous scheduled query was allowed");
const projectId = crypto.randomUUID();
const cwd = "/fixture/scheduled/" + projectId;
const project = {
  projectId,
  name: "Scheduled tasks fixture",
  enabled: true,
  repositories: [],
  folders: [...machineKeys.keys()].map((machineId) => ({
    machineId,
    path: cwd,
  })),
};
await owner.mutation(api.projects.save, { project });
const runs = automationFixtureRuns().map((run) => ({
  ...run,
  id: run.id + ":" + projectId,
  cwd,
  projectId,
}));
for (const [machineId, credential] of machineKeys) {
  const store = new LocalStore(join(directory, projectId, machineId));
  try {
    store.setMeta("projectPolicy", JSON.stringify([project]));
    for (const run of runs.filter((run) => run.machineId === machineId))
      store.put({ kind: "run", value: run });
    for (let batch = 0; store.pending() && batch < 20; batch++)
      await forward(
        store,
        { endpoint: site + "/agentlog/ingest", machineId },
        credential,
      );
    if (store.pending()) throw new Error("Local fixture queue did not drain");
  } finally {
    store.close();
  }
}
const scoped = await owner.query(api.observatory.runs, {
  projectId,
  filters: [{ dimension: "scheduled", value: "yes" }],
  paginationOpts: { numItems: 100, cursor: null },
});
if (scoped.page.length !== 5 || !scoped.isDone)
  throw new Error("Scheduled listing mismatch");
const scheduled = scoped.page.map((value) =>
  runSchema.parse(JSON.parse(value)),
);
if (scheduled.some((run) => run.contentCapture || run.outcome !== "unknown"))
  throw new Error("Capture changed privacy or outcomes");
const first = runs.find((run) => run.sessionId === "fixture-latest");
if (!first) throw new Error("Missing latest fixture");
const taskKey = automationKey(first);
if (!taskKey) throw new Error("Missing fixture identity");
const history = await owner.query(api.observatory.runs, {
  projectId,
  filters: [{ dimension: "automation", value: taskKey }],
  paginationOpts: { numItems: 100, cursor: null },
});
if (
  history.page.length !== 2 ||
  history.page.some(
    (value) =>
      runSchema.parse(JSON.parse(value)).machineId !== automationFixtureMachine,
  )
)
  throw new Error("Task history merged machines");
await writeFile(
  join(directory, "results.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      backend: url,
      site,
      projectId,
      taskKey,
      latestRunId: first.id,
      anonymousDenied,
      runs: runs.length,
      scheduled: scheduled.length,
      history: history.page.length,
      metadataOnly: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Local scheduled-task proof passed: 6 persisted runs, 5 scheduled, 2 desktop task runs; anonymous reads denied and outcomes unchanged.",
);
