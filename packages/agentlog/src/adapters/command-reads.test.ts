import { expect, test } from "bun:test";
import { commandReadPaths } from "./command-reads";

test("literal shell readers retain quoted paths, wrappers and successful read chains", () => {
  expect(
    commandReadPaths(
      "/bin/zsh -lc 'cat skills/astack/SKILL.md skills/implement/SKILL.md'",
    ),
  ).toEqual(["skills/astack/SKILL.md", "skills/implement/SKILL.md"]);
  expect(
    commandReadPaths(
      "bash -c 'cat \"skills/a space/SKILL.md\" && cat -- skills/react/SKILL.md'",
    ),
  ).toEqual(["skills/a space/SKILL.md", "skills/react/SKILL.md"]);
  expect(commandReadPaths("read_file 'skills/a;literal/SKILL.md'")).toEqual([
    "skills/a;literal/SKILL.md",
  ]);
});

test.each([
  'echo "cat skills/astack/SKILL.md"',
  'cat "$ROOT/skills/astack/SKILL.md"',
  "cat $(pwd)/skills/astack/SKILL.md",
  "cat `pwd`/skills/astack/SKILL.md",
  "cat skills/*/SKILL.md",
  "cat skills/astack/SKILL.md | head",
  "cat missing/SKILL.md; cat skills/astack/SKILL.md",
  "cat missing/SKILL.md || cat skills/astack/SKILL.md",
  "cat skills/astack/SKILL.md > output",
  "cat skills/astack/SKILL.md && echo done",
  "cat --help",
  "cat ~/skills/astack/SKILL.md",
])("ambiguous command does not establish reads: %s", (command) => {
  expect(commandReadPaths(command)).toEqual([]);
});

test("command read extraction bounds input size and path count", () => {
  expect(commandReadPaths("cat " + "x".repeat(20_000))).toEqual([]);
  expect(
    commandReadPaths(
      "cat " +
        Array.from(
          { length: 41 },
          (_, index) => `skills/${index}/SKILL.md`,
        ).join(" "),
    ),
  ).toEqual([]);
});
