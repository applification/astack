---
name: project-setup
description: Set up a new project or integrate and upgrade an existing project toward astack's opinionated runtime control and verification loop.
metadata:
  short-description: "Establish astack's runtime control and verification loop"
---

# Set up the project

Apply [main-thread orchestration](../astack/references/orchestration.md) and install that default in project-owned host instructions for new setup and upgrades. When owning substantive work with agentlog readable capture, use the [automatic evaluation handoff](../astack/references/observatory.md#automatic-task-evaluations) at task start and delivery. Reuse its evaluation task ID across active follow-ups; children return evidence to the owner. Keep telemetry failures from blocking the work.

For integration and upgrades, apply [sequence verifiable units](../principle-sequence-verifiable-units/SKILL.md) and [prove it works](../principle-prove-it-works/SKILL.md) to the resulting runtime loop.

Use this directly for initial setup, project integration or an upgrade to astack's engineering method, or when astack delivery needs a foundation. The outcome is a main agent that owns the task and can start the intended product, identify its instance, exercise real behavior, inspect the result, run meaningful checks and retain evidence through cleanup.

Read project instructions, `.astack/project.md` when present, entry points, scripts, tests, CI, existing drivers and data/auth environments. Follow [runtime loop setup](references/runtime-loop.md) for inspection, integration, upgrades, project guidance and acceptance. For a new project without a chosen stack, use the [new-product defaults](references/profile.md): Bun/Turbo, React/Vite, shared UI, local development and Convex/MCP/WorkOS where behavior needs them. Next.js serves requirements that justify server rendering. The user's explicit choices take precedence.

For an existing project, assess gaps against that loop and integrate useful astack defaults. A setup request includes justified upgrades to development, control and verification tooling; it is not restricted to documenting the status quo. Reuse sound components and carry changes in coherent slices. Explain larger framework, database or authentication migrations with their behavior, data and recovery implications and resolve missing scope choices before performing them. An ordinary feature or bug fix uses the project's established stack; it does not initiate project-wide setup.

Use [app-control](../app-control/SKILL.md) to create or upgrade the project control skill/CLI and feature map, and [testing](../testing/SKILL.md) for exact regressions and trustworthy fixtures. Use [verify](../verify/SKILL.md) to run the loop through one safe real path, independently inspect its material result and confirm evidence survives cleanup. For a library, use its executable consumer/example and checks instead of inventing an app session. Record working commands, selected defaults, upgrade decisions and proof in `.astack/project.md`, with concise orchestration instructions and a profile pointer in the project's actual host instruction files so direct skills and the coordinator share them.

Report the resulting loop, observed acceptance, retained evidence and any exact missing prerequisite. Use GitHub Issues when deferred work needs tracking and no established tracker applies; no tracker questionnaire or triage-label setup is required. Kept changes finish through [pr](../pr/SKILL.md). A read-only setup assessment returns findings without editing. Setup remains partial when its selected runtime path cannot run; generated files alone do not establish a working project.
