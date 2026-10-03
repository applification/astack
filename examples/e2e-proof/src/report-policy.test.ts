import { describe, expect, test } from "bun:test";
import recorded from "../fixtures/green-exploration.json";
import { interpretReport, isIsolatedExactRepro, type Report } from "./report-policy";

// Minimal synthetic deterministic reports; verify.ts also uses real browser reports.
const passed = (): Report => ({ schemaVersion: "report-1", run: {
  runner: { name: "e2e", version: "0.15.1" }, status: "passed", exitCode: 0, errors: [],
  results: [{ selected: true, status: "passed", attempts: [{ status: "passed" }] }],
} });
const failed = (): Report => {
  const report = passed();
  report.run.status = "failed"; report.run.exitCode = 1;
  report.run.results[0] = { selected: true, status: "failed", attempts: [{ status: "failed",
    error: { code: "ASSERTION_FAILED", phase: "body", source: { file: "selection.ts", line: 8 } },
    steps: [{ api: "screen.tap" }, { api: "expect.toBeVisible" }],
  }] };
  return report;
};

describe("exploration is never acceptance proof", () => {
  test("recorded zero-exit run with failed step stays inconclusive", () => {
    expect(recorded.run.status).toBe("passed");
    expect(recorded.run.exitCode).toBe(0);
    expect(interpretReport(recorded)).toMatchObject({ outcome: "inconclusive", ready: false, candidates: 0 });
    expect(isIsolatedExactRepro(recorded)).toBe(false);
  });
  test("synthetic timeout remains inconclusive despite green run", () => {
    const report = structuredClone(recorded);
    report.run.explore.ended = "time-limit";
    report.run.explore.steps[0]!.errorCode = "STEP_TIMEOUT";
    expect(interpretReport(report).reason).toContain("time-limit");
    expect(interpretReport(report).ready).toBe(false);
  });
  test("completed clean exploration still does not establish acceptance", () => {
    const report = structuredClone(recorded);
    report.run.explore.ended = "goal-covered";
    report.run.explore.steps[0]!.status = "passed";
    expect(interpretReport(report).outcome).toBe("inconclusive");
  });
  test("issue findings are candidates, not confirmed defects", () => {
    const report = { ...recorded, run: { ...recorded.run, status: "failed", exitCode: 1,
      explore: { ...recorded.run.explore, findings: [{ kind: "issue", title: "Suspected bug" }] } } };
    expect(interpretReport(report)).toMatchObject({ outcome: "inconclusive", candidates: 1, ready: false });
    expect(isIsolatedExactRepro(report)).toBe(false);
  });
});

describe("confirmation requires an isolated exact body assertion", () => {
  test("exact failure can support confirmation after claim review", () => {
    expect(isIsolatedExactRepro(failed())).toBe(true);
    expect(interpretReport(failed()).outcome).toBe("fail");
  });
  for (const code of ["LOCATOR_NOT_FOUND", "STEP_TIMEOUT", "STEP_BUDGET_EXHAUSTED", "TEST_SETUP_FAILED"]) {
    test(`${code} cannot confirm a product defect`, () => {
      const report = failed(); report.run.results[0]!.attempts[0]!.error!.code = code;
      expect(isIsolatedExactRepro(report)).toBe(false);
      expect(interpretReport(report).outcome).toBe("inconclusive");
    });
  }
  test("identity assertion in setup is inconclusive", () => {
    const report = failed(); report.run.results[0]!.attempts[0]!.error!.phase = "beforeEach";
    expect(isIsolatedExactRepro(report)).toBe(false);
    expect(interpretReport(report).outcome).toBe("inconclusive");
  });
  test("model-judged assertion is not an exact repro", () => {
    const report = failed(); report.run.results[0]!.attempts[0]!.steps = [{ api: "agent.assert" }];
    expect(isIsolatedExactRepro(report)).toBe(false);
    expect(interpretReport(report).outcome).toBe("inconclusive");
  });
  test("run-level failures and multiple selected tests prevent confirmation", () => {
    const report = failed(); report.run.errors = [{ code: "ENVIRONMENT_UNAVAILABLE" }];
    expect(isIsolatedExactRepro(report)).toBe(false);
    expect(interpretReport(report).outcome).toBe("inconclusive");
    report.run.errors = []; report.run.results.push(structuredClone(report.run.results[0]!));
    expect(isIsolatedExactRepro(report)).toBe(false);
  });
  test("failure without source line cannot confirm", () => {
    const report = failed(); delete report.run.results[0]!.attempts[0]!.error!.source;
    expect(isIsolatedExactRepro(report)).toBe(false);
  });
  test("secondary setup/teardown errors and failed cleanup prevent confirmation", () => {
    const report = failed();
    report.run.results[0]!.attempts[0]!.secondaryErrors = [{ code: "TEST_SETUP_FAILED" }];
    expect(isIsolatedExactRepro(report)).toBe(false);
    report.run.results[0]!.attempts[0]!.secondaryErrors = [];
    report.run.results[0]!.attempts[0]!.cleanup = "failed";
    expect(interpretReport(report).outcome).toBe("inconclusive");
  });
});

describe("readiness preserves gaps and retry failures", () => {
  test("fresh exact pass is ready", () => {
    expect(interpretReport(passed())).toMatchObject({ outcome: "pass", ready: true, flaky: false });
  });
  test("retry pass remains flaky and cannot silently establish readiness", () => {
    const report = passed(); report.run.results[0]!.attempts.unshift(failed().run.results[0]!.attempts[0]!);
    report.run.results[0]!.status = "flaky";
    expect(interpretReport(report)).toMatchObject({ outcome: "pass", ready: false, flaky: true });
  });
  test("explicit skip and empty selection do not pass", () => {
    const report = passed(); report.run.results[0]!.status = "skipped"; report.run.results[0]!.attempts = [];
    report.run.results[0]!.skip = { reason: "Test account unavailable" };
    expect(interpretReport(report).outcome).toBe("skipped");
    expect(interpretReport(report).reason).toBe("Test account unavailable");
    report.run.results[0]!.selected = false;
    expect(interpretReport(report).outcome).toBe("inconclusive");
  });
  test("missing, malformed and upgraded reports fail closed", () => {
    for (const report of [undefined, {}, { schemaVersion: "report-1", run: {} },
      { ...passed(), schemaVersion: "report-2" }]) {
      expect(interpretReport(report).outcome).toBe("inconclusive");
      expect(isIsolatedExactRepro(report)).toBe(false);
    }
    const upgraded = passed(); upgraded.run.runner.version = "0.16.0";
    expect(interpretReport(upgraded).ready).toBe(false);
  });
  test("contradictory run and attempt statuses cannot pass", () => {
    const report = passed(); report.run.exitCode = 3;
    expect(interpretReport(report).outcome).toBe("inconclusive");
  });
  test("malformed step API is refused rather than throwing", () => {
    const report = passed();
    const malformed = { ...report, run: { ...report.run, results: [{ ...report.run.results[0],
      attempts: [{ status: "passed", steps: [{ api: 123 }] }] }] } };
    expect(interpretReport(malformed).ready).toBe(false);
  });
});
