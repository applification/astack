import { expect, test } from "bun:test";
import { journeyFixture } from "./journey-fixtures";
import { buildWorkView } from "./work-view";
import {
  buildWorkNetwork,
  visibleWorkNetwork,
  contributionNodeId,
  eventNodeId,
} from "./work-network";

const filters = {
  activity: true,
  skills: true,
  evidence: true,
  lens: "all",
} as const;
test("missing current capture retains the supplied frozen revision without inventing current provenance", () => {
  const fixture = journeyFixture(false);
  const graph = buildWorkNetwork(
    {
      ...fixture.workflow,
      runs: [],
      branches: [],
      records: [],
      reads: [],
      results: [],
      activities: [],
    },
    [{ run: fixture.parent, revision: 7 }],
  );
  const conversation = graph.nodes.find(
    (node) => node.item.kind === "conversation",
  );
  expect(
    conversation?.item.kind === "conversation" && conversation.item.source,
  ).toBe("snapshot");
  expect(
    conversation?.item.kind === "conversation" &&
      conversation.item.runs[0]?.revision,
  ).toBe(7);
  const turn = graph.nodes.find((node) => node.item.kind === "turn");
  expect(turn?.item.kind === "turn" && turn.item.run.revision).toBe(7);
});
test("overview is a relationship network; completion and unknown timing do not imply returns or order", () => {
  const fixture = journeyFixture(false);
  const before = JSON.stringify(fixture);
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  const overview = visibleWorkNetwork(graph, new Set(), filters);
  expect(overview.nodes.map((node) => node.item.kind).sort()).toEqual([
    "contribution",
    "contribution",
    "conversation",
    "conversation",
    "conversation",
  ]);
  expect(overview.edges.map((edge) => edge.kind).sort()).toEqual([
    "capture",
    "capture",
    "delegation",
    "delegation",
  ]);
  expect(
    graph.edges.some((edge) =>
      ["sequence", "declared_use", "delivered", "acknowledged"].includes(
        edge.kind,
      ),
    ),
  ).toBe(false);
  expect(JSON.stringify(fixture)).toBe(before);
});
test("expansion and filters retain source identity, failed turns and bounded activity; references are deduplicated", () => {
  const fixture = journeyFixture();
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  const expanded = new Set(
    graph.nodes
      .filter((node) => node.item.kind === "conversation")
      .map((node) => node.id),
  );
  const all = visibleWorkNetwork(graph, expanded, filters);
  expect(all.nodes.filter((node) => node.item.kind === "turn")).toHaveLength(5);
  expect(
    all.nodes.some(
      (node) => node.item.kind === "turn" && node.status === "failed",
    ),
  ).toBe(true);
  expect(
    all.nodes.some(
      (node) =>
        node.item.kind === "activity" && node.item.activity.timestamp === null,
    ),
  ).toBe(true);
  expect(new Set(all.nodes.map((node) => node.id)).size).toBe(all.nodes.length);
  expect(
    all.edges.every(
      (edge) =>
        all.nodes.some((node) => node.id === edge.from) &&
        all.nodes.some((node) => node.id === edge.to),
    ),
  ).toBe(true);
  const hidden = visibleWorkNetwork(graph, expanded, {
    ...filters,
    activity: false,
    skills: false,
    evidence: false,
  });
  expect(
    hidden.nodes.some((node) =>
      ["activity", "skill", "evidence"].includes(node.item.kind),
    ),
  ).toBe(false);
  expect(
    graph.nodes.filter((node) => node.item.kind === "activity"),
  ).not.toHaveLength(0);
});
test("declared use follows exact result references, including unresolved evidence, and excludes another parent's identically named task", () => {
  const fixture = journeyFixture();
  const branch = fixture.workflow.branches[0];
  if (!branch) throw new Error("missing fixture");
  fixture.workflow.branches.push({
    ...branch,
    parentRunId: "foreign-parent",
    records: [],
    reads: [],
    runs: [],
  });
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  expect(
    graph.nodes.filter((node) => node.item.kind === "contribution"),
  ).toHaveLength(3);
  expect(
    graph.edges.filter((edge) => edge.kind === "declared_use"),
  ).toHaveLength(2);
  const other = contributionNodeId(fixture.workflow.branches.at(-1)!);
  expect(
    graph.edges.some(
      (edge) => edge.from === other && edge.kind === "result_reference",
    ),
  ).toBe(false);
  expect(graph.nodes.find((node) => node.id === other)?.summary).toBe(
    "Parent use not recorded",
  );
  const story = buildWorkView(fixture.workflow, [fixture.parent]);
  const contributions = graph.nodes.filter(
    (node) => node.item.kind === "contribution",
  );
  expect(new Set(contributions.map((node) => node.storyId)).size).toBe(3);
  for (const node of contributions) {
    const storyNode = story.nodes.find((item) => item.id === node.storyId);
    expect(
      storyNode?.item.kind === "contribution" && storyNode.item.branch,
    ).toBe(node.item.kind === "contribution" && node.item.branch);
  }
  expect(new Set(story.nodes.map((node) => node.id)).size).toBe(
    story.nodes.length,
  );
  const missing = buildWorkNetwork(
    {
      ...fixture.workflow,
      records: fixture.workflow.records.map((record) => ({
        ...record,
        evidence: record.evidence.map((evidence) => ({
          state: "unavailable" as const,
          reference: evidence.reference,
          reason: "Not collected",
        })),
      })),
    },
    [{ run: fixture.parent, revision: 7 }],
  );
  expect(
    missing.edges.filter((edge) => edge.kind === "unresolved_use"),
  ).toHaveLength(2);
  expect(
    missing.nodes.some(
      (node) =>
        node.item.kind === "evidence" &&
        node.item.evidence.state === "unavailable",
    ),
  ).toBe(true);
});
test("only matching known skill hashes and provenance form shared hubs; unknown versions remain separate", () => {
  const fixture = journeyFixture(false);
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  const react = graph.nodes.find(
    (node) =>
      node.item.kind === "skill" &&
      node.item.skill.name === "react" &&
      node.item.reads.length,
  );
  expect(react?.item.kind === "skill" && react.item.reads.length).toBe(2);
  for (const branch of fixture.workflow.branches)
    for (const read of branch.reads) read.skill.hash = null;
  const unknown = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  expect(
    unknown.nodes.filter(
      (node) =>
        node.item.kind === "skill" &&
        node.item.skill.name === "react" &&
        node.item.reads.length,
    ),
  ).toHaveLength(2);
  for (const branch of fixture.workflow.branches)
    for (const read of branch.reads) read.skill.hash = "same";
  const read = fixture.workflow.branches[0]?.reads[1];
  if (read) read.skill.provenance = "use_time";
  expect(
    buildWorkNetwork(fixture.workflow, [
      { run: fixture.parent, revision: 7 },
    ]).nodes.filter(
      (node) =>
        node.item.kind === "skill" &&
        node.item.skill.name === "react" &&
        node.item.reads.length,
    ),
  ).toHaveLength(2);
});
test("presence is structural; delivery and acknowledgement are independent typed receipt links", () => {
  const fixture = journeyFixture(false);
  for (const state of ["present", "delivered", "acknowledged"] as const)
    fixture.workflow.results.push({
      delegationId: "delegate-ui",
      reference: { runId: fixture.parent.id, eventId: state },
      revision: 1,
      observedAt: 2000,
      title: state,
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
          : state === "present"
            ? { state, resultId: "present-id" }
            : { state, resultId: null },
      sourceUpdatedAt: 1900,
      occurredAt: null,
    });
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  expect(
    graph.edges.filter((edge) => edge.kind === "observation"),
  ).toHaveLength(3);
  expect(graph.edges.filter((edge) => edge.kind === "delivered")).toHaveLength(
    1,
  );
  expect(
    graph.edges.filter((edge) => edge.kind === "acknowledged"),
  ).toHaveLength(1);
  expect(
    graph.edges.filter(
      (edge) =>
        edge.from ===
        eventNodeId({ runId: fixture.parent.id, eventId: "present" }),
    ),
  ).toHaveLength(0);
  expect(
    graph.edges.filter((edge) => edge.kind === "declared_use"),
  ).toHaveLength(0);
});
test("current trusted conversation identities supersede snapshots and preserve provider-switch turns", () => {
  const fixture = journeyFixture(false);
  const self = {
    kind: "t3",
    environmentId: "environment",
    threadId: "parent",
  } as const;
  fixture.workflow.runs = fixture.workflow.runs.map((run) =>
    run.runId.includes("saved-edit")
      ? { ...run, conversation: { self, root: self } }
      : run,
  );
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  const parents = graph.nodes.filter(
    (node) =>
      node.item.kind === "conversation" && node.item.source === "current",
  );
  expect(parents).toHaveLength(1);
  expect(
    parents[0]?.item.kind === "conversation" && parents[0].item.runs.length,
  ).toBe(2);
});

test("result observations and workflow declarations retain their canonical roles when referenced as support", () => {
  const fixture = journeyFixture(false);
  const branch = fixture.workflow.branches[0];
  const record = fixture.workflow.records.find(
    (record) => record.annotation.action === "phase",
  );
  const childRecord = branch?.records[0];
  if (!branch || !record || !childRecord) throw new Error("missing fixture");
  const resultRef = { runId: fixture.parent.id, eventId: "supported-receipt" };
  fixture.workflow.results.push({
    delegationId: branch.delegation.id,
    reference: resultRef,
    revision: 1,
    observedAt: 2000,
    title: "Receipt",
    source: "parent_capture",
    host: {
      environmentId: "fixture-host",
      threadId: "parent",
      runId: null,
      origin: "app_owned",
    },
    observation: { state: "delivered", resultId: null },
    sourceUpdatedAt: 1900,
    occurredAt: null,
  });
  record.evidence.push(
    {
      state: "available",
      reference: resultRef,
      title: "Receipt",
      kind: "delegation_result",
      revision: 1,
    },
    {
      state: "available",
      reference: { runId: childRecord.runId, eventId: childRecord.eventId },
      title: "Child declaration",
      kind: "workflow_step",
      revision: 1,
    },
  );
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  expect(
    graph.nodes.find((node) => node.id === eventNodeId(resultRef))?.item.kind,
  ).toBe("result");
  expect(
    graph.nodes.find(
      (node) =>
        node.id ===
        eventNodeId({ runId: childRecord.runId, eventId: childRecord.eventId }),
    )?.item.kind,
  ).toBe("record");
  const expanded = new Set(
    graph.nodes
      .filter((node) => node.item.kind === "conversation")
      .map((node) => node.id),
  );
  const filtered = visibleWorkNetwork(graph, expanded, {
    ...filters,
    evidence: false,
  });
  expect(
    filtered.edges.filter((edge) => edge.kind === "delivered"),
  ).toHaveLength(1);
  expect(
    filtered.nodes.some(
      (node) => node.item.kind === "record" && node.item.record === childRecord,
    ),
  ).toBe(true);
});

test("dense expansion retains scope and receipt nodes within the visible budget, without changing captured topology", () => {
  const fixture = journeyFixture(false);
  const phase = fixture.workflow.records.find(
    (record) => record.annotation.action === "phase",
  );
  if (!phase || phase.annotation.action !== "phase")
    throw new Error("missing phase");
  const annotation = phase.annotation;
  fixture.workflow.records = Array.from({ length: 80 }, (_, index) => ({
    ...phase,
    eventId: "dense-" + index,
    annotation: {
      ...annotation,
      skills: Array.from({ length: 12 }, (_, skill) => "skill-" + skill),
    },
  }));
  const graph = buildWorkNetwork(fixture.workflow, [
    { run: fixture.parent, revision: 7 },
  ]);
  const before = JSON.stringify(graph);
  const expanded = new Set(
    graph.nodes
      .filter((node) => node.item.kind === "conversation")
      .map((node) => node.id),
  );
  const visible = visibleWorkNetwork(graph, expanded, filters);
  expect(visible.nodes).toHaveLength(360);
  expect(visible.displayLimited).toBe(true);
  expect(
    visible.nodes.filter((node) => node.item.kind === "record"),
  ).toHaveLength(
    graph.nodes.filter((node) => node.item.kind === "record").length,
  );
  expect(
    visible.edges.every(
      (edge) =>
        visible.nodes.some((node) => node.id === edge.from) &&
        visible.nodes.some((node) => node.id === edge.to),
    ),
  ).toBe(true);
  expect(JSON.stringify(graph)).toBe(before);
  const smaller = visibleWorkNetwork(graph, expanded, {
    ...filters,
    skills: false,
  });
  expect(smaller.displayLimited).toBe(false);
});
