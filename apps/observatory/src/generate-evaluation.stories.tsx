import type { Meta, StoryObj } from "@storybook/react-vite";
import { ConvexError } from "convex/values";
import { GenerateEvaluationButton } from "./generate-evaluation";
import { ObservatoryLayout } from "./app";

const meta = {
  title: "Observatory/Generate evaluation",
  component: GenerateEvaluationButton,
  args: { available: true, generate: async () => {} },
  decorators: [
    (Story) => (
      <ObservatoryLayout section="runs">
        <h1>Captured work</h1>
        <Story />
      </ObservatoryLayout>
    ),
  ],
} satisfies Meta<typeof GenerateEvaluationButton>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const Unavailable: Story = { args: { available: false } };
export const Pending: Story = {
  args: { generate: () => new Promise(() => {}) },
};
export const Failure: Story = {
  args: {
    generate: async () => {
      throw new Error("Fixture capture unavailable");
    },
  },
};
export const StorageBudget: Story = {
  args: {
    generate: async () => {
      throw new ConvexError(
        "Evaluation record exceeds its 128 KiB byte budget.",
      );
    },
  },
};
