import { z } from "zod";

const id = z.string().min(1).max(512);
const time = z.number().finite().nonnegative().nullable();

export const sessionReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("codex"), sessionId: id }).strict(),
  z.object({ kind: z.literal("t3"), environmentId: id, threadId: id }).strict(),
]);
export type SessionReference = z.infer<typeof sessionReferenceSchema>;
export const sessionReferenceKey = (reference: SessionReference) =>
  reference.kind === "codex"
    ? `codex:${reference.sessionId}`
    : `t3:${reference.environmentId}:${reference.threadId}`;

export const delegationSchema = z
  .object({
    id,
    source: z.enum(["codex", "t3"]),
    child: sessionReferenceSchema.nullable(),
    title: z.string().max(240),
    status: z.enum([
      "running",
      "completed",
      "failed",
      "cancelled",
      "interrupted",
      "unknown",
    ]),
    startedAt: time,
    completedAt: time,
  })
  .strict();
export type Delegation = z.infer<typeof delegationSchema>;

// These facts are independent. An acknowledged result need never have been
// delivered automatically. Host updatedAt is not the time the fact occurred.
export const delegationObservationSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("present"), resultId: id }).strict(),
  z.object({ state: z.literal("delivered"), resultId: id.nullable() }).strict(),
  z
    .object({
      state: z.literal("acknowledged"),
      resultId: id.nullable(),
      observedByRunId: id.nullable(),
    })
    .strict(),
]);
export const delegationResultSchema = z
  .object({
    delegationId: id,
    child: sessionReferenceSchema.nullable(),
    source: z.literal("parent_capture"),
    host: z
      .object({
        environmentId: id,
        threadId: id,
        runId: id.nullable(),
        origin: z.enum(["provider_native", "app_owned"]).nullable(),
      })
      .strict(),
    observation: delegationObservationSchema,
    sourceUpdatedAt: time,
    occurredAt: time,
  })
  .strict();
export type DelegationResult = z.infer<typeof delegationResultSchema>;

export function mergeSessionReferences(
  before: SessionReference[],
  after: SessionReference[],
) {
  return [
    ...new Map(
      [...before, ...after].map((item) => [sessionReferenceKey(item), item]),
    ).values(),
  ].slice(0, 20);
}

export function mergeDelegations(before: Delegation[], after: Delegation[]) {
  return [
    ...new Map([...before, ...after].map((item) => [item.id, item])).values(),
  ].slice(0, 32);
}
