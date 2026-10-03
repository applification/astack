// Deliberately narrow adapter for one acceptance test/target in e2e@0.15.1.
// Projects with other runners or report versions own their corresponding adapter.
interface Attempt {
  status: string;
  error?: { code?: string; phase?: string; source?: { file?: string; line?: number } };
  steps?: { api?: string }[];
  secondaryErrors?: unknown[];
  cleanup?: string;
}
interface Result { selected: boolean; status: string; attempts: Attempt[]; skip?: { reason?: string } }
export interface Report {
  schemaVersion: string;
  run: {
    runner: { name: string; version: string };
    status: string;
    exitCode: number;
    errors: unknown[];
    results: Result[];
    explore?: { ended?: string; steps?: { status: string }[]; findings?: unknown[] };
  };
}
export interface ProofResult {
  outcome: "pass" | "fail" | "inconclusive" | "skipped";
  reason: string;
  flaky: boolean;
  candidates: number;
  ready: boolean;
}
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function supported(value: unknown): value is Report {
  if (!object(value) || value.schemaVersion !== "report-1" || !object(value.run)) return false;
  const run = value.run;
  if (!object(run.runner) || run.runner.name !== "e2e" || run.runner.version !== "0.15.1" ||
    typeof run.status !== "string" || typeof run.exitCode !== "number" ||
    !Array.isArray(run.errors) || !Array.isArray(run.results)) return false;
  if (run.explore !== undefined && (!object(run.explore) ||
    !Array.isArray(run.explore.steps) || !Array.isArray(run.explore.findings) ||
    typeof run.explore.ended !== "string" ||
    !run.explore.steps.every((step) => object(step) && typeof step.status === "string"))) return false;
  return run.results.every((result) => object(result) && typeof result.selected === "boolean" &&
    typeof result.status === "string" && Array.isArray(result.attempts) &&
    (result.skip === undefined || (object(result.skip) &&
      (result.skip.reason === undefined || typeof result.skip.reason === "string"))) &&
    result.attempts.every((attempt) => object(attempt) && typeof attempt.status === "string" &&
      (attempt.secondaryErrors === undefined || Array.isArray(attempt.secondaryErrors)) &&
      (attempt.cleanup === undefined || typeof attempt.cleanup === "string") &&
      (attempt.steps === undefined || (Array.isArray(attempt.steps) && attempt.steps.every((step) => object(step) && (step.api === undefined || typeof step.api === "string")))) &&
      (attempt.error === undefined || (object(attempt.error) &&
        (attempt.error.source === undefined || object(attempt.error.source))))));
}

const bodyAssertion = (attempt: Attempt) => attempt.status === "failed" &&
  !attempt.secondaryErrors?.length && (attempt.cleanup === undefined || attempt.cleanup === "complete") &&
  attempt.error?.code === "ASSERTION_FAILED" && attempt.error.phase === "body" &&
  typeof attempt.error.source?.file === "string" && attempt.error.source.file.length > 0 &&
  Number.isInteger(attempt.error.source.line) && attempt.error.source.line! > 0;

export function isIsolatedExactRepro(value: unknown): boolean {
  if (!supported(value) || value.run.explore || value.run.errors.length ||
    value.run.exitCode !== 1 || value.run.status !== "failed") return false;
  const selected = value.run.results.filter((result) => result.selected);
  return selected.length === 1 && selected[0]!.status === "failed" &&
    selected[0]!.attempts.length > 0 && selected[0]!.attempts.every((attempt) =>
      bodyAssertion(attempt) && !attempt.steps?.some((step) => step.api?.startsWith("agent.")));
}

export function interpretReport(value: unknown): ProofResult {
  const result = (outcome: ProofResult["outcome"], reason: string, flaky = false,
    candidates = 0): ProofResult => ({ outcome, reason, flaky, candidates,
      ready: outcome === "pass" && !flaky });
  if (!supported(value)) return result("inconclusive", "Missing or unsupported report; no fresh proof.");
  const { run } = value;
  if (run.errors.length) return result("inconclusive", "Run-level errors prevent a product verdict.");
  if (run.explore) {
    const incomplete = run.explore.steps!.filter((step) => step.status !== "passed").length;
    return result("inconclusive",
      `Exploration ended ${run.explore.ended}; ${incomplete} incomplete steps. Findings need reproduction; no acceptance proof.`,
      false, run.explore.findings!.length);
  }
  const selected = run.results.filter((item) => item.selected);
  if (selected.length !== 1) return result("inconclusive", "Select one acceptance test and target; empty/ambiguous selection is not proof.");
  const test = selected[0]!;
  if (test.status === "skipped") return result("skipped", test.skip?.reason ?? "Selected case was skipped; retain the framework's skip reason.");
  if (!test.attempts.length) return result("inconclusive", "No observed attempt.");
  const last = test.attempts.at(-1)!;
  if (["passed", "flaky"].includes(test.status) && last.status === "passed" && run.status === "passed" &&
    run.exitCode === 0 && !last.error && !last.secondaryErrors?.length &&
    (last.cleanup === undefined || last.cleanup === "complete") &&
    !last.steps?.some((step) => step.api?.startsWith("agent."))) {
    const flaky = test.status === "flaky" || test.attempts.slice(0, -1).some((attempt) => attempt.status !== "passed");
    return result("pass", flaky ? "Latest observation passed after a failure; investigate flaky behavior."
      : "Exact check passed on the identity-checked target.", flaky);
  }
  if (isIsolatedExactRepro(value)) return result("fail", "Isolated exact body assertion failed; review that it encodes the candidate.");
  return result("inconclusive", "Setup, locator, model, budget or inconsistent result cannot confirm an exact product defect.");
}
