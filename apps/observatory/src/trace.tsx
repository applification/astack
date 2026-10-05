import { useState } from "react";
import { Badge } from "@astack/ui";
import type { AgentEvent } from "@astack/agent-observability";
import {
  AlertCircle,
  BookOpen,
  Terminal,
  FilePenLine,
  Wrench,
  MessageSquare,
  GitBranch,
} from "lucide-react";

const clock = (timestamp: number) =>
  new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
function EventIcon({ event }: { event: AgentEvent }) {
  if (event.failed || event.kind === "error")
    return <AlertCircle size={16} aria-hidden="true" />;
  if (event.skill) return <BookOpen size={16} aria-hidden="true" />;
  if (event.kind === "file_edit")
    return <FilePenLine size={16} aria-hidden="true" />;
  if (event.kind.startsWith("shell") || event.kind.startsWith("test"))
    return <Terminal size={16} aria-hidden="true" />;
  if (event.kind.startsWith("subagent"))
    return <GitBranch size={16} aria-hidden="true" />;
  if (event.kind.includes("prompt") || event.kind.includes("output"))
    return <MessageSquare size={16} aria-hidden="true" />;
  return <Wrench size={16} aria-hidden="true" />;
}
export function Trace({ events }: { events: readonly AgentEvent[] }) {
  const [problemsOnly, setProblemsOnly] = useState(false);
  const visible = events.filter(
    (event) =>
      !problemsOnly ||
      event.failed ||
      ["error", "intervention"].includes(event.kind),
  );
  return (
    <section aria-label="Activity trace">
      <div className="toolbar">
        <h2>Activity trace</h2>
        <label>
          <span>
            <input
              type="checkbox"
              checked={problemsOnly}
              onChange={(e) => setProblemsOnly(e.target.checked)}
            />{" "}
            Failures and interventions only
          </span>
        </label>
      </div>
      <p className="subtitle">
        Recorded item order. Agent timestamps and hook observation times are
        labelled; missing times stay unknown.
      </p>
      {!visible.length ? (
        <p className="empty">
          {problemsOnly
            ? "No failures or interventions in the loaded trace."
            : "No events captured yet."}
        </p>
      ) : (
        <div className="trace">
          {visible.map((event) => (
            <details className="trace-event" key={event.id} id={event.id}>
              <summary>
                <span className="event-time">
                  {event.timestamp === null
                    ? "Time unavailable"
                    : clock(event.timestamp)}
                </span>
                <span className={event.failed ? "negative" : "neutral"}>
                  <EventIcon event={event} />
                </span>
                <span className="event-title">{event.title}</span>
                {event.failed && <Badge>Failed</Badge>}
                <span className="event-kind">
                  {event.kind.replaceAll("_", " ")}
                </span>
              </summary>
              <div className="secondary">
                {event.durationMs !== undefined &&
                  `${(event.durationMs / 1000).toFixed(2)}s · `}
                {event.signature &&
                  `Signature ${event.signature.slice(0, 12)} · `}
                Timing: {event.timing} · Observed{" "}
                {new Date(event.observedAt).toLocaleString()}
              </div>
              {event.skill && (
                <p className="notice">
                  {event.skill.name} ·{" "}
                  {event.skill.hash?.slice(0, 12) ?? "Version unknown"} ·{" "}
                  {event.skill.provenance.replaceAll("_", " ")} ·{" "}
                  {event.skill.evidence}
                </p>
              )}
              <pre>{JSON.stringify(event.data, null, 2)}</pre>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
