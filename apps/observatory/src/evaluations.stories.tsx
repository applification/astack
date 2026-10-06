import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  assessmentSchema,
  outcomeFeedbackSchema,
} from "@astack/agent-observability/evaluations";
import {
  evaluationDetailSchema,
  evaluationSummarySchema,
  type EvaluationDetail,
} from "@astack/agent-observability/evaluation-view";
import {
  evaluationFixture,
  evaluationRun,
  evaluationPrompt,
  fixtureAssessment,
} from "@astack/agent-observability/evaluation-fixtures";
import { EvaluationView, EvaluationTable } from "./evaluations";
import { ObservatoryLayout } from "./app";

function detail(status: "pass" | "fail" | "inconclusive", assessed = false) {
  const evaluation = evaluationFixture(status);
  return evaluationDetailSchema.parse({
    evaluation,
    runs: ["repair", "reproduce"].map((turn) => ({
      run: {
        ...evaluationRun(turn),
        startedAt: turn === "repair" ? 1500 : 1000,
      },
      revision: 1,
    })),
    source: { event: evaluationPrompt(), revision: 1 },
    timeline: ["reproduce", "repair"].map((turn) => ({
      runId: evaluationRun(turn).id,
      title: evaluationRun(turn).title,
      request: {
        eventId: evaluationRun(turn).id + ":prompt",
        revision: 1,
        text:
          turn === "reproduce"
            ? "Fix edits disappearing after saving and reopening."
            : "Repair the cause and verify a fresh store read.",
      },
      response: {
        eventId: evaluationRun(turn).id + ":response",
        revision: 1,
        text:
          turn === "reproduce"
            ? "Reproduced the lost edit: reopening returns the old value. The save path writes a stale snapshot."
            : status === "pass"
              ? "Updated the save path. The edit now survives reopening and a fresh store read."
              : status === "fail"
                ? "The edit still disappears when reopening. The repair did not fix the persistence problem."
                : "The fixture could not start, so the saved edit could not be verified.",
      },
    })),
    moreAssessments: false,
    assessments: assessed
      ? [
          {
            ...assessmentSchema.parse({
              ...fixtureAssessment(status),
              id: "fixture-assessment",
              evaluationId: evaluation.id,
              assessedAt: 2000,
              evaluator: "owner",
              evaluatorVersion: "human-v1",
            }),
            traces: [],
          },
        ]
      : [],
  });
}
const meta = {
  title: "Observatory/Evaluations",
  component: EvaluationView,
  args: { detail: detail("pass") },
  decorators: [
    (Story) => (
      <ObservatoryLayout section="evaluations">
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof EvaluationView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const AwaitingReview: Story = {};
export const Passing: Story = { args: { detail: detail("pass", true) } };
export const Failed: Story = { args: { detail: detail("fail", true) } };
export const Inconclusive: Story = {
  args: { detail: detail("inconclusive", true) },
};
export const MissingProof: Story = {
  args: {
    detail: {
      ...detail("inconclusive"),
      evaluation: { ...evaluationFixture("inconclusive"), proof: null },
    },
  },
};
export const MissingContent: Story = {
  args: { detail: { ...detail("pass"), timeline: [] } },
};
export const Empty: Story = { render: () => <EvaluationTable rows={[]} /> };
export const Listing: Story = {
  render: () => (
    <EvaluationTable
      rows={["pass", "fail", "inconclusive"].map((status) =>
        evaluationSummarySchema.parse({
          id: status,
          title: "Saved-edit evaluation / " + status,
          projectId: "fixture",
          createdAt: 2000,
          turns: 2,
          verification: status,
          outcome: status,
        }),
      )}
    />
  ),
};
function Editable({
  initial,
  reject = false,
}: {
  initial: EvaluationDetail;
  reject?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <EvaluationView
      detail={value}
      saveFeedback={async (input, requestId) => {
        if (reject) throw new Error("Fixture write unavailable");
        setValue((previous) => ({
          ...previous,
          feedback: [
            outcomeFeedbackSchema.parse({
              ...input,
              id: requestId,
              evaluationId: previous.evaluation.id,
              reviewedAt: Date.now(),
              reviewer: "owner",
            }),
            ...previous.feedback,
          ],
        }));
      }}
      save={async (input, requestId) => {
        if (reject) throw new Error("Fixture write unavailable");
        setValue((previous) => ({
          ...previous,
          assessments: [
            {
              ...assessmentSchema.parse({
                ...input,
                id: requestId,
                evaluationId: previous.evaluation.id,
                assessedAt: Date.now(),
                evaluator: "owner",
                evaluatorVersion: "human-v1",
              }),
              traces: [],
            },
            ...previous.assessments,
          ],
        }));
      }}
    />
  );
}
export const Review: Story = {
  render: () => <Editable initial={detail("pass")} />,
};
export const ReviewFailure: Story = {
  render: () => <Editable initial={detail("pass")} reject />,
};
