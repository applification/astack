import { expect, test } from "bun:test";
import {
  activityNameKey,
  workNameKey,
  generatedTitleSchema,
  parseNamingOutput,
  activityHeading,
} from "./naming";
import { runSchema } from "./domain";
import { repositoryPresentation } from "./presentation";

test("task titles preserve supplied names and use repository context for technical fallbacks", () => {
  const run = runSchema.parse({
    id: "fixture",
    agent: "codex",
    machineId: "fixture",
    machineName: "Fixture",
    sessionId: "session",
    attemptId: "turn",
    source: "vscode",
    cwd: "/fixture/.t3/worktrees/astack/t3-12345678",
    repo: "git@github.com:fixture/astack.git",
    title: "t3-12345678 · Codex turn 01a111c1",
    startedAt: 1,
    lastObservedAt: 2,
    completedAt: null,
    status: "running",
    eventCount: 0,
    skills: [],
    tools: [],
    findings: [],
    contentCapture: false,
    coverage: [],
  });
  expect(activityHeading(run)).toBe("Codex activity in astack");
  expect(
    activityHeading(run, {
      runId: run.id,
      activity: "Review session handling",
    }),
  ).toBe("Review session handling");
  expect(activityHeading({ ...run, title: "Owner’s task heading" })).toBe(
    "Owner’s task heading",
  );
  expect(activityHeading({ ...run, repo: undefined })).toBe(
    "Codex activity in workspace",
  );
  expect(
    repositoryPresentation(
      "https://user:private@github.com/Fixture/Astack.git",
    ),
  ).toEqual({
    kind: "remote",
    label: "astack.git",
    identity: "github.com/fixture/astack",
    href: "https://github.com/fixture/astack",
    github: true,
  });
  expect(repositoryPresentation("javascript:alert(1)").kind).toBe("local");
  expect(repositoryPresentation("/fixture/local folder")).toEqual({
    kind: "local",
    label: "local folder",
  });
});

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
