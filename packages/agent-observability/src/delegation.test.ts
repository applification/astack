import { expect, test } from "bun:test";
import { eventSchema } from "./domain";
import { delegationResultSchema } from "./delegation";

const result = {
  delegationId: "task",
  child: null,
  source: "parent_capture",
  host: {
    environmentId: "host",
    threadId: "parent",
    runId: null,
    origin: null,
  },
  observation: { state: "present", resultId: "result-revision" },
  sourceUpdatedAt: null,
  occurredAt: null,
};

test("strict observation variants distinguish presence, host delivery and explicit acknowledgment", () => {
  expect(delegationResultSchema.parse(result).observation).toEqual({
    state: "present",
    resultId: "result-revision",
  });
  expect(
    delegationResultSchema.parse({
      ...result,
      observation: {
        state: "acknowledged",
        resultId: null,
        observedByRunId: null,
      },
    }).observation,
  ).toEqual({ state: "acknowledged", resultId: null, observedByRunId: null });
  expect(
    delegationResultSchema.safeParse({
      ...result,
      observation: { state: "present", resultId: null },
    }).success,
  ).toBe(false);
  expect(
    delegationResultSchema.safeParse({
      ...result,
      observation: {
        state: "delivered",
        resultId: null,
        observedByRunId: "invented",
      },
    }).success,
  ).toBe(false);
  expect(
    delegationResultSchema.safeParse({
      ...result,
      resultContextTransferId: "not-receipt-evidence",
    }).success,
  ).toBe(false);
});

test("a result observation cannot be stored as an ordinary completion event", () => {
  const event = {
    id: "parent:event",
    runId: "parent",
    sequence: 1,
    kind: "delegation_result",
    title: "Host observation",
    timestamp: null,
    timing: "unavailable",
    observedAt: 1000,
    delegationResult: result,
  };
  expect(eventSchema.parse(event).delegationResult?.sourceUpdatedAt).toBeNull();
  expect(
    eventSchema.safeParse({ ...event, kind: "run_complete" }).success,
  ).toBe(false);
  const { delegationResult: _, ...missing } = event;
  expect(eventSchema.safeParse(missing).success).toBe(false);
});
