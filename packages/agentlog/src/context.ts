import {
  launchContextSchema,
  eventCapabilities,
  type AgentRun,
} from "@astack/agent-observability";
import { detectProblems } from "@astack/agent-observability/analysis";
import type { LocalStore } from "./store";

export function refreshRun(store: LocalStore, run: AgentRun) {
  const events = store.events(run.id);
  run.skills = [
    ...new Map(
      events.flatMap((event) =>
        eventCapabilities(event).map(
          (skill) => [JSON.stringify(skill), skill] as const,
        ),
      ),
    ).values(),
  ].slice(0, 250);
  run.tools = [
    ...new Set(events.flatMap((event) => (event.tool ? [event.tool] : []))),
  ].slice(0, 250);
  run.eventCount = events.length;
  run.findings = detectProblems(run, events);
  store.put({ kind: "run", value: run });
}

export function linkSession(
  store: LocalStore,
  sessionId: string,
  raw: unknown,
) {
  const context = launchContextSchema.parse(raw);
  store.setMeta(`context:${sessionId}`, JSON.stringify(context));
  // Completed sessions may never change again. Apply bindings immediately too.
  for (const run of store.runsForSession(sessionId))
    refreshRun(store, {
      ...run,
      ...context,
      ...(run.projectId ? { projectId: run.projectId } : {}),
    });
}
