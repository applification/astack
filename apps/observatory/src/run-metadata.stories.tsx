import type { Meta, StoryObj } from "@storybook/react-vite";
import { runSchema } from "@astack/agent-observability";
import { ObservatoryLayout } from "./app";
import { RunMetadata, ProviderLabel, ProblemRate } from "./run-metadata";
import { activityHeading } from "@astack/agent-observability/naming";

const run = runSchema.parse({
  id: "fixture:metadata",
  agent: "codex",
  machineId: "fixture-machine",
  machineName: "Fixture computer",
  sessionId: "0f3a8c21-6e4b-4a90-b913-07a135f683bb",
  attemptId: "b91d5e04-711c-4f73-a5b6-5ead16d0c189",
  source: "vscode",
  cwd: "/fixture/.t3/worktrees/astack/t3-12345678",
  repo: "https://github.com/fixture/astack.git",
  branch: "feature/session-handling",
  commit: "a3c98ef120b4123",
  title: "Review authentication session handling and expired-session recovery",
  startedAt: 1,
  lastObservedAt: 2,
  completedAt: 2,
  status: "completed",
  model: "fixture-model",
  eventCount: 12,
  skills: [],
  tools: [],
  findings: [],
  contentCapture: false,
  coverage: [],
});
const meta = {
  title: "Observatory/Run metadata",
  component: RunMetadata,
  args: { run, duration: "10m" },
  decorators: [
    (Story, context) => (
      <ObservatoryLayout>
        <h1 className="run-heading">{activityHeading(context.args.run)}</h1>
        <p className="subtitle">
          <ProviderLabel agent={context.args.run.agent} /> · Fixture computer
        </p>
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof RunMetadata>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Compact: Story = {};
export const NativeFallback: Story = {
  args: { run: { ...run, title: "t3-12345678 · Codex turn 01a111c1" } },
};
export const LocalDirectory: Story = {
  args: {
    run: {
      ...run,
      repo: undefined,
      cwd: "/fixture/a folder with a long project name",
    },
  },
};
export const ProvidersAndRates: Story = {
  render: () => (
    <>
      <div className="toolbar">
        <ProviderLabel agent="codex" />
        <ProviderLabel agent="claude" />
        <ProviderLabel agent="other-provider" />
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Skill</th>
              <th>Runs</th>
              <th>Runs with problems</th>
              <th>Problem rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Example skill</td>
              <td>16</td>
              <td>3</td>
              <td>
                <ProblemRate runs={16} problematic={3} />
              </td>
            </tr>
            <tr>
              <td>Zero problem group</td>
              <td>2</td>
              <td>0</td>
              <td>
                <ProblemRate runs={2} problematic={0} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  ),
};
