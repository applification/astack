import { deliveryFixture } from "@astack/agent-observability/delivery-fixtures";
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
  fixtureLongRequest,
} from "@astack/agent-observability/evaluation-fixtures";
import { EvaluationView, EvaluationTable } from "./evaluations";
import { ObservatoryLayout } from "./app";
import { workflowViewFixture } from "@astack/agent-observability/workflow-fixtures";
import { journeyFixture } from "@astack/agent-observability/journey-fixtures";
import { generateEvaluation } from "@astack/agent-observability/evaluation-generation";

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
export const LongCapturedRequest: Story = {
  args: {
    detail: (() => {
      const prompt = {
        ...evaluationPrompt(),
        data: { content: fixtureLongRequest },
      };
      return evaluationDetailSchema.parse({
        ...detail("inconclusive"),
        evaluation: generateEvaluation({
          id: "00000000-0000-4000-8000-000000000002",
          createdAt: 2000,
          title: "Review a long scheduled request",
          runs: [{ run: evaluationRun("reproduce"), revision: 1 }],
          source: { event: prompt, revision: 1 },
          clarifications: [],
          criteria: { method: "ui" },
          proof: null,
        }),
        source: { event: prompt, revision: 1 },
      });
    })(),
  },
};
export const GeneratedFromCapture: Story = {
  args: {
    detail: {
      ...detail("inconclusive"),
      evaluation: {
        ...evaluationFixture("inconclusive"),
        proof: null,
        cases: [
          {
            id: "C1",
            expected: "Fix edits disappearing after saving and reopening.",
            requiresIndependentObservation: false,
          },
        ],
        skillCriteria: [],
        generation: {
          method: "ui",
          version: "capture-v1",
          sources: ["reproduce", "repair"].map((turn) => ({
            runId: evaluationRun(turn).id,
            revision: 1,
          })),
          requestRevision: 1,
        },
      },
    },
  },
};
export const BugFixFlow: Story = {
  args: { detail: { ...detail("pass"), workflow: workflowViewFixture() } },
};
export const NewFeatureFlow: Story = {
  args: {
    detail: {
      ...detail("pass"),
      source: null,
      evaluation: {
        ...evaluationFixture(),
        title: "Add saved-edit persistence",
        intent: {
          request: "Add saving so edits survive reopening the document.",
          clarifications: [],
        },
      },
      workflow: workflowViewFixture("feature"),
    },
  },
};
export const ChangedFlow: Story = {
  args: {
    detail: { ...detail("pass"), workflow: workflowViewFixture("changed") },
  },
};
export const MissingFlowSelection: Story = {
  args: {
    detail: {
      ...detail("pass"),
      workflow: {
        records: workflowViewFixture().records.slice(1, 4),
        branches: [],
        truncated: true,
      },
    },
  },
};
export const MissingFlowEvidence: Story = {
  args: {
    detail: {
      ...detail("pass"),
      workflow: {
        ...workflowViewFixture(),
        records: workflowViewFixture().records.map((record) => ({
          ...record,
          evidence: record.evidence.map((item) => ({
            state: "unavailable",
            reference: item.reference,
            reason: "Referenced trace event has not been captured.",
          })),
        })),
      },
    },
  },
};
export const SkillCaptureGaps: Story = {
  args: {
    detail: {
      ...detail("pass"),
      workflow: {
        ...workflowViewFixture("feature"),
        records: workflowViewFixture("feature").records.map((record) => ({
          ...record,
          annotation:
            record.annotation.action === "phase"
              ? {
                  ...record.annotation,
                  skills:
                    record.annotation.phase === "verify"
                      ? []
                      : record.annotation.phase === "implement"
                        ? [
                            "applification:react",
                            "$applification:typescript-best-practices",
                            "owner:repository-specific-acceptance-check",
                          ]
                        : record.annotation.skills,
                }
              : record.annotation,
        })),
      },
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
export const FlowReview: Story = {
  render: () => (
    <Editable
      initial={{ ...detail("pass"), workflow: workflowViewFixture() }}
    />
  ),
};

export const ParallelJourneys: Story = {
  args: {
    detail: { ...detail("inconclusive"), workflow: journeyFixture().workflow },
  },
};
const revisionJourney = journeyFixture().workflow;
export const RevisionSummaries: Story = {
  args: {
    detail: {
      ...detail("inconclusive"),
      workflow: {
        ...revisionJourney,
        records: [
          ...workflowViewFixture("feature").records.map((record) => ({
            ...record,
            sessionId: evaluationRun().sessionId,
            annotation:
              record.annotation.action === "phase" &&
              record.annotation.phase === "implement"
                ? {
                    ...record.annotation,
                    summary:
                      "Implemented route journeys, direct child capture, separate attempts and explicit joins in runtime source 0123456789abcdef0123456789abcdef01234567.",
                  }
                : record.annotation,
          })),
          ...revisionJourney.records.filter(
            (record) => record.annotation.action === "join",
          ),
        ],
      },
    },
  },
};
const promptOriginRequest =
  "Add a route map that shows how a request moves through the agent’s work.\n\nKeep the main journey in the centre. Show delegated work on separate branches, then join the results back into the main line.\n\nKeep the skill evidence easy to open, with enough context to understand each step.";
const promptOrigin = detail("inconclusive");
export const PromptOrigin: Story = {
  args: {
    detail: {
      ...promptOrigin,
      evaluation: {
        ...promptOrigin.evaluation,
        title: "Visualise the journey from a user prompt",
        intent: {
          ...promptOrigin.evaluation.intent,
          request: promptOriginRequest,
          clarifications: [
            "Keep the map expanded and scrollable.",
            "Only rejoin a child when the parent explicitly uses its result.",
          ],
        },
      },
      source: {
        revision: 1,
        event: {
          ...evaluationPrompt(),
          data: { content: promptOriginRequest },
        },
      },
      workflow: {
        ...revisionJourney,
        records: [
          ...workflowViewFixture("feature").records.map((record) => ({
            ...record,
            sessionId: evaluationRun().sessionId,
          })),
          ...revisionJourney.records.filter(
            (record) => record.annotation.action === "join",
          ),
        ],
      },
    },
  },
};
function laneCountDetail(count: number): EvaluationDetail {
  const workflow = journeyFixture(false).workflow;
  const additional: EvaluationDetail["workflow"]["branches"] = Array.from(
    { length: Math.max(0, count - workflow.branches.length) },
    (_, index) => ({
      parentRunId: evaluationRun().id,
      delegation: {
        id: "delegate-additional-" + index,
        source: "t3",
        child: {
          kind: "t3",
          environmentId: "fixture-host",
          threadId: "additional-child-" + index,
        },
        title: index === 0 ? "Documentation checks" : "Security review",
        status: "running",
        startedAt: 1075,
        completedAt: null,
      },
      state: "unavailable",
      reason:
        "This child conversation has no readable capture in this fixture.",
      runs: [],
      records: [],
      reads: [],
      truncated: false,
    }),
  );
  return {
    ...detail("inconclusive"),
    workflow: {
      ...workflow,
      branches: [...workflow.branches, ...additional].slice(0, count),
    },
  };
}
export const SingleJourney: Story = {
  args: { detail: laneCountDetail(1) },
};
export const ThreeJourneys: Story = {
  args: { detail: laneCountDetail(3) },
};
export const FourJourneys: Story = {
  args: { detail: laneCountDetail(4) },
};
export const ReturnedWithoutJoin: Story = {
  args: {
    detail: {
      ...detail("inconclusive"),
      workflow: journeyFixture(false).workflow,
    },
  },
};
export const UnavailableChildJourney: Story = {
  args: {
    detail: {
      ...detail("inconclusive"),
      workflow: {
        ...journeyFixture(false).workflow,
        branches: [
          {
            parentRunId: evaluationRun().id,
            delegation: {
              id: "delegate-missing",
              source: "t3",
              child: null,
              title: "Uncaptured child",
              status: "cancelled",
              startedAt: null,
              completedAt: null,
            },
            state: "unavailable",
            reason: "The host did not expose a child conversation identity.",
            runs: [],
            records: [],
            reads: [],
            truncated: false,
          },
        ],
      },
    },
  },
};

export const DeliveredResult: Story = {
  args: {
    detail: {
      ...detail("pass"),
      workflow: journeyFixture().workflow,
      delivery: {
        runId: evaluationRun().id,
        eventId: evaluationRun().id + ":delivery",
        evidence: deliveryFixture(),
      },
    },
  },
};
export const PrivateDelivery: Story = {
  args: {
    detail: {
      ...detail("pass"),
      workflow: workflowViewFixture(),
      delivery: {
        runId: evaluationRun().id,
        eventId: evaluationRun().id + ":delivery",
        evidence: {
          ...deliveryFixture(),
          snapshot: {
            ...deliveryFixture().snapshot,
            visibility: "private",
            media: [
              {
                kind: "link",
                label: "Private screenshot",
                url:
                  "https://github.com/applification/astack/blob/" +
                  "a".repeat(40) +
                  "/.proof/saved-edit.png",
                reason: "Private image — open with GitHub access",
              },
            ],
            checks: [
              {
                name: "Save and reopen",
                status: "completed",
                conclusion: "failure",
                url: null,
              },
              { name: "Review", status: "queued", conclusion: null, url: null },
            ],
          },
        },
      },
    },
  },
};
