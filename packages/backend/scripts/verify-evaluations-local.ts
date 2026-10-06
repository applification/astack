// Disposable local proof only. Never loads Otis credentials or contacts a hosted deployment.
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { generateKeyPair, exportPKCS8, exportJWK } from "jose";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex/_generated/api";
import { LocalStore, forward } from "../../agentlog/src/store";
import { importEvaluation } from "../../agentlog/src/evaluations";
import { savedEditProof } from "../../agentlog/src/evaluation-proof";
import { evaluationManifestSchema } from "@astack/agent-observability/evaluations";
import {
  evaluationDetailSchema,
  evaluationSummarySchema,
} from "@astack/agent-observability/evaluation-view";
import {
  evaluationFixture,
  evaluationRun,
  evaluationPrompt,
  fixtureAssessment,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";

const root = resolve(import.meta.dir, "../../..");
const backend = join(root, "packages/backend");
const env = await readFile(join(backend, ".env.local"), "utf8");
if (!/^CONVEX_DEPLOYMENT=anonymous:/m.test(env))
  throw new Error("An anonymous local deployment is required");
const loopback = z.string().regex(/^http:\/\/127\.0\.0\.1:\d+$/);
const url = loopback.parse(env.match(/^CONVEX_URL=(.+)$/m)?.[1]);
const site = loopback.parse(env.match(/^CONVEX_SITE_URL=(.+)$/m)?.[1]);
const directory = join(root, ".proof/observatory-evals/local");
await mkdir(directory, { recursive: true, mode: 0o700 });
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const ownerId = "00000000-0000-4000-8000-000000000010";
const viewer = "local-evaluation-viewer";
const machine = "local-evaluation-machine";
const { publicKey, privateKey } = await generateKeyPair("RS256", {
  extractable: true,
});
const jwk = {
  ...(await exportJWK(publicKey)),
  kid: "observatory-v1",
  alg: "RS256",
  use: "sig",
};
const values: [string, string][] = [
  ["OBSERVATORY_AUTH_ISSUER", site],
  [
    "OBSERVATORY_JWKS_URI",
    "data:application/json;base64," +
      Buffer.from(JSON.stringify({ keys: [jwk] })).toString("base64"),
  ],
  ["OBSERVATORY_SIGNING_KEY", await exportPKCS8(privateKey)],
  ["OBSERVATORY_OWNER_ID", ownerId],
  ["OBSERVATORY_OWNER", "local-evaluation@example.test"],
  ["OBSERVATORY_VIEWER_TOKEN_HASH", hash(viewer)],
  ["OBSERVATORY_UI_ORIGIN", "http://127.0.0.1:7410"],
  [
    "AGENTLOG_MACHINES",
    JSON.stringify([{ machineId: fixtureMachine, tokenHash: hash(machine) }]),
  ],
];
for (const [name, value] of values) {
  const child = Bun.spawnSync(
    ["bun", "x", "--no-install", "convex", "env", "set", name, "--", value],
    { cwd: backend, stdout: "pipe", stderr: "pipe" },
  );
  if (child.exitCode !== 0)
    throw new Error(
      "Local fixture environment could not be configured: " + name,
    );
}
const pushed = Bun.spawnSync(
  ["bun", "x", "--no-install", "convex", "codegen", "--typecheck", "disable"],
  {
    cwd: backend,
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
  },
);
if (pushed.exitCode !== 0) throw new Error("Local fixture backend push failed");
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
  await anonymous.query(api.evaluations.list, {
    paginationOpts: { numItems: 20, cursor: null },
  });
} catch {
  anonymousDenied = true;
}
if (!anonymousDenied) throw new Error("Anonymous read was not denied");
const project = {
  projectId: fixtureProject,
  name: "Saved-edit evaluation fixture",
  enabled: true,
  repositories: [],
  folders: [{ machineId: fixtureMachine, path: "/fixture" }],
};
await owner.mutation(api.projects.save, { project });
const results = [];
for (const [variant, verdict] of [
  ["defective", "fail"],
  ["fixed", "pass"],
  ["unavailable", "inconclusive"],
] as const) {
  const proof = await savedEditProof(variant, directory);
  const original = evaluationFixture(verdict, proof);
  const nonce = crypto.randomUUID();
  const runs = ["reproduce", "repair"].map((turn) => ({
    ...evaluationRun(turn),
    id: evaluationRun(turn).id + ":" + nonce,
    sessionId: "fixture:" + nonce,
  }));
  const first = runs[0];
  if (!first) throw new Error("Fixture missing original turn");
  const prompt = {
    ...evaluationPrompt(),
    id: first.id + ":prompt",
    runId: first.id,
  };
  const { id: _, machineId: _machine, ...content } = original;
  const manifest = evaluationManifestSchema.parse({
    ...content,
    id: nonce,
    createdAt: Date.now(),
    title: "Saved edits / " + variant,
    runIds: runs.map((run) => run.id),
    intent: {
      ...original.intent,
      source: { runId: prompt.runId, eventId: prompt.id },
    },
  });
  const store = new LocalStore(join(directory, "queue-" + nonce));
  let id: string;
  try {
    store.setMeta("projectPolicy", JSON.stringify([project]));
    for (const run of runs) {
      store.put({ kind: "run", value: run });
      store.put({
        kind: "event",
        value: {
          ...prompt,
          id: run.id + ":request",
          runId: run.id,
          sequence: 1,
          data: {
            content:
              run.id === first.id
                ? "Reproduce the lost edit."
                : "Repair persistence and check a fresh read.",
          },
        },
      });
      store.put({
        kind: "event",
        value: {
          ...prompt,
          id: run.id + ":response",
          runId: run.id,
          sequence: 10,
          kind: "assistant_output",
          data: {
            content:
              run.id === first.id
                ? "The edit is lost on reopen. The fixture reproduces the problem."
                : "Ran save, reopen and fresh disk checks. The retained report records the result.",
          },
        },
      });
    }
    store.put({ kind: "event", value: prompt });
    const imported = importEvaluation(store, fixtureMachine, manifest);
    id = imported.id;
    while (store.pending())
      await forward(
        store,
        { machineId: fixtureMachine, endpoint: site + "/agentlog/ingest" },
        machine,
      );
  } finally {
    store.close();
  }
  const before = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, { evaluationId: id })) ??
        "null",
    ),
  );
  if (
    before.assessments.length ||
    before.runs.some(({ run }) => run.outcome !== "unknown")
  )
    throw new Error("Capture assigned an assessed outcome");
  await owner.mutation(api.evaluations.assess, {
    evaluationId: id,
    requestId: crypto.randomUUID(),
    assessment: JSON.stringify(fixtureAssessment(verdict)),
  });
  const after = evaluationDetailSchema.parse(
    JSON.parse(
      (await owner.query(api.evaluations.detail, { evaluationId: id })) ??
        "null",
    ),
  );
  if (after.assessments[0]?.outcome.verdict !== verdict)
    throw new Error("Fresh assessment read mismatch");
  results.push({
    variant,
    verdict,
    evaluationId: id,
    turns: after.runs.length,
  });
}
const listing = await owner.query(api.evaluations.list, {
  projectId: fixtureProject,
  paginationOpts: { numItems: 20, cursor: null },
});
if (
  listing.page.map((item) => evaluationSummarySchema.parse(JSON.parse(item)))
    .length < 3
)
  throw new Error("Evaluation list missing persisted records");
await writeFile(
  join(directory, "results.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      backend: url,
      site,
      anonymousDenied,
      results,
      viewerKey:
        "Synthetic local fixture credential; see script constant. No production credentials used.",
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Local evaluation proof passed: defective=fail, fixed=pass, unavailable=inconclusive; owner writes persisted, anonymous reads denied.",
);
