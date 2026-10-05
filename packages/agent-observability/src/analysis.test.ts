import { expect, test } from "bun:test";
import { eventSchema } from "./domain";
import { detectProblems } from "./analysis";
test("repeated failures require three matching attempts; ordinary prompts are not interventions", () => {
  const run = {
    status: "completed" as const,
    startedAt: 0,
    startTimeKnown: true,
    completedAt: 100,
    lastObservedAt: 100,
  };
  const failures = Array.from({ length: 3 }, (_, i) =>
    eventSchema.parse({
      id: `e${i}`,
      runId: "r",
      sequence: i,
      kind: "shell_result",
      timestamp: null,
      observedAt: 1,
      timing: "unavailable",
      title: "Shell result",
      failed: true,
      signature: "same-command",
    }),
  );
  expect(detectProblems(run, failures.slice(0, 2), 100)).toHaveLength(0);
  expect(detectProblems(run, failures, 100)[0]?.evidence).toEqual([
    "e0",
    "e1",
    "e2",
  ]);
  expect(
    detectProblems(
      run,
      failures.map((failure, i) =>
        i === 2 ? { ...failure, signature: "different-command" } : failure,
      ),
      100,
    ),
  ).toHaveLength(0);
});
