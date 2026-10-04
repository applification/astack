# Work items reference

This disposable reference shares one Convex domain across a React/Vite web app and authenticated MCP Apps endpoint. Its canonical DTO is `id`, `title`, `status`; status is `open` or `done`. Production identity is WorkOS. Local proof uses temporary signed JWTs with distinct web and MCP audiences and no external account.

From this directory run `bun install --frozen-lockfile`, `bun run typecheck`, `bun run test`, `bun run build` and `bun run verify`. The direct product control route is `./.codex/skills/astack-work-items/control.ts doctor --json` then `./.codex/skills/astack-work-items/control.ts verify --json`. Its tracked feature map is `.astack/feature-map/work-items/README.md`.

`verify` owns its disposable Convex backend, Vite process and browser. It derives separate free ports, confirms backend and web build identity, drives the user path, independently reads persisted effects, and cleans up. `.proof/<run>/report.json` and screenshots remain; tokens, private signing keys, database state and environment files are excluded from retained evidence and Git. Never point this route at production or a shared local deployment.

The local MCP App host is a real SDK bridge to the running endpoint. Live WorkOS identity and installed ChatGPT OAuth/UI are separate, explicit proof gaps until exercised with authorized test accounts. Do not relabel local results as those host results.
