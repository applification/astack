import { Clock } from "lucide-react";
import type { AgentRun } from "@astack/agent-observability";
import {
  automationKey,
  automationName,
  type Automation,
} from "@astack/agent-observability/automations";
import type { Project } from "@astack/agent-observability/projects";

const date = (value: number) =>
  new Date(value).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

function taskHistory(run: AgentRun, key: string) {
  return `#runs?${new URLSearchParams({ ...(run.projectId ? { project: run.projectId } : {}), automation: key })}`;
}

export function ScheduledBadge({ run }: { run: AgentRun }) {
  const key = automationKey(run);
  if (!run.automation || key === null) return null;
  const name = automationName(run.automation);
  return (
    <a
      className="inline-flex items-center gap-1"
      href={taskHistory(run, key)}
      title={name}
      aria-label={`Scheduled task: ${name}`}
    >
      <Clock size={14} aria-hidden="true" /> Scheduled
    </a>
  );
}

export function ScheduleSnapshot({ automation }: { automation: Automation }) {
  if (!automation.schedule)
    return <span className="secondary">Schedule unavailable</span>;
  const schedule = automation.schedule;
  return (
    <>
      <span>{schedule.description}</span>
      <span className="secondary">
        {schedule.state === "active"
          ? "Active"
          : schedule.state === "paused"
            ? "Paused"
            : "State unknown"}{" "}
        · observed {date(schedule.observedAt)}
      </span>
      <span className="secondary">
        Next run (last observed):{" "}
        {schedule.nextRunAt === null ? "Unavailable" : date(schedule.nextRunAt)}
      </span>
    </>
  );
}

export function RunStatus({ run }: { run: AgentRun }) {
  return (
    <span
      className={
        run.status === "failed"
          ? "negative"
          : run.status === "completed"
            ? "positive"
            : "neutral"
      }
    >
      {run.status === "completed"
        ? "Turn completed"
        : run.status === "running"
          ? "No completion observed"
          : run.status}
    </span>
  );
}

export function ScheduledTasksTable({
  runs,
  projects = [],
}: {
  runs: readonly AgentRun[];
  projects?: readonly Project[];
}) {
  const groups = new Map<
    string,
    { key: string; run: AgentRun; automation: Automation; count: number }
  >();
  for (const run of runs) {
    const key = automationKey(run);
    if (key === null || !run.automation) continue;
    const groupKey = JSON.stringify([run.projectId, key]);
    const previous = groups.get(groupKey);
    groups.set(groupKey, {
      key,
      run:
        !previous || run.startedAt > previous.run.startedAt
          ? run
          : previous.run,
      automation:
        !previous ||
        (run.automation.schedule?.observedAt ?? 0) >
          (previous.automation.schedule?.observedAt ?? 0)
          ? run.automation
          : previous.automation,
      count: (previous?.count ?? 0) + 1,
    });
  }
  if (!groups.size)
    return (
      <div className="empty">
        <h2>No captured scheduled tasks</h2>
        <p>
          Scheduled tasks appear here when the collector observes their
          automation metadata. Check capture health or clear the filters.
        </p>
      </div>
    );
  return (
    <>
      <p className="subtitle">
        Tasks and counts reflect loaded runs. Schedule times follow Codex’s
        configuration; state and next run are snapshots from the time of
        capture.
      </p>
      <p className="table-hint">Scroll horizontally to see all columns.</p>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label="Scheduled tasks table"
      >
        <table>
          <thead>
            <tr>
              <th>Task / machine</th>
              <th>Schedule last observed</th>
              <th>Latest captured run</th>
              <th>Runs loaded</th>
            </tr>
          </thead>
          <tbody>
            {[...groups]
              .sort(([, a], [, b]) => b.run.startedAt - a.run.startedAt)
              .map(([groupKey, { key, run, automation, count }]) => (
                <tr key={groupKey}>
                  <td>
                    <a
                      className="row-title inline-flex items-center gap-1"
                      href={taskHistory(run, key)}
                    >
                      <Clock size={16} aria-hidden="true" />
                      {automationName(automation)}
                    </a>
                    <span className="secondary">
                      {run.machineName} ·{" "}
                      {projects.find(
                        (project) => project.projectId === run.projectId,
                      )?.name ?? "Unassigned"}
                    </span>
                    {automation.id && (
                      <span className="secondary">{automation.id}</span>
                    )}
                    <a className="secondary" href={taskHistory(run, key)}>
                      View task history
                    </a>
                  </td>
                  <td>
                    <ScheduleSnapshot automation={automation} />
                  </td>
                  <td>
                    <a
                      href={`#run/${encodeURIComponent(run.id)}${run.projectId ? `?${new URLSearchParams({ project: run.projectId })}` : ""}`}
                    >
                      {run.startTimeKnown ? "Run" : "Session date"} ·{" "}
                      {date(run.startedAt)}
                    </a>
                    <span className="secondary">
                      <RunStatus run={run} />
                    </span>
                  </td>
                  <td>{count}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
