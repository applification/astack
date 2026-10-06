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
export const WaitingForUpload: Story = {
  args: { events: [], upload: { capturedCount: 169, pageState: "exhausted" } },
};
export const PartlyUploaded: Story = {
  args: { upload: { capturedCount: 169, pageState: "exhausted" } },
};
export const MoreUploadedEvents: Story = {
  args: { upload: { capturedCount: 169, pageState: "more" } },
};
export const UploadComplete: Story = {
  args: { upload: { capturedCount: events.length, pageState: "exhausted" } },
};
export const CheckingUpload: Story = {
  args: { events: [], upload: { capturedCount: 169, pageState: "loading" } },
};
export const SummaryUpdating: Story = {
  args: { upload: { capturedCount: 3, pageState: "exhausted" } },
};
export const LoadingMoreUploads: Story = {
  args: { upload: { capturedCount: 169, pageState: "loading" } },
};
export const Failure: Story = {
  args: { events: events.filter((e) => e.failed) },
};
export const Readable: Story = {
  args: {
    events: [
      eventSchema.parse({
        ...events[0],
        id: "fixture:prompt",
        sequence: 0,
        kind: "user_prompt",
        title: "User prompt",
        data: {
          content: "Fix the checkout test so it accepts an expired session.",
        },
      }),
      eventSchema.parse({
        ...events[0],
        id: "fixture:assistant",
        sequence: 1,
        kind: "assistant_output",
        title: "Assistant output",
        data: {
          content: "I will inspect the fixture and run the checkout tests.",
        },
      }),
      eventSchema.parse({
        ...events[0],
        id: "fixture:command",
        sequence: 2,
        kind: "test_run",
        title: "Test/check command",
        data: { command: "bun test checkout --token [REDACTED]" },
      }),
      eventSchema.parse({
        ...events[2],
        id: "fixture:readable-result",
        sequence: 3,
        data: {
          exitCode: 1,
          status: "completed",
          output:
            "Checkout assertion failed: expected 200, received 401.\nThe fixture session has expired.",
        },
      }),
      eventSchema.parse({
        ...events[0],
        id: "fixture:arguments",
        sequence: 4,
        kind: "mcp_call",
        title: "MCP fixture/inspect",
        data: {
          arguments: { query: "checkout session", apiKey: "[REDACTED]" },
        },
      }),
    ],
  },
};
export const MissingTimeAndPrivacy: Story = {
  args: { events: events.filter((e) => e.timestamp === null) },
};
