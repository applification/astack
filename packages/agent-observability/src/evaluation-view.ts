import { z } from "zod";
import { eventSchema, runSchema } from "./domain";
import {
  assessmentSchema,
  evaluationSchema,
  verdictSchema,
} from "./evaluations";

export const eventSnapshotSchema = z.object({
  event: eventSchema,
  revision: z.number(),
});
export const storedAssessmentSchema = assessmentSchema.extend({
  traces: z.array(eventSnapshotSchema).max(32),
});
export const evaluationDetailSchema = z.object({
  evaluation: evaluationSchema,
  runs: z.array(z.object({ run: runSchema, revision: z.number() })).max(20),
  source: eventSnapshotSchema.nullable(),
  assessments: z.array(storedAssessmentSchema).max(20),
  moreAssessments: z.boolean(),
});
export const evaluationSummarySchema = z.object({
  id: z.string(),
  title: z.string(),
  projectId: z.string(),
  createdAt: z.number(),
  turns: z.number(),
  verification: verdictSchema,
  outcome: verdictSchema.nullable(),
});
export type EvaluationDetail = z.infer<typeof evaluationDetailSchema>;
export type EvaluationSummary = z.infer<typeof evaluationSummarySchema>;
