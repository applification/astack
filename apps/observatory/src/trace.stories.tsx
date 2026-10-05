import type { Meta, StoryObj } from "@storybook/react-vite";
import { eventSchema } from "@astack/agent-observability";
import { Trace } from "./trace";
import { ObservatoryLayout } from "./app";

const start = Date.parse("2026-10-05T20:14:00Z");
const events = [
  eventSchema.parse({
    id: "fixture:start",
    runId: "fixture",
    sequence: 0,
    kind: "run_start",
    timestamp: start,
    observedAt: start,
    timing: "agent",
    title: "Agent turn started",
  }),
  eventSchema.parse({
    id: "fixture:skill",
    runId: "fixture",
    sequence: 1,
    kind: "skill_loaded",
    timestamp: null,
    observedAt: start,
    timing: "unavailable",
    title: "Skill read: convex-expert",
    skill: {
      name: "convex-expert",
      kind: "skill",
      hash: "0123456789abcdef",
      provenance: "observation_time",
      evidence: "read",
    },
    data: {},
  }),
  eventSchema.parse({
    id: "fixture:test",
    runId: "fixture",
    sequence: 2,
    kind: "test_result",
    timestamp: null,
    observedAt: start,
    timing: "unavailable",
    title: "Test/check result",
    failed: true,
    durationMs: 2140,
    data: { exitCode: 1, output: "[WITHHELD]" },
  }),
  eventSchema.parse({
    id: "fixture:edit",
    runId: "fixture",
    sequence: 3,
    kind: "file_edit",
    timestamp: null,
    observedAt: start,
    timing: "unavailable",
    title: "1 file changes",
    data: { paths: ["schema.ts"] },
  }),
  eventSchema.parse({
    id: "fixture:intervention",
    runId: "fixture",
    sequence: 4,
    kind: "intervention",
    timestamp: start + 4000,
    observedAt: start + 4000,
    timing: "hook",
    title: "User interrupted the agent",
    data: { source: "trusted_async_hook" },
  }),
];
const meta = {
  title: "Observatory/Trace",
  component: Trace,
  args: { events },
  decorators: [
    (Story) => (
      <ObservatoryLayout>
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof Trace>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Mixed: Story = {};
export const Empty: Story = { args: { events: [] } };
export const Failure: Story = {
  args: { events: events.filter((e) => e.failed) },
};
export const MissingTimeAndPrivacy: Story = {
  args: { events: events.filter((e) => e.timestamp === null) },
};
