import { Database } from "bun:sqlite";
import { chmodSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  recordSchema,
  envelopeSchema,
  eventSchema,
  type TelemetryRecord,
  type AgentEvent,
  type AgentRun,
} from "@astack/agent-observability";
import { redact } from "@astack/agent-observability/redaction";
import {
  projectPolicySchema,
  resolveProject,
  type Project,
} from "@astack/agent-observability/projects";

type Row = { key: string; payload: string; revision: number };
export class LocalStore {
  readonly db: Database;
  constructor(
    directory: string,
    private readonly secrets: readonly string[] = [],
  ) {
    process.umask(0o077);
    mkdirSync(directory, { recursive: true, mode: 0o700 });
    chmodSync(directory, 0o700);
    const path = join(directory, "queue.sqlite");
    this.db = new Database(path, { create: true, strict: true });
    chmodSync(path, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
      CREATE TABLE IF NOT EXISTS records(key TEXT PRIMARY KEY, run_id TEXT NOT NULL, kind TEXT NOT NULL, payload TEXT NOT NULL, revision INTEGER NOT NULL, delivered INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS by_pending ON records(delivered,revision);
      CREATE INDEX IF NOT EXISTS by_run ON records(run_id,kind);
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT OR IGNORE INTO meta VALUES('revision','0');`);
  }
  put(record: TelemetryRecord) {
    const safe = recordSchema.parse(redact(record, this.secrets));
    if (Buffer.byteLength(JSON.stringify(safe)) > 128 * 1024) {
      if (safe.kind === "event")
        safe.value.data = {
          omitted: "Large event detail omitted at the 128 KiB record budget",
        };
      else {
        safe.value.skills = safe.value.skills.slice(0, 25);
        safe.value.tools = safe.value.tools.slice(0, 25);
        safe.value.findings = safe.value.findings.slice(0, 10);
        while (
          Buffer.byteLength(JSON.stringify(safe)) > 128 * 1024 &&
          (safe.value.skills.length ||
            safe.value.tools.length ||
            safe.value.findings.length)
        ) {
          if (safe.value.findings.length) safe.value.findings.pop();
          else if (safe.value.skills.length) safe.value.skills.pop();
          else safe.value.tools.pop();
        }
        safe.value.coverage = [
          ...safe.value.coverage.slice(0, 28),
          "Metadata lists bounded at the 128 KiB record budget",
        ];
      }
    }
    const key = `${safe.kind}:${safe.value.id}`;
    return this.db.transaction(() => {
      const existing = this.db
        .query<Row, [string]>(
          "SELECT key,payload,revision FROM records WHERE key=?",
        )
        .get(key);
      // Observation time is the first capture time for an unchanged event.
      if (existing && safe.kind === "event") {
        const previous = recordSchema.parse(JSON.parse(existing.payload));
        if (previous.kind === "event")
          safe.value.observedAt = previous.value.observedAt;
      }
      const payload = JSON.stringify(safe);
      if (existing?.payload === payload) return false;
      this.db.exec(
        "UPDATE meta SET value=CAST(value AS INTEGER)+1 WHERE key='revision'",
      );
      const revision = Number(this.getMeta("revision"));
      this.db
        .query(
          "INSERT INTO records(key,run_id,kind,payload,revision,delivered) VALUES(?,?,?,?,?,0) ON CONFLICT(key) DO UPDATE SET payload=excluded.payload,revision=excluded.revision,delivered=0",
        )
        .run(
          key,
          safe.kind === "run" ? safe.value.id : safe.value.runId,
          safe.kind,
          payload,
          revision,
        );
      return true;
    })();
  }
  events(runId: string): AgentEvent[] {
    return this.db
      .query<{ payload: string }, [string]>(
        "SELECT payload FROM records WHERE run_id=? AND kind='event' ORDER BY revision",
      )
      .all(runId)
      .flatMap((row) => {
        const record = recordSchema.parse(JSON.parse(row.payload));
        return record.kind === "event" ? [eventSchema.parse(record.value)] : [];
      })
      .sort((a, b) => a.sequence - b.sequence || a.id.localeCompare(b.id));
  }
  runsForSession(sessionId?: string): AgentRun[] {
    const rows = sessionId
      ? this.db
          .query<{ payload: string }, [string]>(
            "SELECT payload FROM records WHERE kind='run' AND json_extract(payload,'$.value.sessionId')=?",
          )
          .all(sessionId)
      : this.db
          .query<{ payload: string }, []>(
            "SELECT payload FROM records WHERE kind='run'",
          )
          .all();
    return rows.flatMap((row) => {
      const record = recordSchema.parse(JSON.parse(row.payload));
      return record.kind === "run" ? [record.value] : [];
    });
  }
  getRecord(key: string) {
    const row = this.db
      .query<Row, [string]>(
        "SELECT key,payload,revision FROM records WHERE key=?",
      )
      .get(key);
    return row ? recordSchema.parse(JSON.parse(row.payload)) : null;
  }
  batch(machineId: string, priority: "recent" | "oldest" = "recent") {
    const rows = this.db
      .query<Row, []>(
        priority === "recent"
          ? `SELECT pending.key,pending.payload,pending.revision FROM records pending
             LEFT JOIN records parent ON parent.key='run:' || pending.run_id
             WHERE pending.delivered=0
             ORDER BY COALESCE(json_extract(parent.payload,'$.value.startedAt'),0) DESC,
                      pending.kind DESC,pending.revision LIMIT 50`
          : "SELECT key,payload,revision FROM records WHERE delivered=0 ORDER BY kind DESC,revision LIMIT 50",
      )
      .all();
    if (!rows.length) return null;
    const selected: Row[] = [];
    let bytes = 512;
    for (const row of rows) {
      const size = Buffer.byteLength(row.payload) + 128;
      if (selected.length && bytes + size > 900 * 1024) break;
      selected.push(row);
      bytes += size;
    }
    return {
      keys: selected.map((r) => ({ key: r.key, revision: r.revision })),
      envelope: envelopeSchema.parse({
        schemaVersion: 1,
        machineId,
        records: selected.map((r) => ({
          revision: r.revision,
          record: JSON.parse(r.payload),
        })),
      }),
    };
  }
  acknowledge(keys: { key: string; revision: number }[]) {
    this.db.transaction(() => {
      for (const item of keys)
        this.db
          .query("UPDATE records SET delivered=1 WHERE key=? AND revision=?")
          .run(item.key, item.revision);
    })();
  }
  pending() {
    return (
      this.db
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM records WHERE delivered=0",
        )
        .get()?.count ?? 0
    );
  }
  getMeta(key: string) {
    return (
      this.db
        .query<{ value: string }, [string]>(
          "SELECT value FROM meta WHERE key=?",
        )
        .get(key)?.value ?? null
    );
  }
  setMeta(key: string, value: string) {
    this.db
      .query(
        "INSERT INTO meta VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      )
      .run(key, value);
  }
  close() {
    this.db.close();
  }
  applyProjectPolicy(projects: readonly Project[]) {
    for (const run of this.runsForSession()) {
      const project = resolveProject(projects, run);
      if (project) {
        if (run.projectId !== project.projectId)
          this.put({
            kind: "run",
            value: { ...run, projectId: project.projectId },
          });
        this.db
          .query(
            "UPDATE records SET delivered=0 WHERE run_id=? AND delivered=2",
          )
          .run(run.id);
      } else
        this.db
          .query("UPDATE records SET delivered=2 WHERE run_id=?")
          .run(run.id);
    }
    this.db.exec(
      "UPDATE records SET delivered=2 WHERE kind='event' AND run_id NOT IN (SELECT run_id FROM records WHERE kind='run')",
    );
  }
  exclude(keys: string[]) {
    for (const key of keys)
      this.db.query("UPDATE records SET delivered=2 WHERE key=?").run(key);
  }
  requeueExcluded(runId: string) {
    this.db
      .query("UPDATE records SET delivered=0 WHERE run_id=? AND delivered=2")
      .run(runId);
  }
  resetCaptureCheckpoints() {
    this.db.exec("DELETE FROM meta WHERE key GLOB 'codex:*:updated'");
    this.db.exec("DELETE FROM meta WHERE key GLOB 't3:*:updated'");
  }
  resetT3CaptureCheckpoints(environmentId: string) {
    this.db
      .query("DELETE FROM meta WHERE key GLOB ?")
      .run(`t3:${environmentId}:*:updated`);
  }
}

export async function forward(
  store: LocalStore,
  config: { machineId: string; endpoint: string },
  token: string,
  fetcher: (
    ...args: Parameters<typeof fetch>
  ) => ReturnType<typeof fetch> = fetch,
  options: { priority?: "recent" | "oldest"; signal?: AbortSignal } = {},
) {
  const parsed = projectPolicySchema.safeParse(
    JSON.parse(store.getMeta("projectPolicy") ?? "[]"),
  );
  const projects = parsed.success ? parsed.data : [];
  const batch = store.batch(config.machineId, options.priority);
  if (!batch) return { delivered: 0 };
  const excluded = batch.envelope.records.flatMap((entry, index) => {
    const record = entry.record;
    const parent =
      record.kind === "event"
        ? store.getRecord(`run:${record.value.runId}`)
        : record;
    const run = parent?.kind === "run" ? parent.value : null;
    const project = run ? resolveProject(projects, run) : null;
    return run && project && run.projectId === project.projectId
      ? []
      : [batch.keys[index]?.key ?? ""];
  });
  if (excluded.length) {
    store.exclude(excluded);
    return { delivered: 0 };
  }
  const response = await fetcher(config.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(batch.envelope),
    signal: AbortSignal.any([
      AbortSignal.timeout(10_000),
      ...(options.signal ? [options.signal] : []),
    ]),
    redirect: "error",
  });
  if (!response.ok) throw new Error(`ingestion_http_${response.status}`);
  const result = await response.json();
  const acknowledgment = envelopeSchema.shape.schemaVersion.safeParse(
    typeof result === "object" && result !== null && "schemaVersion" in result
      ? result.schemaVersion
      : null,
  );
  if (
    !acknowledgment.success ||
    !(
      typeof result === "object" &&
      result !== null &&
      "accepted" in result &&
      result.accepted === batch.keys.length
    )
  )
    throw new Error("invalid_ingestion_ack");
  store.acknowledge(batch.keys);
  return { delivered: batch.keys.length };
}
