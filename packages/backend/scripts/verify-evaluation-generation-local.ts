// Owned anonymous local deployment only; no production credentials or private capture.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { z } from "zod";
import { api } from "../convex/_generated/api";
import { LocalStore, forward } from "../../agentlog/src/store";
import { publishEvaluationTasks } from "../../agentlog/src/evaluation-tasks";
import { savedEditProof } from "../../agentlog/src/evaluation-proof";
import {
  evaluationRun,
  evaluationPrompt,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import { evaluationDetailSchema } from "@astack/agent-observability/evaluation-view";
import { evaluateProof } from "@astack/agent-observability/evaluations";

const root = resolve(import.meta.dir, "../../..");
const env = await readFile(join(root, "packages/backend/.env.local"), "utf8");
if (!/^CONVEX_DEPLOYMENT=anonymous:/m.test(env))
  throw new Error("An owned anonymous local deployment is required.");
const loopback = z.string().regex(/^http:\/\/127\.0\.0\.1:\d+$/);
const url = loopback.parse(env.match(/^CONVEX_URL=(.+)$/m)?.[1]);
const site = loopback.parse(env.match(/^CONVEX_SITE_URL=(.+)$/m)?.[1]);
const directory = join(root, ".proof/observatory-generation/local");
await mkdir(directory, { recursive: true, mode: 0o700 });
const state = join(directory, crypto.randomUUID());
await mkdir(state, { mode: 0o700 });
const tokenFile = join(state, "machine-token");
await writeFile(tokenFile, "local-evaluation-machine", { mode: 0o600 });
const config = {
  schemaVersion: 1,
  machineId: fixtureMachine,
  machineName: "Generation fixture",
  endpoint: site + "/agentlog/ingest",
  tokenFile,
  homes: [{ path: state, label: "fixture" }],
  since: 0,
};
await writeFile(join(state, "config.json"), JSON.stringify(config), {
  mode: 0o600,
});
const project = {
  projectId: fixtureProject,
  name: "Generation fixture",
  enabled: true,
  repositories: [],
  folders: [{ machineId: fixtureMachine, path: "/fixture" }],
};
const nonce = crypto.randomUUID();
const first = {
  ...evaluationRun("reproduce"),
  id: evaluationRun("reproduce").id + ":" + nonce,
  sessionId: nonce,
};
const last = {
  ...evaluationRun(),
  id: evaluationRun().id + ":" + nonce,
  sessionId: nonce,
  startedAt: 1500,
};
const prompt = {
  ...evaluationPrompt(),
  id: first.id + ":prompt",
  runId: first.id,
};
function cli(args: string[]) {
  const child = Bun.spawnSync(
    [
      "bun",
      "packages/agentlog/src/cli.ts",
      "--state",
      state,
      "evaluation",
      ...args,
    ],
    { cwd: root, stdout: "pipe", stderr: "pipe" },
  );
  if (child.exitCode !== 0)
    throw new Error("Generation CLI failed: " + args[0]);
  return z
    .object({ taskId: z.string(), state: z.string() })
    .parse(JSON.parse(child.stdout.toString()));
}
const begin = cli([
  "begin",
  "--run",
  first.id,
  "--title",
  "Agent-generated saved edit review",
  "--case",
  "The saved edit survives reopening and a fresh read.",
  "--skill",
  "verify=Observe the reopened edit and independently inspect disk.",
]);
const proof = await savedEditProof("fixed", directory);
const report = {
  ...proof,
  cases: proof.cases.map((item) => ({ ...item, caseId: "C1" })),
};
const proofFile = join(state, "proof.json");
await writeFile(proofFile, JSON.stringify(report), { mode: 0o600 });
const finish = cli([
  "finish",
  "--task",
  begin.taskId,
  "--run",
  last.id,
  "--proof",
  proofFile,
]);
if (finish.state !== "pending")
  throw new Error("Uncaptured delivery did not remain pending.");
const store = new LocalStore(state);
let agentEvaluationId: string;
const buttonRun = {
  ...evaluationRun("repair"),
  id: fixtureMachine + ":codex:button:" + nonce,
  sessionId: "button:" + nonce,
  title: "Explore recipes and movies",
};
try {
  store.setMeta("projectPolicy", JSON.stringify([project]));
  store.put({ kind: "run", value: first });
  store.put({ kind: "event", value: prompt });
  store.put({ kind: "run", value: last });
  store.put({ kind: "run", value: buttonRun });
  store.put({
    kind: "event",
    value: {
      ...prompt,
      id: buttonRun.id + ":prompt",
      runId: buttonRun.id,
      data: {
        content:
          "Explore recipes and movies and record reproducible UX issues.",
      },
    },
  });
  if (
    publishEvaluationTasks(store) !== 1 ||
    publishEvaluationTasks(store) !== 0
  )
    throw new Error("Task was not queued exactly once after capture.");
  agentEvaluationId = fixtureMachine + ":evaluation:" + begin.taskId;
  for (let attempt = 0; store.pending() && attempt < 30; attempt++)
    await forward(store, config, "local-evaluation-machine");
  if (store.pending())
    throw new Error(
      "Generated evaluation was not acknowledged by the backend.",
    );
} finally {
  store.close();
}
const response = await fetch(site + "/auth/session", {
  method: "POST",
  headers: { authorization: "Bearer local-evaluation-viewer" },
});
if (!response.ok) throw new Error("Local owner session failed.");
const { token } = z.object({ token: z.string() }).parse(await response.json());
const owner = new ConvexHttpClient(url);
owner.setAuth(token);
const anonymous = new ConvexHttpClient(url);
const detail = evaluationDetailSchema.parse(
  JSON.parse(
    (await owner.query(api.evaluations.detail, {
      evaluationId: agentEvaluationId,
    })) ?? "null",
  ),
);
if (
  detail.evaluation.runIds.join() !== [first.id, last.id].join() ||
  detail.evaluation.generation?.method !== "agent" ||
  evaluateProof(detail.evaluation).verdict !== "pass" ||
  detail.assessments.length ||
  detail.feedback.length
)
  throw new Error("Persisted agent review mismatch.");
const fallback = await owner.mutation(api.evaluations.generate, {
  runId: last.id,
});
if (fallback.evaluationId !== agentEvaluationId)
  throw new Error("Button duplicated an existing agent evaluation.");
let anonymousDenied = false;
try {
  await anonymous.mutation(api.evaluations.generate, { runId: buttonRun.id });
} catch {
  anonymousDenied = true;
}
if (!anonymousDenied) throw new Error("Anonymous generation was allowed.");
const before = await owner.query(api.evaluations.forRun, {
  runId: buttonRun.id,
});
if (before.length) throw new Error("Button fixture already has an evaluation.");
await writeFile(
  join(directory, "results.json"),
  JSON.stringify(
    {
      backend: url,
      site,
      agentEvaluationId,
      agentRunId: last.id,
      buttonRunId: buttonRun.id,
      anonymousDenied,
      automaticProof: "pass",
      buttonExistingAgent: true,
    },
    null,
    2,
  ) + "\n",
);
console.log(
  "Generation local proof passed: begin/finish capture lag, exactly-once queue/HTTP delivery, actual saved-edit proof, fresh owner read, anonymous denial and existing-agent fallback.",
);
