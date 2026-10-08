import { z } from "zod";
import { sessionReferenceKey, sessionReferenceSchema } from "./delegation";
import type { AgentRun } from "./domain";

// Host ancestry describes conversation ownership, independently of workflow joins.
export const conversationSchema = z
  .object({
    self: sessionReferenceSchema,
    root: sessionReferenceSchema,
    parent: z
      .object({
        reference: sessionReferenceSchema,
        relationship: z.enum(["subagent", "fork", "unknown"]),
      })
      .strict()
      .optional(),
    hostRun: z
      .object({
        id: z.string().min(1).max(512),
        ordinal: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    const self = value.self;
    for (const reference of [value.root, value.parent?.reference]) {
      if (!reference) continue;
      if (
        reference.kind !== self.kind ||
        (self.kind === "t3" &&
          reference.kind === "t3" &&
          self.environmentId !== reference.environmentId)
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "Conversation ancestry must belong to the same capture environment",
        });
      }
    }
  });
export type Conversation = z.infer<typeof conversationSchema>;

export function mergeConversations(
  first: Conversation | undefined,
  next: Conversation | undefined,
): Conversation | undefined {
  // T3 owns the enclosing app conversation across native provider changes.
  return first?.self.kind === "t3" && next?.self.kind !== "t3"
    ? first
    : (next ?? first);
}

export function runConversation(run: AgentRun): Conversation | null {
  if (run.conversation) return run.conversation;
  // Old T3 aliases do not establish ancestry. The upgraded reader supplies it.
  if (
    run.sessionReferences.some((reference) => reference.kind === "t3") ||
    run.source.startsWith("t3:")
  )
    return null;
  if (run.agent !== "codex" || run.parentSessionId || run.source === "subagent")
    return null;
  const self = { kind: "codex", sessionId: run.sessionId } as const;
  return { self, root: self };
}

export function conversationGroupKey(run: AgentRun): string | null {
  const conversation = runConversation(run);
  return run.projectId && conversation
    ? JSON.stringify([
        run.projectId,
        run.machineId,
        sessionReferenceKey(conversation.root),
      ])
    : null;
}

export const conversationGroupSchema = z
  .object({
    id: z.string().min(1).max(4096),
    projectId: z.string(),
    machineId: z.string(),
    machineName: z.string(),
    root: sessionReferenceSchema,
    title: z.string(),
    rootRunId: z.string().nullable(),
    turns: z.number().int().nonnegative(),
    delegatedTurns: z.number().int().nonnegative(),
    lastActivityAt: z.number(),
  })
  .strict();
export type ConversationGroup = z.infer<typeof conversationGroupSchema>;
