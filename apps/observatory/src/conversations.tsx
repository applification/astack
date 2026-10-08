import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@astack/observatory-backend/api";
import { runSchema, type AgentRun } from "@astack/agent-observability";
import {
  conversationGroupSchema,
  runConversation,
  type ConversationGroup,
} from "@astack/agent-observability/conversations";
import { sessionReferenceKey } from "@astack/agent-observability/delegation";
import {
  activityHeading,
  type RunNames,
} from "@astack/agent-observability/naming";
import { Button } from "@astack/ui";
import { useRunNames } from "./run-names";
import { RunStatus } from "./scheduled-tasks";
import type { ReactNode } from "react";

export const threadLink = (id: string, projectId: string) =>
  `#thread/${encodeURIComponent(id)}?${new URLSearchParams({ project: projectId })}`;

export function ConversationGroupsTable({
  groups,
}: {
  groups: readonly ConversationGroup[];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Orchestration thread</th>
            <th>Captured turns</th>
            <th>Last activity</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={group.id}>
              <td>
                <a
                  className="row-title"
                  href={threadLink(group.id, group.projectId)}
                >
                  {group.title}
                </a>
                <span className="secondary">
                  {group.machineName} ·{" "}
                  {group.root.kind === "t3" ? "T3" : "Codex"}
                </span>
              </td>
              <td>
                {group.turns}
                <span className="secondary">
                  {group.turns - group.delegatedTurns} parent ·{" "}
                  {group.delegatedTurns} delegated
                </span>
              </td>
              <td>{new Date(group.lastActivityAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ConversationGroups({ projectId }: { projectId?: string }) {
  const query = usePaginatedQuery(
    api.conversations.groups,
    projectId ? { projectId } : {},
    { initialNumItems: 25 },
  );
  const groups = query.results.map((value) =>
    conversationGroupSchema.parse(JSON.parse(value)),
  );
  return (
    <section aria-label="Orchestration threads">
      <h2>Orchestration threads</h2>
      <p className="secondary">
        Follow each parent conversation and its delegated work across turns and
        providers. Individual tasks keep their own evaluations.
      </p>
      {query.status === "LoadingFirstPage" ? (
        <p role="status">Loading threads…</p>
      ) : groups.length ? (
        <ConversationGroupsTable groups={groups} />
      ) : (
        <p className="empty">No captured conversation groups in this page.</p>
      )}
      {(query.status === "CanLoadMore" || query.status === "LoadingMore") && (
        <Button
          disabled={query.status === "LoadingMore"}
          onClick={() => query.loadMore(25)}
        >
          Load more threads
        </Button>
      )}
    </section>
  );
}

type ConversationNode = {
  key: string;
  parent: string | null;
  title: string;
  runs: AgentRun[];
  role: string;
  tasks: { id: string; title: string; status: string }[];
};
export function ConversationTree({
  group,
  runs,
  names = [],
  exhausted = true,
}: {
  group: ConversationGroup;
  runs: readonly AgentRun[];
  names?: readonly RunNames[];
  exhausted?: boolean;
}) {
  const rootKey = sessionReferenceKey(group.root);
  const nodes = new Map<string, ConversationNode>();
  nodes.set(rootKey, {
    key: rootKey,
    parent: null,
    title: group.title,
    runs: [],
    role: "Parent thread",
    tasks: [],
  });
  for (const run of runs) {
    const conversation = runConversation(run);
    if (!conversation) continue;
    const key = sessionReferenceKey(conversation.self);
    const parent =
      key === rootKey
        ? null
        : conversation.parent?.relationship === "subagent"
          ? sessionReferenceKey(conversation.parent.reference)
          : rootKey;
    const node = nodes.get(key) ?? {
      key,
      parent,
      title: activityHeading(
        run,
        names.find((name) => name.runId === run.id),
      ),
      runs: [],
      role: "Delegated conversation",
      tasks: [],
    };
    node.runs.push(run);
    nodes.set(key, node);
  }
  // A pagination gap is different from a child that has never been captured.
  for (const node of [...nodes.values()]) {
    if (node.parent && !nodes.has(node.parent))
      nodes.set(node.parent, {
        key: node.parent,
        parent: rootKey,
        title: exhausted
          ? "Parent conversation capture unavailable"
          : "Parent conversation not loaded",
        runs: [],
        role: "Ancestry gap",
        tasks: [],
      });
    for (const run of node.runs)
      for (const delegation of run.delegations) {
        const key = delegation.child
          ? sessionReferenceKey(delegation.child)
          : JSON.stringify([node.key, "unresolved-task", delegation.id]);
        const child = nodes.get(key);
        if (child) {
          if (
            child.key !== rootKey &&
            !child.tasks.some((task) => task.id === delegation.id)
          )
            child.tasks.push({
              id: delegation.id,
              title: delegation.title,
              status: delegation.status,
            });
        } else
          nodes.set(key, {
            key,
            parent: node.key,
            title: delegation.title,
            runs: [],
            role: exhausted
              ? "Child capture unavailable in this group"
              : "No child turns loaded yet",
            tasks: [
              {
                id: delegation.id,
                title: delegation.title,
                status: delegation.status,
              },
            ],
          });
      }
  }
  const rendered = new Set<string>();
  const render = (
    node: ConversationNode,
    seen: ReadonlySet<string>,
    depth: number,
  ): ReactNode => {
    if (seen.has(node.key) || depth >= 16)
      return (
        <p className="notice" key={node.key}>
          Captured ancestry cannot be expanded further.
        </p>
      );
    const path = new Set([...seen, node.key]);
    rendered.add(node.key);
    const children = [...nodes.values()].filter(
      (child) => child.parent === node.key,
    );
    return (
      <li key={node.key} data-conversation-key={node.key}>
        <details open>
          <summary>
            {node.title}{" "}
            <span className="secondary">
              {node.role} · {node.runs.length} turns loaded
            </span>
          </summary>
          {node.tasks.length > 0 && (
            <ul aria-label="Delegated tasks">
              {node.tasks.map((task) => (
                <li key={task.id}>
                  {task.title} · {task.status}
                </li>
              ))}
            </ul>
          )}
          {node.runs.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Turn</th>
                    <th>Provider</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {node.runs.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <a
                          href={`#run/${encodeURIComponent(run.id)}?${new URLSearchParams({ project: group.projectId })}`}
                        >
                          {activityHeading(
                            run,
                            names.find((name) => name.runId === run.id),
                          )}
                        </a>
                        <span className="secondary">
                          {new Date(run.startedAt).toLocaleString()}
                          {run.conversation?.hostRun?.ordinal
                            ? ` · Host run ${run.conversation.hostRun.ordinal}`
                            : ""}
                        </span>
                        {run.work && (
                          <a
                            className="secondary"
                            href={`#runs?${new URLSearchParams({ project: group.projectId, work: run.work.id })}`}
                          >
                            Work · {run.work.id}
                          </a>
                        )}
                      </td>
                      <td>{run.agent}</td>
                      <td>
                        <RunStatus run={run} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="secondary">
              {node.key === rootKey
                ? group.rootRunId
                  ? "Parent turns are not in the loaded pages yet."
                  : "The parent conversation has no available capture."
                : node.role}
            </p>
          )}
          {children.length > 0 && (
            <ul className="conversation-tree">
              {children.map((child) => render(child, path, depth + 1))}
            </ul>
          )}
        </details>
      </li>
    );
  };
  const rootTree = render(nodes.get(rootKey)!, new Set(), 0);
  const disconnected = [...nodes.values()].filter(
    (node) => !rendered.has(node.key),
  );
  return (
    <ul className="conversation-tree" aria-label="Conversation hierarchy">
      {rootTree}
      {disconnected.length > 0 && (
        <li className="notice">
          Some captured ancestry is disconnected from the parent thread.
          <ul>
            {disconnected
              .filter((node) => !rendered.has(node.key))
              .map((node) => render(node, new Set(), 0))}
          </ul>
        </li>
      )}
    </ul>
  );
}

export function ConversationPage({
  id,
  projectId,
}: {
  id: string;
  projectId?: string;
}) {
  const scope = projectId ? { projectId } : {};
  const raw = useQuery(api.conversations.group, { groupId: id, ...scope });
  const query = usePaginatedQuery(
    api.conversations.turns,
    { groupId: id, ...scope },
    { initialNumItems: 50 },
  );
  const runs = query.results.map((value) => runSchema.parse(JSON.parse(value)));
  const names = useRunNames(runs);
  if (raw === undefined)
    return <p role="status">Loading orchestration thread…</p>;
  if (raw === null)
    return (
      <p className="empty">
        This conversation group is unavailable in the selected project.
      </p>
    );
  const group = conversationGroupSchema.parse(JSON.parse(raw));
  return (
    <>
      <a href={`#work?${new URLSearchParams({ project: group.projectId })}`}>
        Back to work
      </a>
      <p className="eyebrow">Orchestration thread</p>
      <h1>{group.title}</h1>
      <p className="subtitle">
        {group.turns} captured turns · {group.delegatedTurns} delegated ·{" "}
        {group.machineName}
      </p>
      <p className="secondary">
        This groups related conversations. Turn completion does not establish
        parent integration or a task's outcome.
      </p>
      <ConversationTree
        group={group}
        runs={runs}
        names={names}
        exhausted={query.status === "Exhausted"}
      />
      {(query.status === "CanLoadMore" || query.status === "LoadingMore") && (
        <Button
          disabled={query.status === "LoadingMore"}
          onClick={() => query.loadMore(50)}
        >
          Load more turns
        </Button>
      )}
    </>
  );
}
