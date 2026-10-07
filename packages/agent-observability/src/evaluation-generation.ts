import { z } from "zod";
import type { AgentEvent, AgentRun } from "./domain";
import {
  evaluationManifestSchema,
  evaluationSchema,
  type ProofReport,
} from "./evaluations";

export const generationCriteriaSchema = z.discriminatedUnion("method", [
  z
    .object({
      method: z.literal("agent"),
      recordedAt: z.number().finite().nonnegative(),
      cases: evaluationManifestSchema.shape.cases,
      skillCriteria: evaluationManifestSchema.shape.skillCriteria,
    })
    .strict(),
  z.object({ method: z.literal("ui") }).strict(),
]);

export function generateEvaluation({
  id,
  createdAt,
  title,
  runs,
  source,
  clarifications,
  criteria,
  proof,
}: {
  id: string;
  createdAt: number;
  title: string;
  runs: readonly { run: AgentRun; revision: number }[];
  source: { event: AgentEvent; revision: number };
  clarifications: readonly string[];
  criteria: z.infer<typeof generationCriteriaSchema>;
  proof: ProofReport | null;
}) {
  const first = runs[0]?.run;
  if (!first?.projectId || !runs.length || runs.length > 20)
    throw new Error("Select between 1 and 20 captured task turns.");
  if (
    runs.some(
      ({ run }) =>
        run.machineId !== first.machineId ||
        run.projectId !== first.projectId ||
        !run.contentCapture,
    )
  )
    throw new Error(
      "Evaluation requires readable turns from one project and computer.",
    );
  const request = source.event.data.content;
  if (
    source.event.kind !== "user_prompt" ||
    !runs.some(({ run }) => run.id === source.event.runId) ||
    typeof request !== "string" ||
    !request.trim() ||
    request === "[WITHHELD]"
  )
    throw new Error("A readable captured original request is required.");
  const provenance = {
    version: "capture-v1" as const,
    sources: runs.map(({ run, revision }) => ({ runId: run.id, revision })),
    requestRevision: source.revision,
  };
  return evaluationSchema.parse({
    schemaVersion: 1,
    id: first.machineId + ":evaluation:" + id,
    machineId: first.machineId,
    projectId: first.projectId,
    createdAt,
    title,
    runIds: runs.map(({ run }) => run.id),
    intent: {
      kind: "captured",
      source: {
        runId: source.event.runId,
        eventId: source.event.id,
        revision: source.revision,
      },
      clarifications,
    },
    criteriaVersion: "capture-v1",
    cases:
      criteria.method === "agent"
        ? criteria.cases
        : [
            {
              id: "C1",
              expected: { kind: "original_request" },
              requiresIndependentObservation: false,
            },
          ],
    skillCriteria: criteria.method === "agent" ? criteria.skillCriteria : [],
    proof,
    generation:
      criteria.method === "agent"
        ? {
            ...provenance,
            method: "agent",
            criteriaRecordedAt: criteria.recordedAt,
          }
        : { ...provenance, method: "ui" },
  });
}
