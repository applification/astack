import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  automationFixtureRuns,
  automationFixtureProject,
} from "@astack/agent-observability/automation-fixtures";
import { ObservatoryLayout } from "./app";
import { ScheduledTasksTable } from "./scheduled-tasks";

const meta = {
  title: "Observatory/Scheduled tasks",
  component: ScheduledTasksTable,
  args: {
    runs: automationFixtureRuns(),
    projects: [
      {
        projectId: automationFixtureProject,
        name: "Fixture project",
        enabled: true,
        repositories: [],
        folders: [],
      },
    ],
  },
  decorators: [
    (Story) => (
      <ObservatoryLayout
        section="scheduled"
        projectId={automationFixtureProject}
      >
        <p className="eyebrow">Private agent feedback</p>
        <h1>Scheduled tasks</h1>
        <p className="subtitle">
          Browse recurring tasks and their captured activity.
        </p>
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof ScheduledTasksTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Captured: Story = {};
export const Empty: Story = { args: { runs: [] } };
export const SeparateProjects: Story = {
  args: {
    runs: automationFixtureRuns()
      .slice(0, 1)
      .flatMap((run) => [
        run,
        {
          ...run,
          id: "fixture:second-project",
          projectId: "another-project",
        },
      ]),
  },
};
