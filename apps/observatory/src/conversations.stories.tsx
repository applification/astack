import type { Meta, StoryObj } from "@storybook/react-vite";
import { runSchema } from "@astack/agent-observability";
import { evaluationRun } from "@astack/agent-observability/evaluation-fixtures";
import {
  conversationGroupKey,
  conversationGroupSchema,
} from "@astack/agent-observability/conversations";
import { ConversationGroupsTable, ConversationTree } from "./conversations";
import { ObservatoryLayout } from "./app";

const ref = (threadId: string) =>
  ({ kind: "t3", environmentId: "synthetic-host", threadId }) as const;
const turn = (
  threadId: string,
  attempt: string,
  parent?: string,
  agent = "codex",
) =>
  runSchema.parse({
    ...evaluationRun(),
    id: `synthetic:${threadId}:${attempt}`,
    sessionId: `native-${threadId}-${agent}`,
    agent,
    attemptId: attempt,
    title: `${threadId} · ${attempt}`,
    startedAt: 1_790_000_000_000,
    conversation: {
      self: ref(threadId),
      root: ref("root"),
      ...(parent
        ? { parent: { reference: ref(parent), relationship: "subagent" } }
        : {}),
      hostRun: { id: `app-${attempt}`, ordinal: 1 },
    },
  });
const parent = turn("root", "request-one");
const followUp = turn("root", "request-two", undefined, "claude");
parent.delegations = [
  {
    id: "review-round-1",
    source: "t3",
    child: ref("review"),
    title: "Review round one",
    status: "completed",
    startedAt: parent.startedAt,
    completedAt: parent.startedAt + 1000,
  },
  {
    id: "review-round-2",
    source: "t3",
    child: ref("review"),
    title: "Review round two",
    status: "completed",
    startedAt: parent.startedAt,
    completedAt: parent.startedAt + 1000,
  },
  {
    id: "missing-capture",
    source: "t3",
    child: ref("missing"),
    title: "Unavailable child",
    status: "completed",
    startedAt: parent.startedAt,
    completedAt: parent.startedAt + 1000,
  },
  {
    id: "missing-identity",
    source: "t3",
    child: null,
    title: "Unresolved child identity",
    status: "failed",
    startedAt: parent.startedAt,
    completedAt: parent.startedAt + 1000,
  },
];
const review = turn("review", "first", "root");
const nested = turn("nested", "first", "review", "claude");
const runs = [parent, followUp, review, nested];
const group = conversationGroupSchema.parse({
  id: conversationGroupKey(parent),
  projectId: parent.projectId,
  machineId: parent.machineId,
  machineName: "Synthetic workstation",
  root: ref("root"),
  title: "Two tasks in one orchestration thread",
  rootRunId: parent.id,
  turns: runs.length,
  delegatedTurns: 2,
  lastActivityAt: parent.startedAt,
});
const names = runs.map((run) => ({ runId: run.id, activity: run.title }));
const meta = {
  title: "Observatory/Orchestration",
  component: ConversationTree,
  args: { group, runs, names },
  decorators: [
    (Story) => (
      <ObservatoryLayout section="work">
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof ConversationTree>;
export default meta;
type Story = StoryObj<typeof meta>;
export const NestedAndMissing: Story = {};
export const PartialPage: Story = {
  args: { runs: [nested], exhausted: false },
};
export const MissingIntermediate: Story = {
  args: { runs: [nested], exhausted: true },
};
export const ThreadGroups: Story = {
  render: () => (
    <ConversationGroupsTable
      groups={[
        group,
        {
          ...group,
          id: "separate-machine-group",
          machineId: "separate-machine",
          machineName: "Second synthetic workstation",
        },
      ]}
    />
  ),
};
