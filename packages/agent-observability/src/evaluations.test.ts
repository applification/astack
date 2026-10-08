import { expect, test } from "bun:test";
import {
  evaluateProof,
  evaluationSchema,
  validateAssessment,
  redactEvaluation,
  capturedEvaluationLimits,
} from "./evaluations";
import {
  evaluationFixture,
  evaluationRun,
  evaluationPrompt,
  fixtureAssessment,
} from "./evaluation-fixtures";
import { generateEvaluation } from "./evaluation-generation";
import { evaluationDetailSchema, evaluationRequest } from "./evaluation-view";

test("captured intent resolves only its matching preserved source revision", () => {
  const source = { event: evaluationPrompt(), revision: 7 };
  const evaluation = generateEvaluation({
    id: "fixture-captured-request",
    createdAt: 2000,
    title: "Review captured work",
    runs: [{ run: evaluationRun("reproduce"), revision: 1 }],
    source,
    clarifications: [],
    criteria: { method: "ui" },
    proof: null,
  });
  const detail = evaluationDetailSchema.parse({
    evaluation,
    source,
    runs: [],
    assessments: [],
    moreAssessments: false,
  });
  expect(evaluationRequest(detail)).toBe(
    "Fix edits disappearing after saving and reopening.",
  );
  for (const mismatched of [
    null,
    { ...source, revision: 8 },
    { ...source, event: { ...source.event, id: "different-request" } },
  ])
    expect(() =>
      evaluationDetailSchema.parse({ ...detail, source: mismatched }),
    ).toThrow("preserved original request revision");
  expect(() =>
    evaluationSchema.parse({
      ...evaluation,
      generation: {
        ...evaluation.generation,
        requestRevision: 8,
      },
    }),
  ).toThrow("captured original request revision");
});

test("evaluation redaction preserves bounded follow-ups and redacts secrets in the tail", () => {
  const clarifications = [
    ...Array.from({ length: 100 }, (_, index) => `Follow-up ${index}`),
    "Keep private-test-secret out of persisted evidence.",
  ];
  const evaluation = generateEvaluation({
    id: "fixture-redacted-request",
    createdAt: 2000,
    title: "Review long work",
    runs: [{ run: evaluationRun("reproduce"), revision: 1 }],
    source: { event: evaluationPrompt(), revision: 1 },
    clarifications,
    criteria: { method: "ui" },
    proof: null,
  });
  const safe = redactEvaluation(evaluation, ["private-test-secret"]);
  expect(safe.intent.clarifications).toEqual([
    ...clarifications.slice(0, 100),
    "Keep [REDACTED] out of persisted evidence.",
  ]);
  expect(() =>
    redactEvaluation({
      ...evaluation,
      intent: {
        ...evaluation.intent,
        clarifications: Array(capturedEvaluationLimits.prompts).fill("x"),
      },
    }),
  ).toThrow();
});

test("completed turns never substitute for proof or owner assessment", () => {
  const value = evaluationFixture();
  expect(evaluateProof(value).verdict).toBe("pass");
  expect(evaluateProof({ ...value, proof: null }).verdict).toBe("inconclusive");
  expect(evaluateProof(evaluationFixture("fail")).verdict).toBe("fail");
  expect(evaluateProof(evaluationFixture("inconclusive")).verdict).toBe(
    "inconclusive",
  );
});
test("missing cases, artifact references and independent observations remain inconclusive", () => {
  const value = evaluationFixture();
  const proof = value.proof;
  if (!proof) throw new Error("Fixture missing proof");
  expect(
    evaluateProof({ ...value, proof: { ...proof, cases: [] } }).verdict,
  ).toBe("inconclusive");
  const result = proof.cases[0];
  const attempt = result?.attempts[0];
  if (!result || !attempt) throw new Error("Fixture missing attempt");
  const withoutIndependent = { ...attempt, independentObservation: undefined };
  expect(
    evaluateProof({
      ...value,
      proof: {
        ...proof,
        cases: [{ ...result, attempts: [withoutIndependent] }],
      },
    }).verdict,
  ).toBe("inconclusive");
  expect(
    evaluateProof({
      ...value,
      proof: {
        ...proof,
        cases: [{ ...result, attempts: [{ ...attempt, artifacts: [] }] }],
      },
    }).verdict,
  ).toBe("inconclusive");
  expect(
    evaluateProof({
      ...value,
      proof: {
        ...proof,
        cases: [{ ...result, attempts: [{ ...attempt, status: "skipped" }] }],
      },
    }).verdict,
  ).toBe("inconclusive");
});
test("retry passes preserve the first failure and cannot become clean passes", () => {
  const value = evaluationFixture();
  const proof = value.proof;
  const attempt = proof?.cases[0]?.attempts[0];
  if (!proof || !attempt) throw new Error("Fixture missing proof");
  const retried = {
    ...value,
    proof: {
      ...proof,
      cases: [
        {
          caseId: "A1",
          attempts: [
            {
              ...attempt,
              status: "fail" as const,
              observed: "Original failure",
            },
            attempt,
          ],
        },
      ],
    },
  };
  const result = evaluateProof(retried);
  expect(result.verdict).toBe("inconclusive");
  expect(result.cases[0]?.flaky).toBe(true);
  expect(retried.proof.cases[0]?.attempts[0]?.observed).toBe(
    "Original failure",
  );
});
test("assessment criteria, evidence and passing outcomes are checked against the evaluation", () => {
  const value = evaluationFixture();
  const assessment = fixtureAssessment();
  expect(() => validateAssessment(value, assessment)).not.toThrow();
  expect(() =>
    validateAssessment(value, { ...assessment, criteriaVersion: "other" }),
  ).toThrow("version");
  expect(() =>
    validateAssessment(value, { ...assessment, skills: [] }),
  ).toThrow("every declared");
  expect(() =>
    validateAssessment(evaluationFixture("fail"), assessment),
  ).toThrow("sufficient verification");
  expect(() =>
    validateAssessment(value, {
      ...assessment,
      intent: {
        ...assessment.intent,
        evidence: [{ kind: "case", caseId: "unknown" }],
      },
    }),
  ).toThrow("Unknown");
  expect(() =>
    validateAssessment(value, {
      ...assessment,
      intent: {
        ...assessment.intent,
        evidence: [{ kind: "trace", runId: "unrelated", eventId: "event" }],
      },
    }),
  ).toThrow("outside");
});
test("ambiguous criteria and proof case IDs are rejected", () => {
  const value = evaluationFixture();
  expect(
    evaluationSchema.safeParse({
      ...value,
      cases: [...value.cases, ...value.cases],
    }).success,
  ).toBe(false);
  const proof = value.proof;
  if (!proof) throw new Error("Fixture missing proof");
  expect(
    evaluationSchema.safeParse({
      ...value,
      proof: {
        ...proof,
        cases: [{ caseId: "unrelated", attempts: proof.cases[0]?.attempts }],
      },
    }).success,
  ).toBe(false);
});
