import { Button } from "@astack/ui";
import {
  networkEdgeLabels,
  type NetworkNode,
  type WorkNetwork,
} from "@astack/agent-observability/work-network";
import type { EvaluationDetail } from "@astack/agent-observability/evaluation-view";
import type { WorkflowActivity } from "@astack/agent-observability/workflow-view";
import { WorkEvidenceDetails } from "./work-evidence-details";
import { runLink } from "./evaluation-evidence";

function ActivityDetails({
  activity,
  projectId,
}: {
  activity: WorkflowActivity;
  projectId: string;
}) {
  return (
    <>
      <dl className="work-facts">
        <div>
          <dt>Event</dt>
          <dd>
            {activity.kind.replace(/_/g, " ")} · sequence {activity.sequence}
          </dd>
        </div>
        <div>
          <dt>Timing</dt>
          <dd>
            {activity.timestamp === null
              ? "Occurrence time unavailable"
              : new Date(activity.timestamp).toLocaleString()}{" "}
            · {activity.timing}
          </dd>
        </div>
        <div>
          <dt>Capture</dt>
          <dd>
            Revision {activity.revision} · observed{" "}
            {new Date(activity.observedAt).toLocaleString()}
          </dd>
        </div>
        {activity.tool && (
          <div>
            <dt>Tool</dt>
            <dd>{activity.tool}</dd>
          </div>
        )}
        <div>
          <dt>Failure marker</dt>
          <dd>
            {activity.failed
              ? "Failure recorded"
              : "No failure marker recorded"}
          </dd>
        </div>
        {activity.durationMs !== undefined && (
          <div>
            <dt>Recorded duration</dt>
            <dd>{activity.durationMs} ms</dd>
          </div>
        )}
      </dl>
      <a
        href={runLink(
          activity.reference.runId,
          projectId,
          activity.reference.eventId,
        )}
      >
        Event in full trace
      </a>
      <p className="secondary">
        This event is shown independently. Capture does not establish a
        call/result pair or a causal dependency.
      </p>
    </>
  );
}
export function WorkNetworkDetails({
  node,
  network,
  detail,
  onSelect,
  expanded,
  onExpanded,
}: {
  node: NetworkNode;
  network: WorkNetwork;
  detail: EvaluationDetail;
  onSelect: (id: string) => void;
  expanded: ReadonlySet<string>;
  onExpanded: (next: Set<string>) => void;
}) {
  const item = node.item,
    projectId = detail.evaluation.projectId;
  const links = network.edges.filter(
    (edge) => edge.from === node.id || edge.to === node.id,
  );
  return (
    <>
      <p className="secondary">{node.status}</p>
      {item.kind === "conversation" ? (
        <>
          <p>{node.summary}</p>
          <p className="secondary">
            {item.source === "snapshot"
              ? "Historical linked summary; current activity capture is unavailable."
              : item.source === "delegation"
                ? "Conversation scope comes from the host's direct task reference."
                : "Current readable run summaries establish this conversation scope."}
          </p>
          {item.reference && (
            <dl className="work-facts">
              <div>
                <dt>Conversation identity</dt>
                <dd>
                  {item.reference.kind === "t3"
                    ? item.reference.environmentId +
                      " / " +
                      item.reference.threadId
                    : item.reference.sessionId}
                </dd>
              </div>
            </dl>
          )}
          <Button
            variant="outline"
            aria-expanded={expanded.has(node.id)}
            onClick={() => {
              const next = new Set(expanded);
              if (!next.delete(node.id)) next.add(node.id);
              onExpanded(next);
            }}
          >
            {expanded.has(node.id)
              ? "Collapse captured activity"
              : "Show captured activity"}
          </Button>
          <ul className="work-reads">
            {item.runs.map((run) => (
              <li key={run.runId}>
                <a href={runLink(run.runId, projectId)}>
                  {run.title || "Captured turn"}
                </a>
                <p className="secondary">
                  {run.status} · capture revision {run.revision}
                </p>
                {run.activityLimited && (
                  <p className="notice">
                    Activity preview limit reached. Open the full trace for
                    remaining events.
                  </p>
                )}
              </li>
            ))}
          </ul>
          {!item.runs.length && (
            <p className="secondary">
              No readable turns captured for this scope.
            </p>
          )}
        </>
      ) : item.kind === "turn" ? (
        <>
          <p>{node.summary}</p>
          <a href={runLink(item.run.runId, projectId)}>Open turn trace</a>
          {item.run.activityLimited && (
            <p className="notice">
              This turn's activity preview reached a limit. The graph is
              incomplete; inspect the full trace.
            </p>
          )}
        </>
      ) : item.kind === "contribution" ||
        item.kind === "record" ||
        item.kind === "result" ? (
        <WorkEvidenceDetails node={{ ...node, item }} detail={detail} />
      ) : item.kind === "activity" ? (
        <ActivityDetails activity={item.activity} projectId={projectId} />
      ) : item.kind === "evidence" ? (
        <>
          <p>{node.summary}</p>
          <a
            href={runLink(
              item.evidence.reference.runId,
              projectId,
              item.evidence.reference.eventId,
            )}
          >
            Referenced event in trace
          </a>
          {item.evidence.state === "available" && (
            <p className="secondary">
              Capture revision {item.evidence.revision}
            </p>
          )}
          {item.activity && (
            <ActivityDetails activity={item.activity} projectId={projectId} />
          )}
        </>
      ) : (
        <>
          <p>{node.summary}</p>
          <dl className="work-facts">
            <div>
              <dt>Capability</dt>
              <dd>
                {item.skill.kind} · {item.skill.name}
              </dd>
            </div>
            <div>
              <dt>Version provenance</dt>
              <dd>{item.skill.provenance.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Hash</dt>
              <dd>
                {item.skill.hash ??
                  "Unavailable; matching names are not merged"}
              </dd>
            </div>
          </dl>
          {item.skill.provenance === "observation_time" && (
            <p className="secondary">
              The hash was read during observation. It does not establish the
              version available when the agent used the skill.
            </p>
          )}
          <ul className="work-reads">
            {item.reads.map((read) => (
              <li key={JSON.stringify(read.reference)}>
                <a
                  href={runLink(
                    read.reference.runId,
                    projectId,
                    read.reference.eventId,
                  )}
                >
                  {read.skill.evidence.replace(/_/g, " ")} · revision{" "}
                  {read.revision}
                </a>
                {read.skill.path && (
                  <p className="secondary">{read.skill.path}</p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      <section aria-label="Connected nodes">
        <h4>Connected capture</h4>
        {links.length ? (
          <ul className="work-network-neighbors">
            {links.slice(0, 24).map((edge) => {
              const incoming = edge.to === node.id;
              const neighbor = network.nodes.find(
                (candidate) =>
                  candidate.id === (incoming ? edge.from : edge.to),
              );
              return neighbor ? (
                <li key={edge.id}>
                  <span className="secondary">
                    {incoming ? "Incoming" : "Outgoing"} ·{" "}
                    {networkEdgeLabels[edge.kind]}
                  </span>
                  <Button variant="ghost" onClick={() => onSelect(neighbor.id)}>
                    {neighbor.title}
                  </Button>
                </li>
              ) : null;
            })}
          </ul>
        ) : (
          <p className="secondary">No relationships captured.</p>
        )}
        {links.length > 24 && (
          <p className="secondary">
            Showing 24 of {links.length} captured links. Expand the graph to
            explore the rest.
          </p>
        )}
      </section>
    </>
  );
}
