import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { interpretReport, isIsolatedExactRepro } from "../src/report-policy";
import { runCheck } from "./run";

function evidenceDigests(directory: string): Record<string, string> {
  return Object.fromEntries(readdirSync(directory, { withFileTypes: true }).flatMap((entry): [string, string][] => {
    const file = join(directory, entry.name);
    return entry.isDirectory() ? Object.entries(evidenceDigests(file))
      : [[file, createHash("sha256").update(readFileSync(file)).digest("hex")]];
  }));
}

const broken = await runCheck("probe", { variant: "buggy" });
assert.equal(broken.exitCode, 1);
assert.equal(isIsolatedExactRepro(broken.report), true);
assert.equal(interpretReport(broken.report).outcome, "fail");
const before = evidenceDigests(broken.output);
const rerun = await runCheck("probe", { variant: "buggy", rerunOf: broken.output });
assert.equal(rerun.exitCode, 1);
assert.equal(isIsolatedExactRepro(rerun.report), true);
assert.notEqual(rerun.output, broken.output);
assert.deepEqual(evidenceDigests(broken.output), before);
assert.equal(JSON.parse(readFileSync(resolve(rerun.output, "identity.json"), "utf8")).rerunOf, broken.output);
const startupFailure = await runCheck("probe", { rerunOf: broken.output, target: "missing-target" });
assert.notEqual(startupFailure.exitCode, 0);
assert.equal(startupFailure.report, undefined);
assert.equal(readFileSync(resolve(startupFailure.output, "selection-report.json"), "utf8"),
  readFileSync(resolve(broken.output, "report.json"), "utf8"));
assert.deepEqual(evidenceDigests(broken.output), before);
assert.equal(interpretReport(startupFailure.report).outcome, "inconclusive");

const fixed = await runCheck("regression", { variant: "fixed" });
assert.equal(fixed.exitCode, 0);
assert.equal(interpretReport(fixed.report).ready, true);
const wrong = await runCheck("probe", { wrongInstance: true });
assert.notEqual(wrong.exitCode, 0);
assert.equal(isIsolatedExactRepro(wrong.report), false);
assert.equal(interpretReport(wrong.report).outcome, "inconclusive");
const exploration = JSON.parse(readFileSync("fixtures/green-exploration.json", "utf8"));
assert.equal(exploration.run.exitCode, 0);
assert.equal(interpretReport(exploration).outcome, "inconclusive");
assert.equal(interpretReport(exploration).ready, false);
for (const check of [broken, rerun, fixed, wrong]) {
  assert.equal(check.report.run.usage.modelTokens, 0);
}

const summary = {
  acceptance: {
    A1: { outcome: "pass", observed: "Exact repro fails against buggy variant and passes as retained regression against fixed variant",
      before: broken.output, after: fixed.output },
    A2: { outcome: "pass", observed: "Original evidence digests unchanged after reruns; startup failure keeps selection seed separate",
      rerun: rerun.output, startupFailure: startupFailure.output },
    A3: { outcome: "pass", observed: "Wrong run identity rejected as inconclusive setup failure", report: wrong.output },
    A4: { outcome: "pass", observed: "Recorded green exploration interpreted as inconclusive", source: "fixtures/green-exploration.json" },
  },
  finding: { id: "selected-state", acceptance: "A1", status: "regression",
    history: [{ status: "candidate", source: "Deliberately seeded teaching defect" },
      { status: "confirmed", evidence: broken.output, reason: "selection.ts asserts Play sequence after choosing Idle" },
      { status: "fixed", evidence: fixed.output },
      { status: "regression", test: "tests/selected-state.e2e.ts" }] },
  exploration: interpretReport(exploration),
  firstFailureDigests: before,
  scope: "Real Chromium, no model calls. Exploration fixture is recorded, not a fresh run.",
};
writeFileSync(".e2e/verification.json", JSON.stringify(summary, null, 2) + "\n");
console.log("A1-A4 passed. Original failure retained; wrong instance and recorded exploration remain inconclusive.");
console.log("Proof summary: .e2e/verification.json");
