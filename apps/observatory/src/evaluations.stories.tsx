import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { assessmentSchema } from "@astack/agent-observability/evaluations";
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
    runs: ["reproduce", "repair"].map((turn) => ({
      run: evaluationRun(turn),
      revision: 1,
    })),
    source: { event: evaluationPrompt(), revision: 1 },
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
