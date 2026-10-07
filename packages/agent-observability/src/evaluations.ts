import { z } from "zod";

const id = z.string().min(1).max(512);
const text = z.string().trim().min(1).max(4096);
const digest = z.string().regex(/^[a-f0-9]{64}$/);
const unique = <T>(items: T[], key: (item: T) => string) =>
  new Set(items.map(key)).size === items.length;
export const traceReferenceSchema = z
  .object({ runId: id, eventId: id })
  .strict();
export const artifactSchema = z
  .object({ label: text, path: text, sha256: digest })
  .strict();
const acceptanceSchema = z
  .object({
    id,
    expected: z.union([
      text,
      z.object({ kind: z.literal("original_request") }).strict(),
    ]),
    requiresIndependentObservation: z.boolean(),
  })
  .strict();
export function acceptanceLabel(criterion: z.infer<typeof acceptanceSchema>) {
  return typeof criterion.expected === "string"
    ? criterion.expected
    : "Fulfil the original request shown above.";
}
export const declaredIntentSchema = z
  .object({
    request: z
      .string()
      .min(1)
      .max(4096)
      .refine((value) => value.trim().length > 0, "Empty request"),
    source: traceReferenceSchema.optional(),
    clarifications: z.array(text).max(10),
  })
  .strict();
const capturedIntentSchema = z
  .object({
    kind: z.literal("captured"),
    source: traceReferenceSchema.extend({
      revision: z.number().int().nonnegative(),
    }),
    // Captured text is bounded by the serialized record/snapshot budgets.
    clarifications: z
      .array(
        z
          .string()
          .min(1)
          .refine((value) => value.trim().length > 0, "Empty clarification"),
      )
      .max(10),
  })
  .strict();
export const verdictSchema = z.enum(["pass", "fail", "inconclusive"]);
const attemptSchema = z
  .object({
    status: z.enum(["pass", "fail", "inconclusive", "skipped"]),
    observed: text,
    independentObservation: text.optional(),
    artifacts: z.array(artifactSchema).max(5),
  })
  .strict();
export const proofReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.string().regex(/^[a-f0-9]{40}$/),
    dirty: z.boolean(),
    sourceDigest: digest,
    target: text,
    actor: text,
    fixture: text,
    command: text,
    cases: z
      .array(
        z
          .object({
            caseId: id,
            attempts: z.array(attemptSchema).min(1).max(5),
          })
          .strict(),
      )
      .max(20)
      .refine(
        (items) => unique(items, (item) => item.caseId),
        "Duplicate proof case",
      ),
  })
  .strict();
const generationBase = {
  version: z.literal("capture-v1"),
  sources: z
    .array(
      z
        .object({ runId: id, revision: z.number().int().nonnegative() })
        .strict(),
    )
    .min(1)
    .max(20),
  requestRevision: z.number().int().nonnegative(),
};
export const evaluationGenerationSchema = z.discriminatedUnion("method", [
  z
    .object({
      ...generationBase,
      method: z.literal("agent"),
      criteriaRecordedAt: z.number().finite().nonnegative(),
    })
    .strict(),
  z.object({ ...generationBase, method: z.literal("ui") }).strict(),
]);
export const evaluationManifestSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().uuid(),
    projectId: id,
    createdAt: z.number().finite().nonnegative(),
    runIds: z
      .array(id)
      .min(1)
      .max(20)
      .refine((ids) => unique(ids, String), "Duplicate run"),
    title: text,
    intent: z.union([declaredIntentSchema, capturedIntentSchema]),
    criteriaVersion: text,
    cases: z
      .array(acceptanceSchema)
      .min(1)
      .max(20)
      .refine(
        (items) => unique(items, (item) => item.id),
        "Duplicate acceptance case",
      ),
    skillCriteria: z
      .array(z.object({ id, skill: id, expected: text }).strict())
      .max(10)
      .refine(
        (items) => unique(items, (item) => item.id),
        "Duplicate skill criterion",
      ),
    proof: proofReportSchema.nullable(),
    generation: evaluationGenerationSchema.optional(),
  })
  .strict();
export const evaluationSchema = evaluationManifestSchema
  .extend({ id, machineId: z.string().uuid() })
  .superRefine((value, ctx) => {
    if (
      "kind" in value.intent &&
      value.generation &&
      value.intent.source.revision !== value.generation.requestRevision
    )
      ctx.addIssue({
        code: "custom",
        path: ["generation", "requestRevision"],
        message:
          "Generation must preserve the captured original request revision.",
      });
    if (
      value.generation &&
      (!value.intent.source ||
        value.generation.sources.length !== value.runIds.length ||
        !unique(value.generation.sources, (source) => source.runId) ||
        value.generation.sources.some(
          (source) => !value.runIds.includes(source.runId),
        ))
    )
      ctx.addIssue({
        code: "custom",
        message:
          "Generation provenance must reference the original request and every selected turn exactly once.",
        path: ["generation"],
      });
    for (const proof of value.proof?.cases ?? [])
      if (!value.cases.some((item) => item.id === proof.caseId))
        ctx.addIssue({
          code: "custom",
          message: "Unknown proof case",
          path: ["proof", "cases"],
        });
    if (
      value.intent.source &&
      !value.runIds.includes(value.intent.source.runId)
    )
      ctx.addIssue({
        code: "custom",
        message: "Request source outside evaluation",
      });
  });
export type Evaluation = z.infer<typeof evaluationSchema>;
export type ProofReport = z.infer<typeof proofReportSchema>;
export const verificationResultSchema = z.object({
  caseId: id,
  verdict: verdictSchema,
  reason: text,
  flaky: z.boolean(),
});
export function evaluateProof(evaluation: Evaluation) {
  const cases = evaluation.cases.map((criterion) => {
    const report = evaluation.proof?.cases.find(
      (item) => item.caseId === criterion.id,
    );
    const latest = report?.attempts.at(-1);
    const flaky =
      !!report?.attempts.some(
        (attempt, index) =>
          index < report.attempts.length - 1 && attempt.status !== "pass",
      ) && latest?.status === "pass";
    let verdict: z.infer<typeof verdictSchema> = "inconclusive";
    let reason = "No verification observation supplied.";
    if (latest?.status === "fail") {
      verdict = "fail";
      reason = latest.observed;
    } else if (latest?.status === "pass") {
      if (flaky)
        reason =
          "A retry passed after an unsuccessful attempt; retain the first failure.";
      else if (
        criterion.requiresIndependentObservation &&
        !latest.independentObservation
      )
        reason =
          "The acceptance case requires a fresh independent observation.";
      else if (!latest.artifacts.length)
        reason = "No retained proof artifact referenced.";
      else {
        verdict = "pass";
        reason = latest.observed;
      }
    } else if (latest) reason = latest.observed;
    return verificationResultSchema.parse({
      caseId: criterion.id,
      verdict,
      reason,
      flaky,
    });
  });
  const verdict = cases.some((item) => item.verdict === "fail")
    ? "fail"
    : cases.every((item) => item.verdict === "pass")
      ? "pass"
      : "inconclusive";
  return { verdict, cases, evaluatorVersion: "proof-v1" };
}
export const evidenceReferenceSchema = z.discriminatedUnion("kind", [
  traceReferenceSchema.extend({ kind: z.literal("trace") }),
  z.object({ kind: z.literal("case"), caseId: id }).strict(),
]);
const judgmentSchema = z
  .object({
    verdict: verdictSchema,
    reason: text,
    evidence: z.array(evidenceReferenceSchema).min(1).max(10),
  })
  .strict();
const flowJudgmentSchema = judgmentSchema.refine(
  (value) => value.evidence.some((item) => item.kind === "trace"),
  "Flow judgments require captured trace evidence",
);
export const assessmentInputSchema = z
  .object({
    criteriaVersion: text,
    intent: judgmentSchema,
    skills: z
      .array(judgmentSchema.extend({ criterionId: id }))
      .max(10)
      .refine(
        (items) => unique(items, (item) => item.criterionId),
        "Duplicate skill judgment",
      ),
    outcome: judgmentSchema,
    flow: z
      .object({ route: flowJudgmentSchema, execution: flowJudgmentSchema })
      .strict()
      .optional(),
  })
  .strict();
export const assessmentSchema = assessmentInputSchema.extend({
  id,
  evaluationId: id,
  assessedAt: z.number(),
  evaluator: z.literal("owner"),
  evaluatorVersion: z.literal("human-v1"),
});
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export const assessmentJudgments = (input: AssessmentInput) => [
  input.intent,
  ...input.skills,
  input.outcome,
  ...(input.flow ? [input.flow.route, input.flow.execution] : []),
];

// Outcome feedback is an owner's experience of the result, not a technical grade.
export const outcomeChoiceSchema = z.enum(["yes", "partly", "no", "unsure"]);
export const outcomeFeedbackInputSchema = z
  .object({
    choice: outcomeChoiceSchema,
    comment: z.string().trim().max(4096),
  })
  .strict();
export const outcomeFeedbackSchema = outcomeFeedbackInputSchema.extend({
  id,
  evaluationId: id,
  reviewedAt: z.number().finite().nonnegative(),
  reviewer: z.literal("owner"),
});
export type OutcomeFeedbackInput = z.infer<typeof outcomeFeedbackInputSchema>;
export type OutcomeFeedback = z.infer<typeof outcomeFeedbackSchema>;
export function validateAssessment(
  evaluation: Evaluation,
  assessment: AssessmentInput,
) {
  if (assessment.criteriaVersion !== evaluation.criteriaVersion)
    throw new Error("Assessment criteria version mismatch");
  if (
    assessment.skills.length !== evaluation.skillCriteria.length ||
    assessment.skills.some(
      (item) =>
        !evaluation.skillCriteria.some((c) => c.id === item.criterionId),
    )
  )
    throw new Error("Assess every declared skill criterion");
  for (const judgment of assessmentJudgments(assessment))
    for (const evidence of judgment.evidence)
      if (evidence.kind === "case") {
        if (!evaluation.cases.some((item) => item.id === evidence.caseId))
          throw new Error("Unknown acceptance evidence");
      } else if (!evaluation.runIds.includes(evidence.runId))
        throw new Error("Trace evidence outside evaluation");
  if (
    assessment.outcome.verdict === "pass" &&
    evaluateProof(evaluation).verdict !== "pass"
  )
    throw new Error("Passing outcome requires sufficient verification");
}
