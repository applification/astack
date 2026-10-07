import type { Meta, StoryObj } from "@storybook/react-vite";
import { runSchema } from "@astack/agent-observability";
import { ObservatoryLayout, RunTable, WorkTable, useRunNames } from "./app";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { useState } from "react";
import { Button } from "@astack/ui";
import { automationFixtureRuns } from "@astack/agent-observability/automation-fixtures";

const runs = ["completed", "failed", "running"].map((status, index) =>
  runSchema.parse({
    id: `fixture:run:${index}`,
    agent: "codex",
    agentVersion: "0.160.0",
    machineId: "fixture-machine",
    machineName: index === 2 ? "Dave’s MacBook" : "Otis",
    sessionId: `session-${index}`,
    attemptId: "turn",
    source: "vscode",
    cwd: "/fixture/astack",
    repo: "astack",
    branch: "codex/observatory",
    title: [
      "Validate ingestion",
      "Repair repeated test failures",
      "Improve skill instructions",
    ][index],
    startedAt: Date.parse("2026-10-05T20:14:00Z"),
    completedAt:
      status === "running" ? null : Date.parse("2026-10-05T20:19:00Z"),
    status,
    lastObservedAt: Date.parse("2026-10-05T20:20:00Z"),
    work: { id: "AST-fixture", label: "Fixture work reference" },
    skills: [
      {
        name: "convex-expert",
        kind: "skill",
        hash: "0123456789abcdef",
        provenance: "observation_time",
        evidence: "read",
      },
    ],
    tools: ["shell"],
    findings:
      status === "failed"
        ? [
            {
              rule: "failing_tests",
              severity: "warning",
              title: "Three matching failures",
              evidence: [],
            },
          ]
        : [],
    eventCount: 12,
    contentCapture: false,
    coverage: [],
  }),
);
const meta = {
  title: "Observatory/Runs",
  component: RunTable,
  args: { runs },
  decorators: [
    (Story) => (
      <ObservatoryLayout>
        <p className="eyebrow">Private agent feedback</p>
        <h1>Agent runs</h1>
        <p className="subtitle">Follow the evidence. Improve the harness.</p>
        <div className="metrics">
          <div>
            <strong>3</strong>
            <span>fixture runs</span>
          </div>
          <div>
            <strong>1</strong>
            <span>needs attention</span>
          </div>
        </div>
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof RunTable>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Mixed: Story = {};
export const Scheduled: Story = { args: { runs: automationFixtureRuns() } };
export const ClaudeCliVersions: Story = {
  args: {
    runs: runs.map((run, index) => ({
      ...run,
      agent: index === 0 ? "codex" : "claude",
      agentVersion:
        index === 0 ? "0.160.1" : index === 1 ? "2.1.291" : undefined,
      model: index === 0 ? "gpt-6.1-sol" : "claude-sonnet-5-5",
    })),
  },
};
export const NamedWorkAndActivities: Story = {
  args: {
    runs: runs.map((run, index) => ({
      ...run,
      title: `astack · Codex turn fixture-${index}`,
      work: { id: index < 2 ? "PR-142" : "PR-143" },
    })),
    names: [
      {
        runId: "fixture:run:0",
        activity: "Add readable Work headings",
        work: "Name Work and agent activity",
      },
      {
        runId: "fixture:run:1",
        activity: "Name activities using the Codex subscription",
        work: "Name Work and agent activity",
      },
    ],
  },
  render: (args) => (
    <>
      <WorkTable {...args} />
      <h2>Captured activity</h2>
      <RunTable {...args} />
    </>
  ),
};
export const ExplicitWorkLabel: Story = {
  args: {
    runs: runs.map((run, index) => ({
      ...run,
      work: {
        id: "PR-142",
        ...(index === 1 ? { label: "Owner’s chosen heading" } : {}),
      },
    })),
    names: [{ runId: "fixture:run:0", work: "Generated heading" }],
  },
  render: (args) => <WorkTable {...args} />,
};

// Exercise the real subscription hook without a backend or private fixture data.
const pendingClient = new ConvexReactClient("http://127.0.0.1:1");
pendingClient.watchQuery = () => ({
  onUpdate: () => () => {},
  localQueryResult: () => undefined,
  localQueryLogs: () => undefined,
  journal: () => undefined,
});
function PendingSubscriptions() {
  const [refreshes, setRefreshes] = useState(0);
  const freshRuns = runs.map((run) => ({ ...run }));
  const names = useRunNames(freshRuns);
  return (
    <>
      <Button onClick={() => setRefreshes((n) => n + 1)}>
        Refresh activity
      </Button>
      <p>Refreshed {refreshes}</p>
      <RunTable runs={freshRuns} names={names} />
    </>
  );
}
export const ReactiveNamingFallback: Story = {
  render: () => (
    <ConvexProvider client={pendingClient}>
      <PendingSubscriptions />
    </ConvexProvider>
  ),
};
