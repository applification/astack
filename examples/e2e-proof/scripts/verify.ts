import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { interpretReport, isIsolatedExactRepro } from "../src/report-policy";
import { runCheck } from "./run";

function evidenceDigests(directory: string): Record<string, string> {
  return Object.fromEntries(
    readdirSync(directory, { withFileTypes: true }).flatMap(
      (entry): [string, string][] => {
        const file = join(directory, entry.name);
        return entry.isDirectory()
          ? Object.entries(evidenceDigests(file))
          : [
              [
                file,
                createHash("sha256").update(readFileSync(file)).digest("hex"),
              ],
            ];
      },
    ),
  );
}

const args = process.argv.slice(2);
assert(
  args.length <= 1 && args.every((arg) => arg === "--verbose"),
  "Usage: bun run verify [--verbose]",
);
const quiet = !args.includes("--verbose");
const evidence: string[] = [];
async function run(...args: Parameters<typeof runCheck>) {
  const result = await runCheck(args[0], { ...args[1], quiet });
  evidence.push(result.output);
  return result;
}

try {
  console.log("[1/5] Seeded defect: an exact assertion failure is expected.");
  const broken = await run("probe", { variant: "buggy" });
  assert.equal(broken.exitCode, 1);
  assert.equal(isIsolatedExactRepro(broken.report), true);
  assert.equal(interpretReport(broken.report).outcome, "fail");
  console.log("PASS: the seeded defect failed exactly as expected.");
  const before = evidenceDigests(broken.output);
  console.log(
    "[2/5] Evidence preservation: assertion and invalid-target failures are expected.",
  );
  const rerun = await run("probe", {
    variant: "buggy",
    rerunOf: broken.output,
  });
  assert.equal(rerun.exitCode, 1);
  assert.equal(isIsolatedExactRepro(rerun.report), true);
  assert.notEqual(rerun.output, broken.output);
  assert.deepEqual(evidenceDigests(broken.output), before);
  assert.equal(
    JSON.parse(readFileSync(resolve(rerun.output, "identity.json"), "utf8"))
      .rerunOf,
    broken.output,
  );
  const startupFailure = await run("probe", {
    rerunOf: broken.output,
    target: "missing-target",
  });
  assert.notEqual(startupFailure.exitCode, 0);
  assert.equal(startupFailure.report, undefined);
  assert.equal(
    readFileSync(
      resolve(startupFailure.output, "selection-report.json"),
      "utf8",
    ),
    readFileSync(resolve(broken.output, "report.json"), "utf8"),
  );
  assert.deepEqual(evidenceDigests(broken.output), before);
  assert.equal(interpretReport(startupFailure.report).outcome, "inconclusive");

  console.log("PASS: reruns preserved the original failure evidence.");
  console.log("[3/5] Fixed app: the retained regression must pass.");
  const fixed = await run("regression", { variant: "fixed" });
  assert.equal(fixed.exitCode, 0);
  assert.equal(interpretReport(fixed.report).ready, true);
  console.log("PASS: the fixed app passed the same browser assertion.");
  console.log("[4/5] Wrong app instance: identity rejection is expected.");
  const wrong = await run("probe", { wrongInstance: true });
  assert.notEqual(wrong.exitCode, 0);
  assert.equal(isIsolatedExactRepro(wrong.report), false);
  assert.equal(interpretReport(wrong.report).outcome, "inconclusive");
  console.log(
    "PASS: the wrong instance was rejected without confirming a product defect.",
  );
  console.log(
    "[5/5] Recorded exploration: incomplete evidence must remain inconclusive.",
  );
  const exploration = JSON.parse(
    readFileSync("fixtures/green-exploration.json", "utf8"),
  );
  assert.equal(exploration.run.exitCode, 0);
  assert.equal(interpretReport(exploration).outcome, "inconclusive");
  assert.equal(interpretReport(exploration).ready, false);
  for (const check of [broken, rerun, fixed, wrong]) {
    assert.equal(check.report.run.usage.modelTokens, 0);
  }

  console.log("PASS: the recorded exploration remains inconclusive.");

  const summary = {
    acceptance: {
      A1: {
        outcome: "pass",
        observed:
          "Exact repro fails against buggy variant and passes as retained regression against fixed variant",
        before: broken.output,
        after: fixed.output,
      },
      A2: {
        outcome: "pass",
        observed:
          "Original evidence digests unchanged after reruns; startup failure keeps selection seed separate",
        rerun: rerun.output,
        startupFailure: startupFailure.output,
      },
      A3: {
        outcome: "pass",
        observed: "Wrong run identity rejected as inconclusive setup failure",
        report: wrong.output,
      },
      A4: {
        outcome: "pass",
        observed: "Recorded green exploration interpreted as inconclusive",
        source: "fixtures/green-exploration.json",
      },
    },
    finding: {
      id: "selected-state",
      acceptance: "A1",
      status: "regression",
      history: [
        { status: "candidate", source: "Deliberately seeded teaching defect" },
        {
          status: "confirmed",
          evidence: broken.output,
          reason: "selection.ts asserts Play sequence after choosing Idle",
        },
        { status: "fixed", evidence: fixed.output },
        { status: "regression", test: "tests/selected-state.e2e.ts" },
      ],
    },
    exploration: interpretReport(exploration),
    firstFailureDigests: before,
    scope:
      "Real Chromium, no model calls. Exploration fixture is recorded, not a fresh run.",
  };
  writeFileSync(
    ".e2e/verification.json",
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(
    "Verification PASSED (A1–A4). Expected negative checks matched; the fixed-app regression passed.",
  );
  console.log("Proof summary: .e2e/verification.json");
  console.log(
    "Runner logs and raw reports are retained in .e2e/runs/. Use bun run verify --verbose to stream them.",
  );
} catch (error) {
  console.error("Verification FAILED: an expected observation did not match.");
  for (const output of evidence)
    console.error(`Runner logs and report: ${output}`);
  throw error;
}
