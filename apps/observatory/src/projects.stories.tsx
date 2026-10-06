import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { projectSchema } from "@astack/agent-observability/projects";
import { ProjectsView, ProjectSelector } from "./projects";
import { ObservatoryLayout } from "./app";
const machineId = "00000000-0000-4000-8000-000000000001";
const fixtures = [
  projectSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000100",
    name: "Astack",
    enabled: true,
    repositories: ["github.com/fixture/astack"],
    folders: [{ machineId, path: "/fixture/astack" }],
  }),
  projectSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000101",
    name: "Sample product",
    enabled: false,
    repositories: ["github.com/fixture/product"],
    folders: [],
  }),
];
const machines = [{ machineId, name: "Fixture computer" }];
function Fixture({
  state = "mixed",
}: {
  state?: "mixed" | "empty" | "loading" | "error";
}) {
  const [projects, setProjects] = useState(state === "empty" ? [] : fixtures);
  const [selected, setSelected] = useState("");
  return (
    <ObservatoryLayout
      section="projects"
      projectControl={
        <ProjectSelector
          projects={state === "loading" ? undefined : projects}
          selected={selected}
          choose={setSelected}
        />
      }
    >
      <ProjectsView
        projects={state === "loading" ? undefined : projects}
        machines={machines}
        save={async (p) => {
          if (state === "error") throw new Error("Fixture save failure");
          setProjects((previous) => [
            ...previous.filter((x) => x.projectId !== p.projectId),
            p,
          ]);
        }}
      />
    </ObservatoryLayout>
  );
}
const meta = {
  title: "Observatory/Projects",
  component: Fixture,
} satisfies Meta<typeof Fixture>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Mixed: Story = {};
export const Empty: Story = { args: { state: "empty" } };
export const Loading: Story = { args: { state: "loading" } };
export const SaveError: Story = { args: { state: "error" } };
