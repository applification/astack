import { expect, test } from "bun:test";
import {
  activityNameKey,
  workNameKey,
  generatedTitleSchema,
  parseNamingOutput,
} from "./naming";

test("names retain distinct target/project keys and reject incomplete, duplicate or excessive model output", () => {
  expect(workNameKey("project-a", "PR-1")).not.toBe(
    workNameKey("project-b", "PR-1"),
  );
  expect(activityNameKey("project-a", "PR-1")).not.toBe(
    workNameKey("project-a", "PR-1"),
  );
  const inputs = [
    { key: "a", kind: "work" as const, requests: ["Add heading"] },
    { key: "b", kind: "activity" as const, requests: ["Test heading"] },
  ];
  expect(() =>
    parseNamingOutput({ names: [{ key: "a", title: "Add heading" }] }, inputs),
  ).toThrow();
  expect(() =>
    parseNamingOutput(
      {
        names: [
          { key: "a", title: "Add heading" },
          { key: "a", title: "Test heading" },
        ],
      },
      inputs,
    ),
  ).toThrow();
  expect(generatedTitleSchema.safeParse("Heading\nNew line").success).toBe(
    false,
  );
  expect(generatedTitleSchema.safeParse(" ").success).toBe(false);
  expect(generatedTitleSchema.safeParse("x".repeat(101)).success).toBe(false);
});
