import { z } from "zod";
import type { AgentRun } from "./domain";

export const automationSchema = z
  .object({
    provider: z.literal("codex"),
    id: z.string().min(1).max(512).nullable(),
    name: z.string().max(4096).nullable(),
    schedule: z
      .object({
        description: z.string().min(1).max(4096),
        state: z.enum(["active", "paused", "unknown"]),
        nextRunAt: z.number().finite().nonnegative().nullable(),
        observedAt: z.number().finite().nonnegative(),
      })
      .strict()
      .nullable(),
  })
  .strict();
export type Automation = z.infer<typeof automationSchema>;

export function mergeAutomation(
  previous: Automation | undefined,
  incoming: Automation | undefined,
): Automation | undefined {
  if (!previous) return incoming;
  if (!incoming) return previous;
  if (
    incoming.id !== null &&
    previous.id !== null &&
    incoming.id !== previous.id
  )
    return incoming;
  return {
    provider: incoming.provider,
    id: incoming.id ?? previous.id,
    name: incoming.name ?? previous.name,
    schedule:
      incoming.schedule &&
      (!previous.schedule ||
        incoming.schedule.observedAt >= previous.schedule.observedAt)
        ? incoming.schedule
        : previous.schedule,
  };
}

export function automationKey(run: AgentRun): string | null {
  return run.automation
    ? JSON.stringify([
        run.machineId,
        run.automation.provider,
        run.automation.id === null
          ? ["session", run.sessionId]
          : ["task", run.automation.id],
      ])
    : null;
}

export function automationName(automation: Automation): string {
  return (
    automation.name?.trim() || automation.id || "Unidentified scheduled task"
  );
}

export function scheduleLabel(recurrence: string): string {
  const fields = new Map(
    recurrence
      .replace(/^RRULE:/, "")
      .split(";")
      .map((field) => {
        const [key = "", value = ""] = field.split("=");
        return [key, value];
      }),
  );
  if (
    [...fields.keys()].some(
      (key) =>
        !["FREQ", "INTERVAL", "BYDAY", "BYHOUR", "BYMINUTE"].includes(key),
    )
  )
    return "Custom schedule";
  const interval = Number(fields.get("INTERVAL") ?? 1);
  const frequency = fields.get("FREQ");
  const units =
    frequency === "DAILY"
      ? "day"
      : frequency === "WEEKLY"
        ? "week"
        : frequency === "HOURLY"
          ? "hour"
          : null;
  if (!units || !Number.isSafeInteger(interval) || interval < 1)
    return "Custom schedule";
  const days = fields.get("BYDAY")?.split(",");
  const names = new Map([
    ["MO", "Mon"],
    ["TU", "Tue"],
    ["WE", "Wed"],
    ["TH", "Thu"],
    ["FR", "Fri"],
    ["SA", "Sat"],
    ["SU", "Sun"],
  ]);
  const everyDay =
    days?.length === 7 &&
    new Set(days).size === 7 &&
    days.every((day) => names.has(day));
  let label =
    everyDay && interval === 1 && frequency === "WEEKLY"
      ? "Daily"
      : interval === 1
        ? frequency === "DAILY"
          ? "Daily"
          : frequency === "WEEKLY"
            ? "Weekly"
            : "Hourly"
        : `Every ${interval} ${units}s`;
  if (days && !everyDay) {
    const readable = days.map((day) => names.get(day));
    if (readable.some((day) => day === undefined)) return "Custom schedule";
    label += ` · ${readable.join(", ")}`;
  }
  const hour = fields.get("BYHOUR");
  const minute = fields.get("BYMINUTE");
  if (hour !== undefined || minute !== undefined) {
    if (
      frequency === "HOURLY" &&
      hour === undefined &&
      minute !== undefined &&
      /^\d{1,2}$/.test(minute) &&
      Number(minute) < 60
    )
      return `${label} · minute ${minute.padStart(2, "0")}`;
    if (
      hour === undefined ||
      !/^\d{1,2}$/.test(hour) ||
      Number(hour) > 23 ||
      (minute !== undefined &&
        (!/^\d{1,2}$/.test(minute) || Number(minute) > 59))
    )
      return "Custom schedule";
    label += ` · ${hour.padStart(2, "0")}:${(minute ?? "0").padStart(2, "0")}`;
  }
  return label;
}
