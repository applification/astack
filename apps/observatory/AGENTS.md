# Observatory

Native Convex authentication, queries and subscriptions own server data. Metadata is private; use synthetic fixtures for retained screenshots. Do not infer engineering success from an agent completing a turn or infer historical skill versions from observation-time hashes.

After UI or story edits run `bun run observatory:lint` from the repository root and fix new findings. Run `bun run observatory:check` for affected types/domain behavior. Build Storybook before `bun run observatory:test:e2e`. The project [e2e skill](../../.agents/skills/e2e/SKILL.md) describes the installed runner. Exact tests use no model or API key. Live Otis proof is separate: `bun run observatory:test:live` needs tailnet access and the owner's private key file; never copy it into source or reports.
