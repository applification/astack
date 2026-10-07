import { z } from "zod";

const id = z.string().trim().min(1).max(512);
const text = z.string().trim().min(1).max(2000);
export const routeSchema = z.enum([
  "bug-fix",
  "implement",
  "performance",
  "investigate",
  "refactor",
  "pr",
  "project-setup",
  "app-control",
  "cloud-transition",
]);
export type AstackRoute = z.infer<typeof routeSchema>;
export const routeDefinitions = {
  "bug-fix": {
    label: "Bug fix",
    phases: ["reproduce", "diagnose", "repair", "verify", "review"],
  },
  implement: {
    label: "New feature",
    phases: ["define", "design", "implement", "verify", "review"],
  },
  performance: {
    label: "Performance",
    phases: ["baseline", "investigate", "improve", "compare", "review"],
  },
  investigate: {
    label: "Investigation",
    phases: ["scope", "investigate", "report"],
  },
  refactor: {
    label: "Refactor",
    phases: ["pin-behaviour", "refactor", "verify", "review"],
  },
  pr: { label: "PR review", phases: ["inspect", "review", "report"] },
  "project-setup": {
    label: "Project setup",
    phases: ["scope", "setup", "verify", "review"],
  },
  "app-control": {
    label: "App control",
    phases: ["inspect", "implement", "verify", "review"],
  },
  "cloud-transition": {
    label: "Cloud transition",
    phases: ["plan", "migrate", "verify", "review"],
  },
} satisfies Record<AstackRoute, { label: string; phases: string[] }>;
const reference = z.object({ runId: id, eventId: id }).strict();
const common = { schemaVersion: z.literal(1), flowId: id };
const selection = {
  ...common,
  route: routeSchema,
  reason: text,
  plannedPhases: z
    .array(id)
    .min(1)
    .max(16)
    .refine(
      (items) => new Set(items).size === items.length,
      "Duplicate planned phase",
    ),
};
export const workflowAnnotationSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...selection,
      action: z.literal("select"),
      request: reference.optional(),
    })
    .strict(),
  z.object({ ...selection, action: z.literal("change") }).strict(),
  z
    .object({
      ...common,
      action: z.literal("phase"),
      phase: id,
      attemptId: id.optional(),
      status: z.enum(["started", "completed", "failed", "omitted"]),
      summary: text,
      skills: z.array(id).max(12),
      evidence: z.array(reference).max(8),
    })
    .strict(),
  z
    .object({
      ...common,
      action: z.literal("join"),
      summary: text,
      inputs: z
        .array(z.object({ branchId: id, result: reference }).strict())
        .min(1)
        .max(8),
    })
    .strict(),
]);
export type WorkflowAnnotation = z.infer<typeof workflowAnnotationSchema>;
