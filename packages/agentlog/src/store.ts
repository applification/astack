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
import { redactEvaluation } from "@astack/agent-observability/evaluations";
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
      CREATE INDEX IF NOT EXISTS by_prompt_sequence ON records(run_id,json_extract(payload,'$.value.sequence'))
        WHERE kind='event' AND json_extract(payload,'$.value.kind')='user_prompt';
      CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS evaluation_tasks(id TEXT PRIMARY KEY,state TEXT NOT NULL,data TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS evaluation_tasks_by_state ON evaluation_tasks(state);
      INSERT OR IGNORE INTO meta VALUES('revision','0');`);
  }
  put(record: TelemetryRecord) {
    const safe = recordSchema.parse(
      record.kind === "evaluation"
        ? {
            kind: record.kind,
            value: redactEvaluation(record.value, this.secrets),
          }
        : redact(record, this.secrets),
    );
    if (Buffer.byteLength(JSON.stringify(safe)) > 128 * 1024) {
      if (safe.kind === "event" && safe.value.delivery)
        throw new Error("Delivery evidence exceeds the 128 KiB record budget");
      else if (safe.kind === "event")
        safe.value.data = {
          omitted: "Large event detail omitted at the 128 KiB record budget",
        };
      else if (safe.kind === "evaluation") {
        throw new Error("Evaluation exceeds the 128 KiB record budget");
      } else {
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
        if (
          previous.kind === "event" &&
          previous.value.delivery &&
          JSON.stringify(previous.value.delivery.snapshot) !==
            JSON.stringify(safe.value.delivery?.snapshot)
        )
          throw new Error(
            "Delivery snapshot is immutable; capture a new revision",
          );
      }
      const payload = JSON.stringify(safe);
      if (existing?.payload === payload) return false;
      if (existing && safe.kind === "evaluation")
        throw new Error(
          "Evaluation is immutable; use a new ID for revised intent or proof",
        );
      if (safe.kind === "evaluation" && safe.value.intent.source) {
        if ("kind" in safe.value.intent)
          for (const runId of safe.value.runIds) {
            const parent = this.getRecord("run:" + runId);
            if (parent?.kind !== "run" || !parent.value.contentCapture)
              throw new Error(
                "Captured intent requires readable project capture",
              );
          }
        const source = this.getRecord(
          "event:" + safe.value.intent.source.eventId,
        );
        if (
          source?.kind !== "event" ||
          source.value.runId !== safe.value.intent.source.runId ||
          source.value.kind !== "user_prompt" ||
          ("request" in safe.value.intent
            ? source.value.data.content !== safe.value.intent.request
            : typeof source.value.data.content !== "string" ||
              !source.value.data.content.trim() ||
              source.value.data.content === "[WITHHELD]" ||
              this.db
                .query<{ revision: number }, [string]>(
                  "SELECT revision FROM records WHERE key=?",
                )
                .get("event:" + safe.value.intent.source.eventId)?.revision !==
                safe.value.intent.source.revision)
        )
          throw new Error(
            "Original request does not match an already captured prompt",
          );
      }
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
          safe.kind === "run"
            ? safe.value.id
            : safe.kind === "event"
              ? safe.value.runId
              : (safe.value.runIds[0] ?? ""),
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
  saveEvaluationTask(id: string, state: string, value: unknown) {
    this.db
      .query(
        "INSERT INTO evaluation_tasks(id,state,data) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET state=excluded.state,data=excluded.data",
      )
      .run(id, state, JSON.stringify(redact(value, this.secrets)));
  }
  redactMetadata(value: unknown) {
    return redact(value, this.secrets);
  }
  batch(machineId: string, priority: "recent" | "oldest" = "recent") {
    // Assessments reference several turns. Upload their parents and original
    // prompt before the evaluation, even when recent-first ordering separates them.
    const ready = `pending.delivered=0 AND (pending.kind!='evaluation' OR (
      NOT EXISTS (
        SELECT 1 FROM json_each(json_extract(pending.payload,'$.value.runIds')) dependency
        LEFT JOIN records parent_run ON parent_run.key='run:' || dependency.value
        WHERE parent_run.delivered IS NULL OR parent_run.delivered!=1
      ) AND (
        json_extract(pending.payload,'$.value.intent.source.eventId') IS NULL OR
        EXISTS (SELECT 1 FROM records source_event
          WHERE source_event.key='event:' || json_extract(pending.payload,'$.value.intent.source.eventId')
          AND source_event.delivered=1)
      )
    ))`;
    const rows = this.db
      .query<Row, []>(
        priority === "recent"
          ? `SELECT pending.key,pending.payload,pending.revision FROM records pending
             LEFT JOIN records parent ON parent.key='run:' || pending.run_id
             WHERE ${ready}
             ORDER BY COALESCE(json_extract(parent.payload,'$.value.startedAt'),0) DESC,
                      pending.kind DESC,pending.revision LIMIT 50`
          : `SELECT pending.key,pending.payload,pending.revision FROM records pending
             WHERE ${ready} ORDER BY pending.kind DESC,pending.revision LIMIT 50`,
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
    for (const row of this.db
      .query<{ key: string; payload: string }, []>(
        "SELECT key,payload FROM records WHERE kind='evaluation'",
      )
      .all()) {
      const record = recordSchema.parse(JSON.parse(row.payload));
      if (record.kind !== "evaluation") continue;
      const permitted = record.value.runIds.every((id) => {
        const parent = this.getRecord("run:" + id);
        const project =
          parent?.kind === "run"
            ? resolveProject(projects, parent.value)
            : null;
        return project?.projectId === record.value.projectId;
      });
      if (!permitted) this.exclude([row.key]);
    }
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
    if (record.kind === "evaluation") {
      const permitted = record.value.runIds.every((id) => {
        const parent = store.getRecord("run:" + id);
        const project =
          parent?.kind === "run"
            ? resolveProject(projects, parent.value)
            : null;
        return project?.projectId === record.value.projectId;
      });
      return permitted ? [] : [batch.keys[index]?.key ?? ""];
    }
    const parent =
      record.kind === "event"
        ? store.getRecord(`run:${record.value.runId}`)
        : record;
    const run = parent?.kind === "run" ? parent.value : null;
    const project = run ? resolveProject(projects, run) : null;
    return run &&
      project &&
      run.projectId === project.projectId &&
      !(record.kind === "event" && record.value.delivery && !run.contentCapture)
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
