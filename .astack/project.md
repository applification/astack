# Companion runtime: Agent Observatory

The root repository continues distributing Astack skills, examples and the public static site. The new companion runtime lives in `apps/observatory`, `packages/agent-observability`, `packages/agentlog`, `packages/backend` and `packages/ui`; do not confuse it with the independent foundation example or an external COS work store.

Bun 1.4.0 workspaces, React 19.3/Vite 8.3, Convex 1.46, Zod 4.6, Tailwind 4.3 and shared shadcn primitives form the runtime. The stable TypeScript 6.0.2 package alias exposes `tsc6`; the root checker deliberately uses that binary. Package pins and generated Convex APIs are committed.

| Command | Claim |
| --- | --- |
| `bun run check` | Existing site and plugin integrity |
| `bun run observatory:check` | Strict affected types and domain/collector/native-function regressions |
| `bun run observatory:lint` | Six shadcn design rules on app, primitives and stories |
| `bun run observatory:build` | Production browser bundle |
| `bun run observatory:build:storybook` then `bun run observatory:test:e2e` | Synthetic component rendering/interactions, desktop and narrow viewports |
| `bun packages/backend/scripts/verify-live.ts` | Native permitted/denied auth and real private persisted trace; opt-in restart proof |
| `bun run observatory:test:live` | Actual deployed UI authenticated navigation; private key-file/tailnet required |

The e2e runner/skill are project owned, deterministic tests need no AI model. `.astack/agent-observatory/e2e-mcp.example.json` supplies a project MCP sample; active Codex installed-host loading is a separate unverified layer. No global host config was changed. Editor save diagnostics were unavailable on this headless worktree; CLI lint covered all UI/story files.

The original visual direction was explored in Pen before production wiring, but the connection references a removed foundation worktree and did not persist this feature's file. Pen screenshot/design comparison remains unavailable. Actual Storybook pixels and private runtime behavior are separate observed proof; keep that distinction in the draft PR.
