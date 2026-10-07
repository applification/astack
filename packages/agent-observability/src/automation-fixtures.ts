import { runSchema } from "./domain";
import { automationSchema } from "./automations";

export const automationFixtureProject = "00000000-0000-4000-8000-000000000100";
export const automationFixtureMachine = "00000000-0000-4000-8000-000000000001";
export const fixtureAutomation = automationSchema.parse({
  provider: "codex",
  id: "daily-health",
  name: "Daily health scan",
  schedule: {
    description: "Daily · 09:00",
    state: "active",
    nextRunAt: Date.parse("2026-10-08T09:00:00Z"),
    observedAt: Date.parse("2026-10-07T09:10:00Z"),
  },
});

export function automationFixtureRuns() {
  return [
    "latest",
    "older",
    "paused",
    "other-machine",
    "unidentified",
    "interactive",
  ].map((variant, index) => {
    const machineId =
      variant === "other-machine"
        ? "00000000-0000-4000-8000-000000000002"
        : automationFixtureMachine;
    const startedAt =
      Date.parse(
        variant === "older" ? "2026-10-06T09:00:00Z" : "2026-10-07T09:00:00Z",
      ) +
      index * 1000;
    const automation =
      variant === "interactive"
        ? undefined
        : variant === "unidentified"
          ? { provider: "codex", id: null, name: null, schedule: null }
          : variant === "paused"
            ? {
                ...fixtureAutomation,
                id: "weekly-summary",
                name: "Weekly summary",
                schedule: {
                  description: "Weekly · Fri · 15:30",
                  state: "paused",
                  nextRunAt: null,
                  observedAt: Date.parse("2026-10-07T09:10:00Z"),
                },
              }
            : fixtureAutomation;
    return runSchema.parse({
      id: `${machineId}:codex:fixture-${variant}:turn`,
      machineId,
      machineName:
        variant === "other-machine" ? "Fixture laptop" : "Fixture desktop",
      agent: "codex",
      agentVersion: "fixture",
      sessionId: `fixture-${variant}`,
      attemptId: "turn",
      source: "Codex Desktop",
      projectId: automationFixtureProject,
      cwd: "/fixture/scheduled-tasks",
      title:
        variant === "interactive"
          ? "Interactive review"
          : `Scheduled activity ${variant}`,
      startedAt,
      completedAt: startedAt + 60_000,
      lastObservedAt: startedAt + 60_000,
      status: variant === "paused" ? "failed" : "completed",
      ...(automation ? { automation } : {}),
      skills: [],
      tools: [],
      findings: [],
      eventCount: 0,
      contentCapture: false,
      coverage: [],
    });
  });
}
