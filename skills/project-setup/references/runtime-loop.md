# Set up and verify a milestone

## Respect the project's choices

Read existing instructions, source, dependencies, scripts and checks before changing them. For an empty repository, start with the product, its users and the first observable result. Separate fixed decisions from open ones. Do not reopen a fixed choice or install a preferred stack because the project has not used astack before.

Compare open choices against actual requirements: user surfaces, data and identity, deployment constraints, operating cost and maintenance. Show the consequential trade-offs. Use a focused experiment for facts such as compatibility or runtime behavior; reserve questions for product or preference decisions. Choose within delegated authority and record the reason. Existing projects keep their accepted stack unless the requested work changes it.

## Build the smallest working slice

Use the selected language, runtime, package manager, framework and test runner. Create only directories and dependencies needed by the first milestone. Choose module boundaries from its data and consumers; a monorepo or a shared package needs a concrete reason.

Run the real artifact with a safe input or fixture, inspect the result and exercise a meaningful failure when relevant. A CLI should run as a CLI; a service should answer a real request; a user interaction should be driven in the running app. Use [testing](../../testing/SKILL.md) for a useful regression and [verify](../../verify/SKILL.md) to distinguish observed behavior from compilation or mock coverage.

Reuse working launch, diagnostic and verification tools. Add [app control](../../app-control/SKILL.md) when repeated driving lacks a capability, and design/component tools when [web-feature](../../web-feature/SKILL.md) identifies a useful question. Neither is required for every setup. Select local, preview or hosted verification from the project's chosen deployment and available authority.

Run the project's chosen lint and typecheck commands when present. astack's shared lint is optional and must be compatible with the selected compiler and framework. Report incompatibility rather than silently replacing them to satisfy a check. Keep CI aligned with the working commands.

For an upgrade, retain a baseline before changing behavior and rerun it afterwards. Explain consequential data, identity or deployment migrations with their recovery before acting when those choices remain unresolved. Keep an ordinary feature or fix inside its scope.

## Record useful project guidance

Keep chosen tools, consequential decisions and actual commands in existing project guidance. When a separate command reference helps, use a short tracked `.astack/project.md`; link authoritative configuration instead of copying it. Do not create empty decision records or a feature map to complete a checklist.

Ensure the actual agent host can read that guidance. Preserve custom instructions and framework-managed blocks. Codex uses root `AGENTS.md` unless a nonempty `AGENTS.override.md` takes precedence; Claude Code can import it from `CLAUDE.md`. Use the chosen host's instruction entry point, without changing user-global config or installed caches. A pointer inspected on disk does not prove a restarted host loaded it.

Keep secrets and temporary run artifacts out of Git. Put concise observations and remaining gaps in the PR. Repeated setup should refresh stale commands and resume incomplete work without adding duplicate guidance.

## Finish on observed behavior

Rerun the documented milestone from the checkout and inspect its material result. Stop only owned processes and clean up disposable fixtures. Report the revision, commands, observations and any missing prerequisite. Several surfaces need separate checks; one web observation does not establish MCP or native-host behavior.

Use [pr](../../pr/SKILL.md) to finish kept changes. Keep delivery partial or draft when required behavior cannot be observed; do not substitute a ticket or a generated scaffold for proof.
