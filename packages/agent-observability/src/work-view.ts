import type { AgentRun } from "./domain";
import { routeDefinitions } from "./workflow";
import {
  workflowFlows,
  type WorkflowCapture,
  type WorkflowRecord,
  type WorkflowNode,
  type WorkflowBranch,
  type WorkflowRead,
  type WorkflowResult,
} from "./workflow-view";

export type WorkItem =
  | { kind: "record"; record: WorkflowRecord }
  | { kind: "phase"; phase: Extract<WorkflowNode, { kind: "phase" }> }
  | { kind: "dispatch"; branch: WorkflowBranch }
  | { kind: "contribution"; branch: WorkflowBranch }
  | { kind: "result"; result: WorkflowResult }
  | { kind: "skills"; reads: WorkflowRead[] };
export type WorkNode = {
  id: string;
  title: string;
  summary: string;
  status: string;
  item: WorkItem;
};
export type WorkEdge = {
  id: string;
  from: string;
  to: string;
  kind: "sequence" | "delegation" | "result" | "use" | "unresolved_use";
};
export type WorkView = { nodes: WorkNode[]; main: string[]; edges: WorkEdge[] };

export type ContributionUse =
  | { state: "not_recorded" }
  | {
      state: "available" | "unavailable";
      records: WorkflowRecord[];
      joins: { record: WorkflowRecord; state: "available" | "unavailable" }[];
    };

export function contributionUse(
  branch: WorkflowBranch,
  records: WorkflowRecord[],
): ContributionUse {
  const joins = records.filter(
    (record) =>
      record.annotation.action === "join" &&
      record.annotation.inputs.some(
        (input) => input.branchId === branch.delegation.id,
      ),
  );
  if (!joins.length) return { state: "not_recorded" };
  const uses = joins.map((record) => {
    const available =
      record.annotation.action === "join" &&
      record.annotation.inputs
        .filter((input) => input.branchId === branch.delegation.id)
        .every(
          (input) =>
            branch.runs.some((run) => run.runId === input.result.runId) &&
            record.evidence.some(
              (evidence) =>
                evidence.state === "available" &&
                evidence.reference.runId === input.result.runId &&
                evidence.reference.eventId === input.result.eventId,
            ),
        );
    return {
      record,
      state: available ? "available" : "unavailable",
    } satisfies { record: WorkflowRecord; state: "available" | "unavailable" };
  });
  return {
    state: uses.every((use) => use.state === "available")
      ? "available"
      : "unavailable",
    records: joins,
    joins: uses,
  };
}
export const contributionUseLabel = (use: ContributionUse) =>
  use.state === "available"
    ? "Parent declared use"
    : use.state === "unavailable"
      ? "Use declared · evidence unavailable"
      : "Parent use not recorded";
const label = (value: string) =>
  value.replace(/[-_]/g, " ").replace(/^./, (letter) => letter.toUpperCase());

// Both views are projections of the same bounded capture. They do not enlarge
// historical evaluation evidence or infer a dependency from nearby timestamps.
export function buildWorkView(
  capture: WorkflowCapture,
  parents: readonly AgentRun[],
): WorkView {
  const entries: { node: WorkNode; at: number; order: number }[] = [];
  let order = 0;
  for (const flow of workflowFlows(capture.records)) {
    if (flow.selection) {
      const record = flow.selection,
        annotation = record.annotation;
      if (annotation.action === "select")
        entries.push({
          at: record.recordedAt,
          order: order++,
          node: {
            id: record.eventId,
            title: routeDefinitions[annotation.route].label,
            summary: annotation.reason,
            status: "Route declared",
            item: { kind: "record", record },
          },
        });
    }
    for (const node of flow.nodes) {
      if (node.kind === "phase") {
        const first = node.records[0],
          last = node.records.at(-1);
        if (first)
          entries.push({
            at: first.recordedAt,
            order: order++,
            node: {
              id: first.eventId,
              title: label(node.phase),
              summary:
                last?.annotation.action === "phase"
                  ? last.annotation.summary
                  : "",
              status:
                node.status === "started"
                  ? "Started · finish not recorded"
                  : label(node.status) + " · agent reported",
              item: { kind: "phase", phase: node },
            },
          });
      } else {
        const record = node.record,
          annotation = record.annotation;
        entries.push({
          at: record.recordedAt,
          order: order++,
          node: {
            id: record.eventId,
            title:
              node.kind === "join"
                ? "Parent uses child results"
                : "Route changed",
            summary:
              annotation.action === "join"
                ? annotation.summary
                : annotation.action === "change"
                  ? annotation.reason
                  : "",
            status: "Agent declaration",
            item: { kind: "record", record },
          },
        });
      }
    }
  }
  const contributionNodes: WorkNode[] = [];
  const edges: WorkEdge[] = [];
  const connect = (from: string, to: string, kind: WorkEdge["kind"]) =>
    edges.push({ id: `${kind}:${from}:${to}`, from, to, kind });
  for (const branch of capture.branches) {
    const childId = `child:${branch.delegation.id}`,
      dispatchId = `dispatch:${branch.delegation.id}`;
    const use = contributionUse(branch, capture.records);
    entries.push({
      at: branch.delegation.startedAt ?? Infinity,
      order: order++,
      node: {
        id: dispatchId,
        title: "Delegate: " + (branch.delegation.title || "Agent task"),
        summary:
          branch.delegation.startedAt === null
            ? "Dispatch time unavailable; position is not a chronology claim."
            : "Separate child conversation",
        status: "Host task record",
        item: { kind: "dispatch", branch },
      },
    });
    contributionNodes.push({
      id: childId,
      title: branch.delegation.title || "Delegated agent",
      summary: `${branch.runs.length} captured ${branch.runs.length === 1 ? "turn" : "turns"} · ${contributionUseLabel(use)}`,
      status: "Task " + branch.delegation.status,
      item: { kind: "contribution", branch },
    });
    connect(dispatchId, childId, "delegation");
    if (use.state !== "not_recorded")
      for (const join of use.joins)
        connect(
          childId,
          join.record.eventId,
          join.state === "available" ? "use" : "unresolved_use",
        );
  }
  for (const result of capture.results) {
    const branch = capture.branches.find(
      (branch) =>
        branch.delegation.id === result.delegationId &&
        branch.parentRunId === result.reference.runId,
    );
    if (!branch) continue;
    // Observation arrival is not a parent workflow step. Keep these inspectable
    // off the sequence spine, without assigning an invented delivery position.
    contributionNodes.push({
      id: result.reference.eventId,
      title:
        result.observation.state === "present"
          ? "Result present in parent capture"
          : result.observation.state === "delivered"
            ? "Host delivered result"
            : "Terminal result acknowledged",
      summary: branch.delegation.title || "Delegated agent result",
      status:
        result.observation.state === "present"
          ? "Presence observed · receipt not established"
          : result.observation.state === "delivered"
            ? "Host delivery classification · time unknown"
            : "Explicit terminal-result read · time unknown",
      item: { kind: "result", result },
    });
    if (result.observation.state !== "present")
      connect(
        `child:${result.delegationId}`,
        result.reference.eventId,
        "result",
      );
  }
  entries.sort((a, b) => a.at - b.at || a.order - b.order);
  const main = entries.map((entry) => entry.node.id);
  entries.forEach((entry, index) => {
    const prior = entries[index - 1];
    if (prior && Number.isFinite(prior.at) && Number.isFinite(entry.at))
      connect(prior.node.id, entry.node.id, "sequence");
  });
  const nodes = [...entries.map((entry) => entry.node), ...contributionNodes];
  if (capture.reads.length)
    nodes.push({
      id: "observed-skills",
      title: "Observed skill reads",
      summary: `${capture.reads.length} reads across ${new Set(capture.reads.map((read) => read.skill.name)).size} skills`,
      status: "Reads do not establish application",
      item: { kind: "skills", reads: capture.reads },
    });
  // An annotation-free parent remains a useful anchor for orphaned capture.
  if (!main.length && !nodes.length && parents.length)
    nodes.push({
      id: "observed-skills",
      title: "No workflow captured",
      summary: "Open the linked parent traces to inspect activity.",
      status: "Capture unavailable",
      item: { kind: "skills", reads: [] },
    });
  return { nodes, main, edges };
}
