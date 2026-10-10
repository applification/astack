---
name: project-setup
description: Set up a project's chosen stack, evaluate open choices against its product constraints, and verify the smallest useful milestone.
metadata:
  short-description: "Set up the chosen stack and verify a first milestone"
---

# Set up the project

Read the request, project instructions, `.astack/project.md` when present, source, scripts and existing checks. Establish what the product does, who uses it, and the smallest milestone that runs end to end.

Honour fixed choices: language and version, runtime, package manager, framework, database, hosting, testing and linting. For open choices, compare relevant alternatives against the product's constraints and show the trade-offs before committing. Recommend a choice, or make it when the user has delegated that decision. Ask only about unresolved product or preference decisions; settle observable questions by running a focused experiment. astack supplies no application stack defaults.

Follow [setup and verification](references/runtime-loop.md). Use [sequence verifiable units](../principle-sequence-verifiable-units/SKILL.md) to establish the smallest runnable slice before adding dependent work. Reuse existing tools and load platform guidance only for technologies the project selects. A missing optional tool does not initiate a framework or compiler migration.

Use [testing](../testing/SKILL.md) and [verify](../verify/SKILL.md) to exercise the milestone against the real artifact. Add [app control](../app-control/SKILL.md) only when repeated product driving needs a new capability. Record actual decisions and commands in project-owned guidance; no control CLI, feature map or monorepo is a setup prerequisite.

Return the milestone, chosen boundaries, observed results and exact remaining gaps. Generated files and successful compilation alone do not establish working behavior. Kept changes finish through [pr](../pr/SKILL.md); a read-only setup assessment ends with its findings.
