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
const contentPreference = "astack-observatory-show-content";
const contentFields = [
  { key: "content", label: "Message" },
  { key: "command", label: "Command" },
  { key: "arguments", label: "Arguments" },
  { key: "output", label: "Output" },
  { key: "result", label: "Result" },
  { key: "error", label: "Error" },
] as const;
function initialShowContent() {
  try {
    return localStorage.getItem(contentPreference) !== "hide";
  } catch {
    return true;
  }
}
function EventData({
  event,
  showContent,
}: {
  event: AgentEvent;
  showContent: boolean;
}) {
  const details = contentFields.flatMap(({ key, label }) => {
    const value = event.data[key];
    return value === undefined || value === null ? [] : [{ key, label, value }];
  });
  const metadata = Object.fromEntries(
    Object.entries(event.data).filter(
      ([key]) => !contentFields.some((field) => field.key === key),
    ),
  );
  return (
    <>
      {details.length > 0 && !showContent && (
        <p className="subtitle">
          Content hidden. Enable Show content to read captured details.
        </p>
      )}
      {showContent &&
        details.map(({ key, label, value }) => (
          <div className="event-content" key={key}>
            <h3>{label}</h3>
            {value === "[WITHHELD]" ? (
              <p className="subtitle">
                Content was not captured for this event.
              </p>
            ) : (
              <pre>
                {typeof value === "string"
                  ? value
                  : JSON.stringify(value, null, 2)}
              </pre>
            )}
          </div>
        ))}
      {Object.keys(metadata).length > 0 && (
        <pre>{JSON.stringify(metadata, null, 2)}</pre>
      )}
    </>
  );
}
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
  const [showContent, setShowContent] = useState(initialShowContent);
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
              checked={showContent}
              onChange={(e) => {
                const show = e.target.checked;
                setShowContent(show);
                try {
                  localStorage.setItem(
                    contentPreference,
                    show ? "show" : "hide",
                  );
                } catch {
                  // The control still works when browser storage is unavailable.
                }
              }}
            />{" "}
            Show content
          </span>
        </label>
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
      <p className="subtitle">
        {showContent
          ? "Conversation and tool details are visible. Known secrets remain redacted."
          : "Conversation and tool content is hidden on this screen. Capture continues privately."}
      </p>
      {!visible.length ? (
        <p className="empty">
          {problemsOnly
            ? "No failures or interventions in the loaded trace."
            : "No events captured yet."}
        </p>
      ) : (
        <div className="trace">
          {visible.map((event) => {
            const preview = showContent
              ? (event.data.content ?? event.data.command)
              : null;
            return (
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
                  <span className="event-title">
                    {event.title}
                    {typeof preview === "string" &&
                      preview !== "[WITHHELD]" && (
                        <span className="event-preview">
                          {preview.slice(0, 180)}
                          {preview.length > 180 ? "…" : ""}
                        </span>
                      )}
                  </span>
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
                <EventData event={event} showContent={showContent} />
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}
