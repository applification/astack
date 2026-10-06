import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type {
  FilterOption,
  RunFilter,
} from "@astack/agent-observability/filters";
import { ObservatoryLayout } from "./app";
import { RunFilters } from "./filters";

const options: readonly FilterOption[] = [
  {
    dimension: "repo",
    value: "github.com/fixture/astack",
    label: "github.com/fixture/astack",
  },
  { dimension: "work", value: "AST-142", label: "Checkout repair · AST-142" },
  { dimension: "agent", value: "codex", label: "codex" },
  { dimension: "version", value: "0.160.0", label: "0.160.0" },
  { dimension: "machine", value: "fixture-otis", label: "Otis · fixture-otis" },
  {
    dimension: "machine",
    value: "fixture-macbook",
    label: "Dave’s MacBook · fixture-macbook",
  },
  {
    dimension: "branch",
    value: "codex/observatory",
    label: "codex/observatory",
  },
  {
    dimension: "branch",
    value: "older-history-branch",
    label: "older-history-branch",
  },
  { dimension: "skill", value: "convex-expert", label: "convex-expert" },
  {
    dimension: "tool",
    value: "mcp__convex__query",
    label: "mcp__convex__query",
  },
];

function Fixture({
  catalog,
  loading = false,
  initialFilters = [],
}: {
  catalog: readonly FilterOption[] | undefined;
  loading?: boolean;
  initialFilters?: readonly RunFilter[];
}) {
  const [filters, setFilters] = useState<readonly RunFilter[]>(initialFilters);
  const [after, setAfter] = useState("");
  const [before, setBefore] = useState("");
  return (
    <ObservatoryLayout>
      <p className="eyebrow">Private agent feedback</p>
      <h1>Agent runs</h1>
      <RunFilters
        options={catalog}
        loading={loading}
        filters={filters}
        after={after}
        before={before}
        change={(dimension, value) =>
          setFilters((previous) => [
            ...previous.filter((filter) => filter.dimension !== dimension),
            ...(value ? [{ dimension, value }] : []),
          ])
        }
        changeAfter={setAfter}
        changeBefore={setBefore}
        clear={() => {
          setFilters([]);
          setAfter("");
          setBefore("");
        }}
      />
    </ObservatoryLayout>
  );
}
const meta = {
  title: "Observatory/Filters",
  component: Fixture,
  args: { catalog: options },
} satisfies Meta<typeof Fixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Choices: Story = {};
export const Loading: Story = { args: { catalog: undefined, loading: true } };
export const Empty: Story = { args: { catalog: [] } };
export const UnavailableSelection: Story = {
  args: { initialFilters: [{ dimension: "branch", value: "removed-branch" }] },
};
