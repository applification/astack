---
name: project-setup
description: Set up a new product or adopt astack in an existing project with real startup, proof and project guidance.
---

# Set up the project

Use this directly for project adoption or initial setup, or when astack delivery needs a runnable foundation. Inspect project instructions, entry points, scripts, tests, CI, data/auth environments, glossary and decision homes before making changes.

For an existing project, preserve its framework, package manager, layout and working tools. Record the actual commands and missing project facts in `.astack/project.md`; create or update only useful guidance. A missing profile does not justify restructuring the project. For a new product without a chosen stack, follow the [profile and setup procedures](references/profile.md) for Bun/Turbo, React/Vite, shared UI, local development and optional Convex/MCP/WorkOS. Next.js serves requirements that justify server rendering. The user's stack choice takes precedence.

Establish the smallest runnable surface and a Git publication target early. Start new apps locally; hosting is an owner choice. Follow existing glossary/context maps and decision registers, using [domain-modeling](../domain-modeling/SKILL.md) only when terms need resolving. Avoid empty files and unused packages.

When repeatable product driving is needed, create or adopt the project control skill and feature map through [app-control](../app-control/SKILL.md). Keep design and acceptance in the [behavior contract](../astack/references/behavior-contract.md). Use [verify](../verify/SKILL.md) to exercise one harmless real path and confirm retained evidence survives cleanup. Report actual setup commands, resulting layout, proof result and exact prerequisites still missing.

Kept setup changes finish through [pr](../pr/SKILL.md). A read-only setup assessment returns its findings without editing. Missing startup or host proof remains a gap; generated files alone do not establish a working project.
