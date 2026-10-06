import { eventSchema, runSchema } from "./domain";
import {
  assessmentInputSchema,
  evaluationSchema,
  type ProofReport,
  type AssessmentInput,
} from "./evaluations";

export const fixtureMachine = "00000000-0000-4000-8000-000000000001";
export const fixtureProject = "00000000-0000-4000-8000-000000000100";
export const fixtureRequest =
  "Fix edits disappearing after saving and reopening.";
export function evaluationRun(turn = "repair") {
  return runSchema.parse({
    id: fixtureMachine + ":codex:saved-edit:" + turn,
    machineId: fixtureMachine,
    machineName: "Evaluation fixture",
    agent: "codex",
    agentVersion: "0.160.0",
    sessionId: "saved-edit",
    attemptId: turn,
    source: "synthetic-evaluation-fixture",
    cwd: "/fixture",
    projectId: fixtureProject,
    title:
      turn === "reproduce"
        ? "Reproduce a lost saved edit"
        : "Repair saved edits",
    startedAt: 1000,
    completedAt: 2000,
    status: "completed",
    lastObservedAt: 2000,
    skills: [],
    tools: [],
    findings: [],
    eventCount: 1,
    contentCapture: true,
    coverage: [],
  });
}
export function evaluationPrompt() {
  const run = evaluationRun("reproduce");
  return eventSchema.parse({
    id: run.id + ":prompt",
    runId: run.id,
    sequence: 0,
    kind: "user_prompt",
    timestamp: null,
    observedAt: 1000,
    timing: "unavailable",
    title: "Original request",
    data: { content: fixtureRequest },
  });
}
export function evaluationFixture(
  status: "pass" | "fail" | "inconclusive" = "pass",
  proof?: ProofReport,
) {
  const prompt = evaluationPrompt();
  return evaluationSchema.parse({
    schemaVersion: 1,
    id: fixtureMachine + ":evaluation:fixture-" + status,
    machineId: fixtureMachine,
    projectId: fixtureProject,
    createdAt: 2000,
    title: "Preserve edits after reopening",
    runIds: [evaluationRun("reproduce").id, evaluationRun().id],
    intent: {
      request: fixtureRequest,
      source: { runId: prompt.runId, eventId: prompt.id },
      clarifications: [
        "Use a disposable document and confirm the persisted value.",
      ],
    },
    criteriaVersion: "saved-edit-v1",
    cases: [
      {
        id: "A1",
        expected: "The saved edit survives reopening and a fresh store read.",
        requiresIndependentObservation: true,
      },
    ],
    skillCriteria: [
      {
        id: "S1",
        skill: "bug-fix",
        expected: "Reproduce the lost edit before changing its cause.",
      },
      {
        id: "S2",
        skill: "verify",
        expected:
          "Rerun save/reopen and independently inspect the persisted value.",
      },
    ],
    proof: proof ?? {
      schemaVersion: 1,
      revision: "a".repeat(40),
      dirty: false,
      sourceDigest: "b".repeat(64),
      target: "Synthetic saved-edit fixture",
      actor: "fixture-owner",
      fixture: "disposable-document",
      command: "astack-editor save-reopen --document fixture",
      cases: [
        {
          caseId: "A1",
          attempts: [
            {
              status,
              observed:
                status === "pass"
                  ? "Reopened document contains the saved edit."
                  : status === "fail"
                    ? "Reopened document contains the old value."
                    : "Fixture startup was unavailable.",
              ...(status === "pass"
                ? {
                    independentObservation:
                      "A fresh store read contains the saved edit.",
                  }
                : {}),
              artifacts: [
                {
                  label: "Save/reopen observations",
                  path: ".proof/save-reopen.json",
                  sha256: "c".repeat(64),
                },
              ],
            },
          ],
        },
      ],
    },
  });
}
export function fixtureAssessment(
  status: "pass" | "fail" | "inconclusive" = "pass",
): AssessmentInput {
  const judgment = {
    verdict: status,
    reason:
      "Reviewed the original request and retained save/reopen observations.",
    evidence: [{ kind: "case", caseId: "A1" }],
  } as const;
  return assessmentInputSchema.parse({
    criteriaVersion: "saved-edit-v1",
    intent: { ...judgment, verdict: "pass" },
    skills: [
      { ...judgment, criterionId: "S1" },
      { ...judgment, criterionId: "S2" },
    ],
    outcome: judgment,
  });
}
