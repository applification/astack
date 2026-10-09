import { expect, test } from "bun:test";
import { journeyFixture } from "./journey-fixtures";
import { buildWorkView, contributionUse, branchNodeId } from "./work-view";

test("completed child tasks have delegation edges but no inferred returns or use", () => {
  const fixture = journeyFixture(false);
  const view = buildWorkView(fixture.workflow, [fixture.parent]);
  expect(view.edges.filter((edge) => edge.kind === "delegation")).toHaveLength(
    2,
  );
  expect(
    view.edges.filter((edge) => edge.kind === "result" || edge.kind === "use"),
  ).toHaveLength(0);
  expect(
    view.nodes.filter((node) => node.item.kind === "dispatch"),
  ).toHaveLength(2);
});

test("each declared join retains its own evidence availability", () => {
  const fixture = journeyFixture();
  const join = fixture.workflow.records.find(
    (record) => record.annotation.action === "join",
  );
  const branch = fixture.workflow.branches[0];
  if (!join || !branch) throw new Error("missing join fixture");
  fixture.workflow.records.push({
    ...join,
    eventId: "missing-second-join",
    recordedAt: join.recordedAt + 100,
    evidence: join.evidence.map((item) => ({
      state: "unavailable",
      reference: item.reference,
      reason: "not captured",
    })),
  });
  const view = buildWorkView(fixture.workflow, [fixture.parent]);
  expect(
    view.edges
      .filter(
        (edge) =>
          edge.from === branchNodeId(branch) &&
          (edge.kind === "use" || edge.kind === "unresolved_use"),
      )
      .map((edge) => [edge.to, edge.kind]),
  ).toEqual([
    [join.eventId, "use"],
    ["missing-second-join", "unresolved_use"],
  ]);
  expect(contributionUse(branch, fixture.workflow.records).state).toBe(
    "unavailable",
  );
});

test.each(["delivered", "acknowledged"] as const)(
  "explicit %s observations create a receipt edge without declaring parent use",
  (state) => {
    const fixture = journeyFixture(false);
    const branch = fixture.workflow.branches[0];
    if (!branch) throw new Error("missing branch fixture");
    fixture.workflow.results.push({
      delegationId: branch.delegation.id,
      reference: { runId: fixture.parent.id, eventId: state },
      revision: 1,
      observedAt: 2000,
      title: "Host classification",
      source: "parent_capture",
      host: {
        environmentId: "fixture-host",
        threadId: "parent",
        runId: null,
        origin: "app_owned",
      },
      observation:
        state === "acknowledged"
          ? { state, resultId: null, observedByRunId: null }
          : { state, resultId: null },
      sourceUpdatedAt: 1700,
      occurredAt: null,
    });
    const view = buildWorkView(fixture.workflow, [fixture.parent]);
    expect(
      view.edges
        .filter((edge) => edge.kind === "result")
        .map((edge) => [edge.from, edge.to]),
    ).toEqual([[branchNodeId(branch), state]]);
    expect(
      view.edges.some(
        (edge) => edge.kind === "use" || edge.kind === "unresolved_use",
      ),
    ).toBe(false);
    expect(view.main).not.toContain(state);
  },
);

test("unknown dispatch timing never becomes a workflow sequence claim", () => {
  const fixture = journeyFixture(false);
  const branch = fixture.workflow.branches[0];
  if (!branch) throw new Error("missing branch fixture");
  branch.delegation.startedAt = null;
  const view = buildWorkView(fixture.workflow, [fixture.parent]);
  const id = branchNodeId(branch, "dispatch");
  expect(view.nodes.find((node) => node.id === id)?.summary).toContain(
    "Dispatch time unavailable",
  );
  expect(
    view.edges.some(
      (edge) =>
        edge.kind === "sequence" && (edge.from === id || edge.to === id),
    ),
  ).toBe(false);
});

test("a declared join with missing child evidence remains visible as an unresolved use", () => {
  const fixture = journeyFixture();
  for (const record of fixture.workflow.records)
    if (record.annotation.action === "join")
      record.evidence = record.evidence.map((item) => ({
        state: "unavailable",
        reference: item.reference,
        reason: "Capture limit reached",
      }));
  const view = buildWorkView(fixture.workflow, [fixture.parent]);
  expect(view.edges.filter((edge) => edge.kind === "use")).toHaveLength(0);
  expect(
    view.edges.filter((edge) => edge.kind === "unresolved_use"),
  ).toHaveLength(2);
  for (const branch of fixture.workflow.branches)
    expect(contributionUse(branch, fixture.workflow.records).state).toBe(
      "unavailable",
    );
});

test("parent result presence stays inspectable without a return edge or invented sequence", () => {
  const fixture = journeyFixture(false),
    branch = fixture.workflow.branches[0];
  if (!branch) throw new Error("Fixture branch missing");
  fixture.workflow.results.push({
    delegationId: branch.delegation.id,
    reference: { runId: fixture.parent.id, eventId: "parent-result" },
    revision: 3,
    observedAt: 1500,
    title: "Host result",
    source: "parent_capture",
    host: {
      environmentId: "fixture-host",
      threadId: "parent",
      runId: null,
      origin: "app_owned",
    },
    observation: { state: "present", resultId: "fixture-result" },
    sourceUpdatedAt: 1400,
    occurredAt: null,
  });
  const view = buildWorkView(fixture.workflow, [fixture.parent]);
  expect(view.edges.filter((edge) => edge.kind === "result")).toHaveLength(0);
  expect(view.nodes.find((node) => node.id === "parent-result")?.title).toBe(
    "Result present in parent capture",
  );
  expect(
    view.edges.some(
      (edge) =>
        edge.kind === "sequence" &&
        (edge.from === "parent-result" || edge.to === "parent-result"),
    ),
  ).toBe(false);
  expect(view.edges.filter((edge) => edge.kind === "use")).toHaveLength(0);
  const ids = new Set(view.nodes.map((node) => node.id));
  expect(
    view.edges.every((edge) => ids.has(edge.from) && ids.has(edge.to)),
  ).toBe(true);
});
