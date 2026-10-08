import { z } from "zod";
import { eventSchema, runSchema } from "./domain";
import { workflowCaptureSchema } from "./workflow-view";
import { deliveryEvidenceSchema } from "./delivery-evidence";
import {
  assessmentSchema,
  evaluationSchema,
  verdictSchema,
  outcomeFeedbackSchema,
  outcomeChoiceSchema,
} from "./evaluations";

export const eventSnapshotSchema = z.object({
  event: eventSchema,
  revision: z.number(),
});
export const storedAssessmentSchema = assessmentSchema.extend({
  traces: z.array(eventSnapshotSchema).max(32),
});
export const capturedExcerptSchema = z.object({
  eventId: z.string(),
  revision: z.number(),
  text: z.string().min(1).max(1200),
});
export const evaluationStepSchema = z.object({
  runId: z.string(),
  title: z.string(),
  request: capturedExcerptSchema.nullable(),
  response: capturedExcerptSchema.nullable(),
});
export const evaluationDetailSchema = z
  .object({
    evaluation: evaluationSchema,
    runs: z.array(z.object({ run: runSchema, revision: z.number() })).max(20),
    source: eventSnapshotSchema.nullable(),
    assessments: z.array(storedAssessmentSchema).max(20),
    moreAssessments: z.boolean(),
    timeline: z.array(evaluationStepSchema).max(20).default([]),
    feedback: z.array(outcomeFeedbackSchema).max(20).default([]),
    moreFeedback: z.boolean().default(false),
    workflow: workflowCaptureSchema.default({
      records: [],
      reads: [],
      branches: [],
      truncated: false,
    }),
    delivery: z
      .object({
        runId: z.string(),
        eventId: z.string(),
        evidence: deliveryEvidenceSchema,
      })
      .nullable()
      .default(null),
  })
  .superRefine((detail, ctx) => {
    if (!("kind" in detail.evaluation.intent)) return;
    const reference = detail.evaluation.intent.source;
    const source = detail.source;
    if (
      !source ||
      source.event.kind !== "user_prompt" ||
      source.event.id !== reference.eventId ||
      source.event.runId !== reference.runId ||
      source.revision !== reference.revision ||
      typeof source.event.data.content !== "string" ||
      !source.event.data.content.trim() ||
      source.event.data.content === "[WITHHELD]"
    )
      ctx.addIssue({
        code: "custom",
        path: ["source"],
        message:
          "Captured intent requires its preserved original request revision.",
      });
  });
export function evaluationRequest(
  detail: Pick<EvaluationDetail, "evaluation" | "source">,
) {
  const intent = detail.evaluation.intent;
  if ("request" in intent) return intent.request;
  const content = detail.source?.event.data.content;
  return typeof content === "string"
    ? content
    : "Original request unavailable.";
}
export const evaluationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  projectId: z.string(),
  createdAt: z.number(),
  turns: z.number(),
  verification: verdictSchema,
  outcome: verdictSchema.nullable(),
  feedback: outcomeChoiceSchema.nullable().default(null),
});
export type EvaluationDetail = z.infer<typeof evaluationDetailSchema>;
export type EvaluationSummary = z.infer<typeof evaluationSummarySchema>;
