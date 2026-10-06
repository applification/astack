import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalStore } from "./store";
import { recordWorkflow } from "./workflow";
import {
  evaluationRun,
  evaluationPrompt,
  fixtureProject,
  fixtureMachine,
} from "@astack/agent-observability/evaluation-fixtures";
import { routeDefinitions } from "@astack/agent-observability/workflow";
import { configSchema } from "./config";
import { persistSnapshot } from "./collector";

test("workflow recording survives restart, crosses turns, redacts and enforces enabled readable project scope", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-workflow-"));
  let store = new LocalStore(directory);
  try {
    const project = {
      projectId: fixtureProject,
      name: "Fixture",
      enabled: true,
      repositories: [],
      folders: [{ machineId: fixtureMachine, path: "/fixture" }],
    };
    store.setMeta("projectPolicy", JSON.stringify([project]));
    const before = evaluationRun("reproduce");
    const after = evaluationRun();
    for (const run of [before, after]) store.put({ kind: "run", value: run });
    store.put({ kind: "event", value: evaluationPrompt() });
    const flowId = before.id + ":workflow:" + crypto.randomUUID();
    const selected = recordWorkflow({
      store,
      runId: before.id,
      annotation: {
        schemaVersion: 1,
        flowId,
        action: "select",
        route: "bug-fix",
        reason: "Repair saved edits. password=hunter222",
        plannedPhases: routeDefinitions["bug-fix"].phases,
        request: { runId: before.id, eventId: evaluationPrompt().id },
      },
    });
    expect(selected.eventId).toBe(flowId);
    expect(
      JSON.stringify(store.getRecord("event:" + selected.eventId)),
    ).not.toContain("hunter222");
    store.close();
    store = new LocalStore(directory);
    expect(store.getMeta("workflow:last:" + after.sessionId)).toBe(flowId);
    const phase = {
      schemaVersion: 1,
      flowId,
      action: "phase",
      phase: "reproduce",
      status: "completed",
      summary: "Reopened value is stale.",
      skills: ["bug-fix"],
      evidence: [{ runId: before.id, eventId: evaluationPrompt().id }],
    } as const;
    const recorded = recordWorkflow({
      store,
      runId: after.id,
      annotation: {
        ...phase,
        skills: [...phase.skills],
        evidence: [...phase.evidence],
      },
    });
    expect(store.getRecord("event:" + recorded.eventId)?.kind).toBe("event");
    const prior = store.getRecord("run:" + after.id);
    expect(prior?.kind === "run" && prior.value.outcome).toBe("unknown");
    persistSnapshot(store, { run: after, events: [] });
    const refreshed = store.getRecord("run:" + after.id);
    expect(
      refreshed?.kind === "run" &&
        refreshed.value.skills.some(
          (skill) =>
            skill.name === "bug-fix" &&
            skill.evidence === "declared" &&
            skill.hash === null,
        ),
    ).toBe(true);
    expect(() =>
      recordWorkflow({
        store,
        runId: after.id,
        annotation: {
          ...phase,
          skills: [],
          evidence: [{ runId: "foreign", eventId: evaluationPrompt().id }],
        },
      }),
    ).toThrow("outside");
    store.put({ kind: "run", value: { ...after, contentCapture: false } });
    expect(() =>
      recordWorkflow({
        store,
        runId: after.id,
        annotation: { ...phase, skills: [], evidence: [] },
      }),
    ).toThrow("readable");
    store.setMeta(
      "projectPolicy",
      JSON.stringify([{ ...project, enabled: false }]),
    );
    expect(() =>
      recordWorkflow({
        store,
        runId: before.id,
        annotation: { ...phase, skills: [], evidence: [] },
      }),
    ).toThrow("enabled");
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("the CLI records structured transitions and preserves the legacy workflow command", async () => {
  const directory = await mkdtemp(join(tmpdir(), "astack-workflow-cli-"));
  const store = new LocalStore(directory);
  try {
    const run = evaluationRun();
    store.setMeta(
      "projectPolicy",
      JSON.stringify([
        {
          projectId: fixtureProject,
          name: "Fixture",
          enabled: true,
          repositories: [],
          folders: [{ machineId: fixtureMachine, path: "/fixture" }],
        },
      ]),
    );
    store.put({ kind: "run", value: run });
    await writeFile(
      join(directory, "config.json"),
      JSON.stringify(
        configSchema.parse({
          schemaVersion: 1,
          machineId: fixtureMachine,
          machineName: "Fixture",
          endpoint: "http://127.0.0.1/agentlog/ingest",
          tokenFile: "/unused",
          homes: [{ path: "/unused", label: "fixture" }],
          since: 0,
        }),
      ),
    );
    const cli = (...args: string[]) => {
      const child = Bun.spawnSync(
        [
          process.execPath,
          join(import.meta.dir, "cli.ts"),
          "--state",
          directory,
          "workflow",
          "--session",
          run.sessionId,
          "--turn",
          run.attemptId,
          ...args,
        ],
        { stdout: "pipe", stderr: "pipe" },
      );
      if (child.exitCode !== 0) throw new Error(child.stderr.toString());
      return child.stdout.toString();
    };
    const selected = JSON.parse(
      cli(
        "--action",
        "select",
        "--name",
        "implement",
        "--reason",
        "Add the approved editor behaviour.",
        "--plan",
        "implement",
        "verify",
      ),
    );
    const phase = JSON.parse(
      cli(
        "--action",
        "phase",
        "--step",
        "implement",
        "--status",
        "completed",
        "--summary",
        "Changed the save path.",
        "--skills",
        "react",
        "typescript-best-practices",
      ),
    );
    expect(phase.flowId).toBe(selected.flowId);
    expect(JSON.parse(cli("--action", "context")).lastFlowId).toBe(
      selected.flowId,
    );
    cli("--name", "legacy-method", "--step", "legacy-step");
    const events = store.events(run.id);
    expect(events.filter((event) => event.workflow)).toHaveLength(2);
    expect(
      events.some((event) => event.title === "legacy-step" && !event.workflow),
    ).toBe(true);
  } finally {
    store.close();
    await rm(directory, { recursive: true, force: true });
  }
});
