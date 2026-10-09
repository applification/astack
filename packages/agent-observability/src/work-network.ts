import type { AgentRun, SkillUse } from "./domain";
import { runConversation } from "./conversations";
import { sessionReferenceKey, type SessionReference } from "./delegation";
import { routeDefinitions } from "./workflow";
import type {
  WorkflowCapture,
  WorkflowRun,
  WorkflowRecord,
  WorkflowBranch,
  WorkflowRead,
  WorkflowResult,
  WorkflowActivity,
} from "./workflow-view";
import { branchOwnsRun } from "./workflow-view";
import {
  contributionUse,
  contributionUseLabel,
  contributionRecords,
  branchNodeId,
} from "./work-view";

type Evidence = WorkflowRecord["evidence"][number];
export type NetworkItem =
  | {
      kind: "conversation";
      reference: SessionReference | null;
      runs: WorkflowRun[];
      source: "current" | "snapshot" | "delegation";
    }
  | { kind: "turn"; run: WorkflowRun }
  | { kind: "contribution"; branch: WorkflowBranch }
  | { kind: "record"; record: WorkflowRecord }
  | { kind: "result"; result: WorkflowResult }
  | {
      kind: "skill";
      skill: SkillUse;
      reads: WorkflowRead[];
      declarations: WorkflowRecord[];
    }
  | { kind: "activity"; activity: WorkflowActivity }
  | { kind: "evidence"; evidence: Evidence; activity?: WorkflowActivity };
export type NetworkNode = {
  id: string;
  title: string;
  summary: string;
  status: string;
  item: NetworkItem;
  // Empty owners means overview. Otherwise visible when any owner is expanded.
  owners: string[];
  storyId?: string;
};
export const networkEdgeLabels = {
  delegation: "Delegated task",
  capture: "Captured child conversation",
  contains: "Contains captured turn",
  records: "Recorded activity",
  observed_read: "Observed skill reference",
  declared_skill: "Agent declared skill",
  references: "Declaration references evidence",
  result_reference: "Referenced contribution result",
  observation: "Result observation belongs to task",
  delivered: "Host delivered result",
  acknowledged: "Terminal result acknowledged",
  declared_use: "Parent declared use",
  unresolved_use: "Use declared; evidence unavailable",
} as const;
export type NetworkEdge = {
  id: string;
  from: string;
  to: string;
  kind: keyof typeof networkEdgeLabels;
};
export type WorkNetwork = {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  truncated: boolean;
  displayLimited?: boolean;
};
export const eventNodeId = (ref: { runId: string; eventId: string }) =>
  "event:" + JSON.stringify([ref.runId, ref.eventId]);
export const contributionNodeId = branchNodeId;

// Relationships come from source identities and explicit references, never
// timestamps, shared names, command signatures or chronological adjacency.
export function buildWorkNetwork(
  capture: WorkflowCapture,
  snapshots: readonly { run: AgentRun; revision: number }[],
): WorkNetwork {
  const nodes = new Map<string, NetworkNode>();
  const edges = new Map<string, NetworkEdge>();
  const groups = new Map<string, string>();
  const summaries = new Map(capture.runs.map((run) => [run.runId, run]));
  const childIds = new Set(
    capture.branches.flatMap((branch) => branch.runs.map((run) => run.runId)),
  );
  const connect = (from: string, to: string, kind: NetworkEdge["kind"]) => {
    if (from === to) return;
    const id = JSON.stringify([from, to, kind]);
    edges.set(id, { id, from, to, kind });
  };
  const add = (node: NetworkNode) => {
    const prior = nodes.get(node.id);
    if (!prior) nodes.set(node.id, node);
    else {
      const owners =
        prior.owners.length && node.owners.length
          ? [...new Set([...prior.owners, ...node.owners])]
          : [];
      // Canonical event roles survive when the same event is also referenced
      // as support. A result observation must not become optional evidence.
      if (node.item.kind === "result" || node.item.kind === "record")
        nodes.set(node.id, { ...node, owners });
      else prior.owners = owners;
    }
  };
  const conversation = (run: WorkflowRun, source: "current" | "snapshot") => {
    const ref = run.conversation?.self ?? null;
    const id =
      "conversation:" +
      JSON.stringify(
        ref
          ? [run.projectId, run.machineId, sessionReferenceKey(ref)]
          : [run.runId],
      );
    const prior = nodes.get(id);
    if (prior?.item.kind === "conversation") prior.item.runs.push(run);
    else
      add({
        id,
        title: ref
          ? "Parent conversation"
          : "Linked turn · identity unavailable",
        summary: ref
          ? "Expand captured turns and references"
          : "Conversation grouping is unavailable",
        status:
          source === "snapshot"
            ? "Linked evaluation snapshot"
            : "Current readable capture",
        item: { kind: "conversation", reference: ref, runs: [run], source },
        owners: [],
      });
    groups.set(run.runId, id);
    return id;
  };
  for (const run of capture.runs.filter((run) => !childIds.has(run.runId)))
    conversation(run, "current");
  for (const { run, revision } of snapshots) {
    if (groups.has(run.id) || childIds.has(run.id)) continue;
    const summary: WorkflowRun = {
      runId: run.id,
      machineId: run.machineId,
      projectId: run.projectId ?? "",
      title: run.title,
      status: run.status,
      revision,
      conversation: runConversation(run),
      activityLimited: false,
    };
    summaries.set(run.id, summary);
    conversation(summary, "snapshot");
  }
  const parentGroup = (runId: string) => {
    const known = groups.get(runId);
    if (known) return known;
    const id = "conversation:" + JSON.stringify([runId]);
    add({
      id,
      title: "Parent capture · identity unavailable",
      summary: "Inspect the linked parent trace",
      status: "Summary unavailable",
      item: {
        kind: "conversation",
        reference: null,
        runs: [],
        source: "snapshot",
      },
      owners: [],
    });
    groups.set(runId, id);
    return id;
  };
  for (const branch of capture.branches) {
    const id = contributionNodeId(branch);
    const parent = parentGroup(branch.parentRunId);
    add({
      id,
      title: branch.delegation.title || "Delegated task",
      summary: contributionUseLabel(
        contributionUse(branch, contributionRecords(branch, capture)),
      ),
      status: "Task " + branch.delegation.status,
      item: { kind: "contribution", branch },
      owners: [],
      storyId: contributionNodeId(branch),
    });
    connect(parent, id, "delegation");
    // The host's direct child reference establishes this scope. It does not
    // establish ancestry for an uncollected or unreadable native turn.
    const child = "child-conversation:" + id;
    const runs = branch.runs.map(
      (run) =>
        summaries.get(run.runId) ?? {
          ...run,
          machineId: "",
          projectId: "",
          conversation: null,
          activityLimited: false,
        },
    );
    add({
      id: child,
      title: branch.delegation.title
        ? branch.delegation.title + " · conversation"
        : "Child conversation",
      summary:
        branch.reason ?? `${runs.length} captured turns · expand to inspect`,
      status:
        branch.state === "available"
          ? "Capture available"
          : "Capture unavailable",
      item: {
        kind: "conversation",
        reference: branch.delegation.child,
        runs,
        source: "delegation",
      },
      owners: [],
    });
    connect(id, child, "capture");
    for (const run of runs) {
      groups.set(run.runId, child);
      summaries.set(run.runId, run);
    }
  }
  for (const run of summaries.values()) {
    const group = groups.get(run.runId);
    if (!group) continue;
    const id = "turn:" + run.runId;
    add({
      id,
      title: run.title || "Captured turn",
      summary: "Capture revision " + run.revision,
      status: run.status,
      item: { kind: "turn", run },
      owners: [group],
    });
    connect(group, id, "contains");
  }
  const records = [
    ...capture.records,
    ...capture.branches.flatMap((branch) => branch.records),
  ];
  const activityByRef = new Map(
    capture.activities.map((activity) => [
      eventNodeId(activity.reference),
      activity,
    ]),
  );
  for (const record of records) {
    const a = record.annotation;
    const id = eventNodeId({ runId: record.runId, eventId: record.eventId });
    const group = parentGroup(record.runId);
    const overview = a.action === "join";
    add({
      id,
      title:
        a.action === "phase"
          ? a.phase + " · " + a.status
          : a.action === "join"
            ? "Parent declares result use"
            : routeDefinitions[a.route].label +
              (a.action === "change" ? " · changed" : " · selected"),
      summary:
        a.action === "phase" || a.action === "join" ? a.summary : a.reason,
      status: "Agent declaration",
      item: { kind: "record", record },
      owners: overview ? [] : [group],
      storyId: record.eventId,
    });
    // A join is visible in overview without pretending it follows a task in time.
    connect(overview ? group : "turn:" + record.runId, id, "records");
    for (const evidence of record.evidence) {
      const refId = eventNodeId(evidence.reference);
      const activity = activityByRef.get(refId);
      add({
        id: refId,
        title:
          evidence.state === "available"
            ? evidence.title || evidence.kind
            : "Referenced evidence unavailable",
        summary:
          evidence.state === "available"
            ? evidence.kind.replace(/_/g, " ")
            : evidence.reason,
        status:
          evidence.state === "available"
            ? "Captured reference"
            : "Unavailable reference",
        item: { kind: "evidence", evidence, ...(activity ? { activity } : {}) },
        owners: overview ? [] : [group],
      });
      connect(id, refId, "references");
    }
    if (a.action === "phase")
      for (const name of a.skills) {
        const skill: SkillUse = {
          name,
          kind: "skill",
          hash: null,
          provenance: "declared",
          evidence: "declared",
        };
        const skillId = "declared-skill:" + JSON.stringify([id, name]);
        add({
          id: skillId,
          title: name,
          summary: "Declared by agent; no read or application established",
          status: "Declared skill",
          item: { kind: "skill", skill, reads: [], declarations: [record] },
          owners: [group],
        });
        connect(id, skillId, "declared_skill");
      }
  }
  for (const activity of capture.activities) {
    const id = eventNodeId(activity.reference);
    const group = groups.get(activity.reference.runId);
    if (!group) continue;
    const existing = nodes.get(id);
    if (existing?.item.kind === "evidence")
      existing.owners = existing.owners.length
        ? [...new Set([...existing.owners, group])]
        : [];
    else
      add({
        id,
        title: activity.title || activity.kind.replace(/_/g, " "),
        summary: activity.kind.replace(/_/g, " "),
        status: activity.failed ? "Failure recorded" : "Captured event",
        item: { kind: "activity", activity },
        owners: [group],
      });
    connect("turn:" + activity.reference.runId, id, "records");
  }
  for (const read of [
    ...capture.reads,
    ...capture.branches.flatMap((branch) => branch.reads),
  ]) {
    const group = groups.get(read.reference.runId);
    if (!group) continue;
    const skill = read.skill;
    // Unknown hashes cannot establish a shared version, even when names match.
    const id =
      "skill:" +
      JSON.stringify([
        skill.kind,
        skill.name,
        skill.hash,
        skill.provenance,
        skill.hash === null ? read.reference : null,
      ]);
    const prior = nodes.get(id);
    if (prior?.item.kind === "skill") prior.item.reads.push(read);
    add({
      id,
      title: skill.name,
      summary: "Observed reference; application not established",
      status:
        skill.provenance === "observation_time"
          ? "Hash at observation time"
          : skill.provenance.replace(/_/g, " "),
      item: { kind: "skill", skill, reads: [read], declarations: [] },
      owners: [group],
    });
    connect("turn:" + read.reference.runId, id, "observed_read");
  }
  for (const branch of capture.branches) {
    const task = contributionNodeId(branch);
    const use = contributionUse(branch, contributionRecords(branch, capture));
    if (use.state === "not_recorded") continue;
    for (const join of use.joins) {
      if (join.record.annotation.action !== "join") continue;
      for (const input of join.record.annotation.inputs.filter(
        (input) => input.branchId === branch.delegation.id,
      )) {
        const result = eventNodeId(input.result);
        if (!nodes.has(result)) continue;
        connect(task, result, "result_reference");
        connect(
          result,
          eventNodeId({
            runId: join.record.runId,
            eventId: join.record.eventId,
          }),
          join.state === "available" ? "declared_use" : "unresolved_use",
        );
      }
    }
  }
  for (const result of capture.results) {
    const branch = capture.branches.find(
      (branch) =>
        branchOwnsRun(branch, result.reference.runId) &&
        branch.delegation.id === result.delegationId,
    );
    if (!branch) continue;
    const state = result.observation.state;
    const id = eventNodeId(result.reference);
    add({
      id,
      title:
        state === "present"
          ? "Result present in parent capture"
          : state === "delivered"
            ? "Host delivered result"
            : "Terminal result acknowledged",
      summary:
        state === "present"
          ? "Presence does not establish receipt or use"
          : "Receipt does not establish declared use",
      status: "Host observation · " + state,
      item: { kind: "result", result },
      owners: [],
      storyId: result.reference.eventId,
    });
    connect(contributionNodeId(branch), id, "observation");
    if (state !== "present")
      connect(id, parentGroup(result.reference.runId), state);
  }
  return {
    nodes: [...nodes.values()],
    edges: [...edges.values()].filter(
      (edge) => nodes.has(edge.from) && nodes.has(edge.to),
    ),
    truncated: capture.truncated,
  };
}

export type NetworkFilters = {
  activity: boolean;
  skills: boolean;
  evidence: boolean;
  lens: "all" | "delegation" | "results";
};
export function visibleWorkNetwork(
  network: WorkNetwork,
  expanded: ReadonlySet<string>,
  filters: NetworkFilters,
): WorkNetwork {
  const candidates = network.nodes.filter((node) => {
    if (node.owners.length && !node.owners.some((owner) => expanded.has(owner)))
      return false;
    const kind = node.item.kind;
    if (
      (kind === "skill" && !filters.skills) ||
      (kind === "activity" && !filters.activity) ||
      (kind === "evidence" && !filters.evidence)
    )
      return false;
    if (filters.lens === "delegation")
      return kind === "conversation" || kind === "contribution";
    if (filters.lens === "results")
      return (
        kind === "conversation" ||
        kind === "contribution" ||
        kind === "result" ||
        kind === "evidence" ||
        (kind === "record" && node.item.record.annotation.action === "join")
      );
    return true;
  });
  const rank = {
    conversation: 0,
    contribution: 1,
    result: 2,
    turn: 3,
    record: 4,
    evidence: 5,
    activity: 6,
    skill: 7,
  };
  const nodes =
    candidates.length > 360
      ? [...candidates]
          .sort((a, b) => rank[a.item.kind] - rank[b.item.kind])
          .slice(0, 360)
      : candidates;
  const ids = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: network.edges.filter(
      (edge) => ids.has(edge.from) && ids.has(edge.to),
    ),
    truncated: network.truncated,
    displayLimited: candidates.length > nodes.length,
  };
}
