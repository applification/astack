import { expect, test } from "bun:test";
import { projectSchema, repositoryIdentity, resolveProject } from "./projects";
const machineId = "00000000-0000-4000-8000-000000000001";
const project = projectSchema.parse({
  projectId: "00000000-0000-4000-8000-000000000100",
  name: "Astack",
  enabled: true,
  repositories: ["https://github.com/applification/astack.git"],
  folders: [{ machineId, path: "/code/astack" }],
});
test("repository identity unifies transports and ports without retaining credentials", () => {
  for (const url of [
    "git@github.com:Applification/Astack.git",
    "https://token@github.com/applification/astack/",
    "ssh://git@github.com/applification/astack.git",
  ])
    expect(repositoryIdentity(url)).toBe("github.com/applification/astack");
  expect(repositoryIdentity("ssh://git@example.test:7999/team/repo.git")).toBe(
    repositoryIdentity("example.test:7999/team/repo"),
  );
  expect(repositoryIdentity("file:///code/astack")).toBeNull();
});
test("clones/worktrees match by repository; folder boundaries and conflicting evidence fail closed", () => {
  expect(
    resolveProject([project], {
      machineId,
      cwd: "/tmp/worktrees/random",
      repo: "git@github.com:applification/astack.git",
    })?.projectId,
  ).toBe(project.projectId);
  expect(
    resolveProject([project], { machineId, cwd: "/code/astack/subfolder" })
      ?.projectId,
  ).toBe(project.projectId);
  expect(
    resolveProject([project], { machineId, cwd: "/code/astack-other" }),
  ).toBeNull();
  expect(
    resolveProject([project], {
      machineId: "00000000-0000-4000-8000-000000000002",
      cwd: "/code/astack",
    }),
  ).toBeNull();
  const other = {
    ...project,
    projectId: "00000000-0000-4000-8000-000000000101",
    repositories: ["github.com/team/other"],
  };
  expect(
    resolveProject([project, other], {
      machineId,
      cwd: "/code/astack",
      repo: "https://github.com/team/other.git",
    }),
  ).toBeNull();
  expect(
    resolveProject([{ ...project, enabled: false }], {
      machineId,
      cwd: "/code/astack",
    }),
  ).toBeNull();
  expect(
    projectSchema.safeParse({
      ...project,
      folders: [{ machineId, path: "/" }],
      repositories: [],
    }).success,
  ).toBe(false);
});

test("project configuration has a byte budget across its individually valid folders", () => {
  expect(
    projectSchema.safeParse({
      ...project,
      folders: Array.from({ length: 10 }, (_, i) => ({
        machineId,
        path: `/code/${i}/${"x".repeat(2000)}`,
      })),
    }).success,
  ).toBe(false);
});
