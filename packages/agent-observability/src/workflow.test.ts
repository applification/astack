import { expect, test } from "bun:test";
import { eventSchema } from "./domain";
import { workflowFlows } from "./workflow-view";
import { workflowViewFixture } from "./workflow-fixtures";
import { assessmentInputSchema, validateAssessment } from "./evaluations";
import { evaluationFixture, fixtureAssessment } from "./evaluation-fixtures";

test("phase pairing spans turns, retains failed attempts and supports a changed route", () => {
  const capture = workflowViewFixture("changed");
  const flow = workflowFlows([...capture.records].reverse())[0];
  expect(
    flow?.selection?.annotation.action === "select" &&
      flow.selection.annotation.route,
  ).toBe("investigate");
  const phases = flow?.nodes.filter((node) => node.kind === "phase") ?? [];
  expect(phases.filter((node) => node.phase === "reproduce")).toHaveLength(1);
  expect(phases[0]?.records).toHaveLength(2);
  expect(
    phases.filter((node) => node.phase === "verify").map((node) => node.status),
  ).toEqual(["failed", "completed"]);
  expect(phases.at(-1)?.route).toBe("bug-fix");
  expect(flow?.nodes.filter((node) => node.kind === "route")).toHaveLength(1);
});
test("capture revision preserves phase ordering when declarations share a millisecond", () => {
  const records = workflowViewFixture().records.map((record, index) => ({
    ...record,
    recordedAt: 1,
    revision: index + 1,
  }));
  const flow = workflowFlows(records.reverse())[0];
  expect(
    flow?.nodes.flatMap((node) =>
      node.kind === "phase" && node.phase === "verify" ? [node.status] : [],
    ),
  ).toEqual(["failed", "completed"]);
});
test("missing selection, unfinished phases and justified omissions are not inferred as success", () => {
  const capture = workflowViewFixture("feature");
  const flow = workflowFlows(capture.records.slice(1))[0];
  expect(flow?.selection).toBeNull();
  expect(
    flow?.nodes.some(
      (node) => node.kind === "phase" && node.status === "omitted",
    ),
  ).toBe(true);
  expect(
    flow?.nodes.at(-1)?.kind === "phase" && flow.nodes.at(-1),
  ).toMatchObject({ status: "started" });
  expect(workflowFlows([])).toEqual([]);
});
test("structured annotations validate their variants and do not reinterpret legacy steps", () => {
  const record = workflowViewFixture().records[0];
  if (!record) throw new Error("Fixture missing selection");
  const event = {
    id: record.eventId,
    runId: record.runId,
    kind: "workflow_step",
    sequence: 1,
    timestamp: 1,
    observedAt: 1,
    timing: "agent",
    title: "Route",
    workflow: record.annotation,
    data: {},
  };
  expect(eventSchema.safeParse({ ...event, kind: "file_read" }).success).toBe(
    false,
  );
  expect(
    eventSchema.safeParse({
      ...event,
      workflow: { ...record.annotation, route: "guessed" },
    }).success,
  ).toBe(false);
  const { workflow: _, ...legacy } = event;
  expect(eventSchema.parse(legacy).workflow).toBeUndefined();
});
test("flow judgments need captured trace references and remain independent of outcome proof", () => {
  const input = fixtureAssessment();
  const record = workflowViewFixture().records[0];
  if (!record) throw new Error("Fixture missing selection");
  expect(
    assessmentInputSchema.safeParse({
      ...input,
      flow: { route: input.intent, execution: input.outcome },
    }).success,
  ).toBe(false);
  const judgment = {
    verdict: "pass",
    reason:
      "The route matches the defect and the before/after observations support its execution.",
    evidence: [{ kind: "trace", runId: record.runId, eventId: record.eventId }],
  };
  const value = assessmentInputSchema.parse({
    ...fixtureAssessment("inconclusive"),
    flow: { route: judgment, execution: judgment },
  });
  const flow = value.flow;
  if (!flow) throw new Error("Fixture missing flow judgments");
  expect(() =>
    validateAssessment(evaluationFixture("inconclusive"), value),
  ).not.toThrow();
  expect(() =>
    validateAssessment(evaluationFixture(), {
      ...value,
      flow: {
        route: {
          ...flow.route,
          evidence: [{ kind: "trace", runId: "foreign", eventId: "foreign" }],
        },
        execution: flow.execution,
      },
    }),
  ).toThrow("outside");
});

test("sibling journeys and retries pair by conversation across turns without inventing a join", async () => {
  const { journeyFixture } = await import("./journey-fixtures");
  const capture = journeyFixture(false).workflow;
  const flows = workflowFlows(
    capture.branches.flatMap((branch) => branch.records).reverse(),
  );
  expect(flows).toHaveLength(2);
  expect(
    flows.flatMap((flow) =>
      flow.nodes.flatMap((node) =>
        node.kind === "phase" ? [node.status] : [],
      ),
    ),
  ).toEqual(["failed", "completed", "completed"]);
  for (const flow of flows)
    for (const node of flow.nodes)
      if (node.kind === "phase") {
        expect(
          new Set(node.records.map((record) => record.sessionId)).size,
        ).toBe(1);
        expect(node.records).toHaveLength(2);
      }
  expect(
    workflowFlows(capture.records)
      .flatMap((flow) => flow.nodes)
      .some((node) => node.kind === "join"),
  ).toBe(false);
  expect(
    workflowFlows(journeyFixture().workflow.records)
      .flatMap((flow) => flow.nodes)
      .filter((node) => node.kind === "join"),
  ).toHaveLength(1);
});
