import { z } from "zod";
import { eventSchema, runSchema } from "./domain";
import { workflowCaptureSchema } from "./workflow-view";
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
export const evaluationDetailSchema = z.object({
  evaluation: evaluationSchema,
  runs: z.array(z.object({ run: runSchema, revision: z.number() })).max(20),
  source: eventSnapshotSchema.nullable(),
  assessments: z.array(storedAssessmentSchema).max(20),
  moreAssessments: z.boolean(),
  timeline: z.array(evaluationStepSchema).max(20).default([]),
  feedback: z.array(outcomeFeedbackSchema).max(20).default([]),
  moreFeedback: z.boolean().default(false),
  workflow: workflowCaptureSchema.default({ records: [], branches: [], truncated: false }),
});
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
