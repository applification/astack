import { expect, test } from "bun:test";
import {
  conversationGroupKey,
  conversationSchema,
  runConversation,
} from "./conversations";
import { evaluationRun } from "./evaluation-fixtures";

test("conversation grouping preserves project and machine boundaries without manufacturing external work", () => {
  const self = { kind: "t3", environmentId: "host", threadId: "root" } as const;
  const base = {
    ...evaluationRun(),
    conversation: { self, root: self },
    work: { id: "external-issue" },
  };
  const child = {
    ...base,
    conversation: {
      self: { ...self, threadId: "child" },
      root: self,
      parent: { reference: self, relationship: "subagent" as const },
    },
  };
  expect(conversationGroupKey(base)).toBe(conversationGroupKey(child));
  expect(conversationGroupKey({ ...child, machineId: "other" })).not.toBe(
    conversationGroupKey(base),
  );
  expect(conversationGroupKey({ ...child, projectId: "other" })).not.toBe(
    conversationGroupKey(base),
  );
  expect(child.work.id).toBe("external-issue");
  expect(
    runConversation({
      ...base,
      conversation: undefined,
      sessionReferences: [self],
    }),
  ).toBeNull();
});

test("T3 ancestry cannot cross environments", () => {
  const self = { kind: "t3", environmentId: "host", threadId: "root" } as const;
  expect(
    conversationSchema.safeParse({
      self,
      root: { ...self, environmentId: "foreign" },
    }).success,
  ).toBe(false);
});
