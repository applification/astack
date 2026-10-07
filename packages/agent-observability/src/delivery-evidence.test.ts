import { expect, test } from "bun:test";
import { deliveryFixture } from "./delivery-fixtures";
import {
  deliveryEvidenceSchema,
  githubPullRequestReferenceSchema,
  checkSummary,
} from "./delivery-evidence";
import { eventSchema } from "./domain";
test("delivery identity and inline media are pinned to the public repository", () => {
  const evidence = deliveryFixture();
  for (const url of [
    "http://github.com/applification/astack/pull/26",
    "https://user:secret@github.com/applification/astack/pull/26",
    "https://github.com/applification/astack/pull/26?token=bad",
    "https://example.com/applification/astack/pull/26",
    "https://github.com/applification/astack/pull/0",
  ])
    expect(githubPullRequestReferenceSchema.safeParse(url).success).toBe(false);
  expect(
    deliveryEvidenceSchema.safeParse({
      ...evidence,
      snapshot: { ...evidence.snapshot, repository: "another/project" },
    }).success,
  ).toBe(false);
  expect(
    deliveryEvidenceSchema.safeParse({
      ...evidence,
      snapshot: { ...evidence.snapshot, visibility: "private" },
    }).success,
  ).toBe(false);
  expect(
    deliveryEvidenceSchema.safeParse({
      ...evidence,
      snapshot: {
        ...evidence.snapshot,
        media: [
          {
            ...evidence.snapshot.media[0],
            url: "https://raw.githubusercontent.com/applification/astack/main/.proof/saved-edit.png",
          },
        ],
      },
    }).success,
  ).toBe(false);
  expect(
    eventSchema.safeParse({
      id: "delivery",
      runId: "run",
      sequence: 1,
      kind: "delivery_recorded",
      observedAt: 1,
      timestamp: null,
      timing: "unavailable",
      title: "Delivery",
      data: {},
    }).success,
  ).toBe(false);
});
test("CI summary never treats pending, failed or skipped checks as passes", () => {
  expect(
    checkSummary([
      { name: "Pass", status: "completed", conclusion: "success", url: null },
      { name: "Fail", status: "completed", conclusion: "failure", url: null },
      { name: "Pending", status: "in_progress", conclusion: null, url: null },
      { name: "Skip", status: "completed", conclusion: "skipped", url: null },
      { name: "Unknown", status: "completed", conclusion: null, url: null },
    ]),
  ).toEqual({ passed: 1, failed: 1, pending: 2, skipped: 1 });
});
