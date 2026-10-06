import { afterEach, expect, test } from "bun:test";
import {
  mkdtemp,
  mkdir,
  rm,
  writeFile,
  symlink,
  truncate,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeVersion } from "./adapters/claude-version";

const cleanup: string[] = [];
afterEach(async () => {
  await Promise.all(
    cleanup.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});
const sessionId = "00000000-0000-4000-8000-000000000099";
async function fixture() {
  const home = await mkdtemp(join(tmpdir(), "claude-version-"));
  cleanup.push(home);
  const cwd = join(home, "workspace");
  const project = join(home, "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));
  await mkdir(project, { recursive: true });
  const path = join(project, `${sessionId}.jsonl`);
  const options = { home, cwd, sessionId, startedAt: 1000, completedAt: 2000 };
  const record = (timestamp: number, version = "2.1.291", extra: object = {}) =>
    JSON.stringify({
      type: "user",
      cwd,
      sessionId,
      timestamp: new Date(timestamp).toISOString(),
      version,
      message: {
        content: "private synthetic content that must not be returned",
      },
      ...extra,
    });
  return { home, cwd, path, options, record };
}

test("CLI versions belong to the matched native session and turn, including resumed sessions across upgrades", async () => {
  const f = await fixture();
  await writeFile(
    f.path,
    [
      f.record(500, "2.1.290"),
      f.record(1200, "2.1.291", {
        sessionId: "00000000-0000-4000-8000-000000000098",
      }),
      f.record(1300, "2.1.291", { cwd: `${f.cwd}-other` }),
      f.record(1400),
      f.record(1800, "2.1.291", { type: "assistant" }),
      f.record(3000, "2.1.292"),
      "{incomplete",
    ].join("\n"),
  );
  expect(await claudeVersion(f.options)).toEqual({
    kind: "known",
    version: "2.1.291",
  });
  expect(
    await claudeVersion({ ...f.options, startedAt: 2500, completedAt: null }),
  ).toEqual({ kind: "known", version: "2.1.292" });
  expect(await claudeVersion({ ...f.options, startedAt: 4000 })).toEqual({
    kind: "unavailable",
  });
});

test("missing, conflicting, malformed and unrelated metadata remain unknown", async () => {
  const f = await fixture();
  expect(await claudeVersion(f.options)).toEqual({ kind: "unavailable" });
  await writeFile(
    f.path,
    [f.record(1200), f.record(1400, "2.1.292")].join("\n"),
  );
  expect(await claudeVersion(f.options)).toEqual({ kind: "conflicting" });
  await writeFile(
    f.path,
    [
      f.record(1200, "claude-sonnet-5-5"),
      f.record(1400, "2.1.291", { type: "attachment" }),
    ].join("\n"),
  );
  expect(await claudeVersion(f.options)).toEqual({ kind: "unavailable" });
  expect(
    await claudeVersion({ ...f.options, sessionId: "../../outside" }),
  ).toEqual({ kind: "unavailable" });
});

test("native log reads reject symlink escapes and oversized files", async () => {
  const f = await fixture();
  const outside = join(f.home, "outside.jsonl");
  await writeFile(outside, f.record(1500));
  await symlink(outside, f.path);
  expect(await claudeVersion(f.options)).toEqual({ kind: "unavailable" });
  await rm(f.path);
  await writeFile(f.path, f.record(1500));
  await truncate(f.path, 32 * 1024 * 1024 + 1);
  expect(await claudeVersion(f.options)).toEqual({ kind: "unavailable" });
});
