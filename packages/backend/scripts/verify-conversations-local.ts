// Requires the disposable evaluation fixture; refuses nonlocal deployments.
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { runSchema, eventSchema } from "@astack/agent-observability";
import {
  evaluationRun,
  fixtureMachine,
  fixtureProject,
} from "@astack/agent-observability/evaluation-fixtures";
import {
  conversationGroupKey,
  conversationGroupSchema,
} from "@astack/agent-observability/conversations";

const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
if (!/^CONVEX_DEPLOYMENT=anonymous:/m.test(env))
  throw new Error("An owned anonymous backend is required");
const url = env.match(/^CONVEX_URL=(.+)$/m)?.[1];
const site = env.match(/^CONVEX_SITE_URL=(.+)$/m)?.[1];
if (
  !url ||
  !site ||
  ![url, site].every((value) => /^http:\/\/127\.0\.0\.1:\d+$/.test(value))
)
  throw new Error("Loopback backend required");
const response = await fetch(`${site}/auth/session`, {
  method: "POST",
  headers: { authorization: "Bearer local-evaluation-viewer" },
});
if (!response.ok)
  throw new Error(
    "Run verify-evaluations-local.ts to establish the disposable fixture first",
  );
const session: { token: string } = await response.json();
const owner = new ConvexHttpClient(url);
owner.setAuth(session.token);
const anonymous = new ConvexHttpClient(url);
const ref = (threadId: string) =>
  ({ kind: "t3", environmentId: "local-synthetic-host", threadId }) as const;
const root = ref("orchestration-root");
const runs = ["request-one", "request-two", "child", "nested"].map(
  (name, index) =>
    runSchema.parse({
      ...evaluationRun(name),
      sessionId: `orchestration-${name}`,
      agent: index % 2 ? "claude" : "codex",
      id: `${fixtureMachine}:synthetic-orchestration:${name}`,
      source: "t3:local-synthetic-host",
      startedAt: 1000 + index,
      conversation: {
        self: index < 2 ? root : ref(name),
        root,
        ...(index >= 2
          ? {
              parent: {
                reference: index === 2 ? root : ref("child"),
                relationship: "subagent",
              },
            }
          : {}),
        hostRun: { id: `app-${name}`, ordinal: index + 1 },
      },
    }),
);
for (const run of runs) {
  const prompt = eventSchema.parse({
    id: run.id + ":prompt",
    runId: run.id,
    sequence: 1,
    kind: "user_prompt",
    title: "Synthetic task request",
    data: { content: `Perform ${run.attemptId}.` },
    timestamp: run.startedAt,
    observedAt: run.startedAt,
    timing: "agent",
  });
  const ingested = await fetch(`${site}/agentlog/ingest`, {
    method: "POST",
    headers: {
      authorization: "Bearer local-evaluation-machine",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      schemaVersion: 1,
      machineId: fixtureMachine,
      records: [
        { revision: 1, record: { kind: "run", value: run } },
        { revision: 1, record: { kind: "event", value: prompt } },
      ],
    }),
  });
  if (!ingested.ok) throw new Error("Synthetic local ingestion failed");
}
const groupId = conversationGroupKey(runs[0]!)!;
const group = conversationGroupSchema.parse(
  JSON.parse(
    (await owner.query(api.conversations.group, {
      groupId,
      projectId: fixtureProject,
    }))!,
  ),
);
if (group.turns !== 4 || group.delegatedTurns !== 2)
  throw new Error("Group membership mismatch");
const first = await owner.query(api.conversations.turns, {
  groupId,
  paginationOpts: { numItems: 2, cursor: null },
});
const second = await owner.query(api.conversations.turns, {
  groupId,
  paginationOpts: { numItems: 2, cursor: first.continueCursor },
});
const terminal = second.isDone
  ? second
  : await owner.query(api.conversations.turns, {
      groupId,
      paginationOpts: { numItems: 2, cursor: second.continueCursor },
    });
if (
  first.page.length !== 2 ||
  second.page.length !== 2 ||
  !terminal.isDone ||
  (!second.isDone && terminal.page.length)
)
  throw new Error("Independent turn pagination mismatch");
const evaluations: string[] = [];
for (const run of runs.slice(0, 2)) {
  const evaluation = await owner.mutation(api.evaluations.generate, {
    runId: run.id,
    projectId: fixtureProject,
  });
  const related = await owner.query(api.conversations.forEvaluation, {
    evaluationId: evaluation.evaluationId,
    projectId: fixtureProject,
  });
  if (related.length !== 1 || JSON.parse(related[0]!).id !== groupId)
    throw new Error("Task/thread association mismatch");
  evaluations.push(evaluation.evaluationId);
}
if (evaluations[0] === evaluations[1])
  throw new Error("Separate task requests were merged");
if (
  (await owner.query(api.conversations.group, {
    groupId,
    projectId: "another-project",
  })) !== null
)
  throw new Error("Project scope leak");
let denied = 0;
for (const query of [
  () => anonymous.query(api.conversations.group, { groupId }),
  () =>
    anonymous.query(api.conversations.groups, {
      paginationOpts: { numItems: 2, cursor: null },
    }),
  () =>
    anonymous.query(api.conversations.turns, {
      groupId,
      paginationOpts: { numItems: 2, cursor: null },
    }),
  () =>
    anonymous.query(api.conversations.forEvaluation, {
      evaluationId: evaluations[0]!,
    }),
]) {
  try {
    await query();
  } catch {
    denied++;
  }
}
if (denied !== 4) throw new Error("Owner authorization mismatch");
const result = {
  environment: "owned anonymous loopback backend",
  synthetic: true,
  turns: group.turns,
  delegatedTurns: group.delegatedTurns,
  pages: [first.page.length, second.page.length],
  separateTaskEvaluations: evaluations.length,
  deniedQueries: denied,
  projectMismatchHidden: true,
};
if (process.argv.includes("--pagination")) {
  const largeRef = (name: string) =>
    ({
      kind: "t3",
      environmentId: "synthetic-range-" + "e".repeat(480),
      threadId: name.padEnd(500, "t"),
    }) as const;
  const seed = (name: string, activity: number) =>
    runSchema.parse({
      ...evaluationRun(name),
      id: `${fixtureMachine}:pagination:${name}`,
      sessionId: `pagination-${name}`,
      source: "t3:local-synthetic-host",
      lastActivityAt: activity,
      conversation: { self: largeRef(name), root: largeRef(name) },
    });
  const ingest = async (values: ReturnType<typeof seed>[]) => {
    const response = await fetch(`${site}/agentlog/ingest`, {
      method: "POST",
      headers: {
        authorization: "Bearer local-evaluation-machine",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: 1,
        machineId: fixtureMachine,
        records: values.map((value) => ({
          revision: 1,
          record: { kind: "run", value },
        })),
      }),
    });
    if (!response.ok) throw new Error("Growing range fixture ingestion failed");
  };
  const rangeTag = String(Date.now());
  const rangeBase = Date.now() + 600_000;
  await ingest([
    seed(rangeTag + "-range-first", rangeBase + 100),
    seed(rangeTag + "-range-last", rangeBase),
  ]);
  const originalRange = await owner.query(api.conversations.groups, {
    projectId: fixtureProject,
    paginationOpts: { numItems: 2, cursor: null },
  });
  for (let index = 0; index < 1300; index += 2)
    await ingest([
      seed(`${rangeTag}-range-${index}`, rangeBase + 50 + index / 13000),
      seed(
        `${rangeTag}-range-${index + 1}`,
        rangeBase + 50 + (index + 1) / 13000,
      ),
    ]);
  const growingRange = await owner.query(api.conversations.groups, {
    projectId: fixtureProject,
    paginationOpts: {
      numItems: 2,
      cursor: null,
      endCursor: originalRange.continueCursor,
    },
  });
  console.log(
    JSON.stringify({
      growingRange: {
        length: growingRange.page.length,
        pageStatus: growingRange.pageStatus,
        splitCursorPresent: !!growingRange.splitCursor,
        isDone: growingRange.isDone,
      },
    }),
  );
  if (!(growingRange.pageStatus === "SplitRequired" || growingRange.pageStatus === "SplitRecommended") || !growingRange.splitCursor)
    throw new Error("Growing reactive page lost its split metadata");
  await mkdir(".proof/orchestration-threads", { recursive: true, mode: 0o700 });
  await writeFile(
    ".proof/orchestration-threads/pagination.json",
    JSON.stringify(
      {
        synthetic: true,
        insertedGroups: 1300,
        returnedGroups: growingRange.page.length,
        pageStatus: growingRange.pageStatus,
        splitCursorPresent: true,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Growing reactive range retains its page status and split cursor.",
  );
}
await mkdir(".proof/orchestration-threads", { recursive: true, mode: 0o700 });
await writeFile(
  ".proof/orchestration-threads/local.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result));
