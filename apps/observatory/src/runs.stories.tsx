import type { Meta, StoryObj } from "@storybook/react-vite";
import { runSchema } from "@astack/agent-observability";
import { ObservatoryLayout, RunTable } from "./app";

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
