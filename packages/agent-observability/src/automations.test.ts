import { expect, test } from "bun:test";
import {
  automationKey,
  automationSchema,
  mergeAutomation,
  scheduleLabel,
} from "./automations";
import { evaluationRun } from "./evaluation-fixtures";

test("task identities distinguish machines and unknown sessions while optional metadata stays compatible", () => {
  const run = evaluationRun();
  const automation = automationSchema.parse({
    provider: "codex",
    id: "daily-check",
    name: "Daily check",
    schedule: null,
  });
  expect(automationKey(run)).toBeNull();
  const first = automationKey({ ...run, automation });
  expect(first).toBe(
    JSON.stringify([run.machineId, "codex", ["task", "daily-check"]]),
  );
  expect(
    automationKey({ ...run, machineId: "another-machine", automation }),
  ).not.toBe(first);
  const unknown = { ...automation, id: null };
  expect(automationKey({ ...run, automation: unknown })).not.toBe(
    automationKey({
      ...run,
      sessionId: "another-session",
      automation: unknown,
    }),
  );
});

test("partial observations preserve known automation facts and fresher schedules replace older snapshots", () => {
  const known = automationSchema.parse({
    provider: "codex",
    id: "daily-check",
    name: "Daily check",
    schedule: {
      description: "Daily · 09:00",
      state: "active",
      nextRunAt: 9000,
      observedAt: 1000,
    },
  });
  expect(
    mergeAutomation(known, {
      provider: "codex",
      id: null,
      name: null,
      schedule: null,
    }),
  ).toEqual(known);
  expect(
    mergeAutomation(known, {
      ...known,
      schedule: {
        description: "Daily · 09:00",
        state: "paused",
        nextRunAt: null,
        observedAt: 2000,
      },
    })?.schedule,
  ).toEqual({
    description: "Daily · 09:00",
    state: "paused",
    nextRunAt: null,
    observedAt: 2000,
  });
  expect(
    mergeAutomation(known, {
      ...known,
      id: "other-task",
      name: null,
      schedule: null,
    })?.name,
  ).toBeNull();
});

test("schedule summaries describe supported recurrences without misrepresenting custom schedules", () => {
  expect(
    scheduleLabel(
      "RRULE:FREQ=WEEKLY;BYHOUR=9;BYMINUTE=0;BYDAY=SU,MO,TU,WE,TH,FR,SA",
    ),
  ).toBe("Daily · 09:00");
  expect(scheduleLabel("FREQ=WEEKLY;BYDAY=MO,FR;BYHOUR=14;BYMINUTE=30")).toBe(
    "Weekly · Mon, Fri · 14:30",
  );
  expect(scheduleLabel("FREQ=HOURLY;INTERVAL=2;BYMINUTE=5")).toBe(
    "Every 2 hours · minute 05",
  );
  expect(scheduleLabel("FREQ=MONTHLY;BYMONTHDAY=1")).toBe("Custom schedule");
  expect(scheduleLabel("FREQ=DAILY;BYHOUR=9,12")).toBe("Custom schedule");
  expect(scheduleLabel("FREQ=DAILY;BYHOUR=27")).toBe("Custom schedule");
});
