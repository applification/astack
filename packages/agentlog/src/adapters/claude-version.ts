import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { createInterface } from "node:readline";
import { z } from "zod";

const MAX_BYTES = 32 * 1024 * 1024;
const metadataSchema = z.object({
  type: z.enum(["user", "assistant"]),
  sessionId: z.uuid(),
  cwd: z.string(),
  timestamp: z.iso.datetime({ offset: true }).transform(Date.parse),
  version: z
    .string()
    .max(128)
    .regex(/^\d+\.\d+\.\d+(?:[-+][\w.-]+)?$/),
});
type VersionResult =
  | { kind: "known"; version: string }
  | { kind: "unavailable" }
  | { kind: "conflicting" };

/** Read only version metadata from the exact native session and turn interval. */
export async function claudeVersion(options: {
  home: string;
  cwd: string;
  sessionId: string;
  startedAt: number;
  completedAt: number | null;
}): Promise<VersionResult> {
  if (!z.uuid().safeParse(options.sessionId).success)
    return { kind: "unavailable" };
  const cwd = resolve(options.cwd);
  const project = cwd.replace(/[^a-zA-Z0-9]/g, "-");
  try {
    const root = await realpath(join(options.home, "projects"));
    const path = await realpath(
      join(root, project, `${options.sessionId}.jsonl`),
    );
    if (!path.startsWith(`${root}${sep}`)) return { kind: "unavailable" };
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_BYTES) return { kind: "unavailable" };
    const stream = createReadStream(path, {
      end: MAX_BYTES - 1,
      signal: AbortSignal.timeout(1000),
    });
    const lines = createInterface({ input: stream, crlfDelay: Infinity });
    const versions = new Set<string>();
    try {
      for await (const line of lines) {
        let raw: unknown;
        try {
          raw = JSON.parse(line);
        } catch {
          // A live transcript can end with an incomplete record.
          continue;
        }
        const parsed = metadataSchema.safeParse(raw);
        if (!parsed.success) continue;
        const record = parsed.data;
        if (
          record.sessionId === options.sessionId &&
          resolve(record.cwd) === cwd &&
          record.timestamp >= options.startedAt &&
          (options.completedAt === null ||
            record.timestamp <= options.completedAt)
        )
          versions.add(record.version);
      }
    } finally {
      lines.close();
      stream.destroy();
    }
    // A resumed session can cross upgrades; never choose between conflicting records.
    if (versions.size > 1) return { kind: "conflicting" };
    const version = versions.values().next().value;
    return version ? { kind: "known", version } : { kind: "unavailable" };
  } catch {
    // Missing, inaccessible or oversized native history must not stop T3 capture.
    return { kind: "unavailable" };
  }
}
