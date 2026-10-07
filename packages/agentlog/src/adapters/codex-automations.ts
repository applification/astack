import { Database } from "bun:sqlite";
import { join } from "node:path";
import { z } from "zod";
import {
  automationSchema,
  scheduleLabel,
  type Automation,
} from "@astack/agent-observability/automations";

const rowSchema = z.object({
  automation_id: z.string().min(1).max(512),
  name: z.unknown(),
  status: z.unknown(),
  rrule: z.unknown(),
  next_run_at: z.unknown(),
});

// The desktop database is an optional enrichment source. Native thread metadata
// still classifies automations when the database is absent or its schema changes.
export class CodexAutomations {
  private database: Database | null = null;
  constructor(home: string) {
    try {
      this.database = new Database(join(home, "sqlite", "codex-dev.db"), {
        readonly: true,
        create: false,
      });
    } catch {
      // CLI-only homes need not contain the desktop database.
    }
  }
  lookup(threadId: string, observedAt: number): Automation | undefined {
    if (!this.database) return undefined;
    try {
      const raw = this.database
        .query(
          `SELECT r.automation_id, a.name, a.status, a.rrule, a.next_run_at
        FROM automation_runs r LEFT JOIN automations a ON a.id = r.automation_id
        WHERE r.thread_id = ? LIMIT 1`,
        )
        .get(threadId);
      if (raw === null) return undefined;
      const parsed = rowSchema.safeParse(raw);
      if (!parsed.success) return undefined;
      const row = parsed.data;
      const name = automationSchema.shape.name.safeParse(row.name);
      const recurrence = z.string().min(1).max(4096).safeParse(row.rrule);
      const schedule = automationSchema.shape.schedule.unwrap().safeParse({
        description: recurrence.success ? scheduleLabel(recurrence.data) : null,
        state:
          row.status === "ACTIVE"
            ? "active"
            : row.status === "PAUSED"
              ? "paused"
              : "unknown",
        nextRunAt: row.next_run_at,
        observedAt,
      });
      return automationSchema.parse({
        provider: "codex",
        id: row.automation_id,
        name: name.success ? name.data : null,
        schedule: schedule.success ? schedule.data : null,
      });
    } catch {
      // Private desktop schemas vary by version; enrichment must fail open.
      return undefined;
    }
  }
  close() {
    this.database?.close();
  }
}
