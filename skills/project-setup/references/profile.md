# New product defaults

Use this for a new product without a chosen stack, or as the target when assessing an existing project's upgrades through [runtime loop setup](runtime-loop.md). The runtime loop is the setup outcome; select the defaults that serve its actual product surfaces. For a product with persistent web and MCP behavior, the [worked foundation](https://github.com/applification/astack/tree/main/examples/foundation) is an optional starting point. Its commands and proof history remain project records; [Convex](../../convex/SKILL.md), [WorkOS auth](../../workos-auth/SKILL.md) and [MCP](../../mcp-server/SKILL.md) own the reusable engineering guidance.

New apps start locally, including their Convex deployment. Preserve persistent state across development restarts and keep disposable proof isolated. Do not provision cloud as a prerequisite for evaluating an app. When the user chooses to host it or move to cloud, follow the [cloud transition workflow](../../cloud-transition/SKILL.md); selecting the target, choosing data transfer, updating auth/MCP and frontend settings, deploying, verifying hosted behavior and retaining recovery all belong to astack delivery. Existing apps preserve their accepted deployment unless a transition is requested.

Install the [main-thread orchestration default](../../astack/references/orchestration.md) and profile pointer through the actual host's root instructions as part of every new setup or adoption upgrade. Follow [project-owned guidance](runtime-loop.md#record-project-owned-guidance) for idempotent edits, preserving custom text and framework-managed blocks. Foundation scaffolds carry root `AGENTS.md`, a Claude pointer and `.astack/project.md`; other scaffolds must establish the same reachable guidance for their chosen host.

For the first feature in a clean repository with no chosen stack, establish the smallest runnable product and a Git publication target early. Start with **Bun workspaces and Turborepo**, even when only one app exists. Commit `bun.lock`, declare Bun in the root `packageManager` field, and use `apps/*` and `packages/*` workspaces with a root `turbo.json`. Use `bun install`, `bun run`, and `bunx` for JavaScript dependencies, scripts, and CLIs; do not introduce npm or pnpm lockfiles or commands. Keep Turbo tasks scoped to the apps and packages affected by a change. If the user has chosen another stack for a new product, use it and keep the same behavior and proof discipline.

Put deployable surfaces under `apps/` (`web`, `mcp-ui`, `ios`, `desktop`, and others only when needed) and reusable code under `packages/`. Share code only where consumers and platform boundaries justify it. For a new interactive web UI, put a **React + TypeScript + Vite** app in `apps/web`, shared shadcn/ui components and Tailwind styling in `packages/ui`, then follow the [web feature path](../../web-feature/SKILL.md) to decide whether Pencil and Storybook are useful for the initial feature. Use **Next.js App Router** when server rendering or public content requirements justify it, and record that choice. Consult the current [Vite](https://vite.dev/guide/), [shadcn monorepo](https://ui.shadcn.com/docs/monorepo), or [Next.js installation](https://nextjs.org/docs/app/getting-started/installation) guidance for the chosen profile. Check the generated package manager, lockfile, workspace imports, and running scripts before building on it. Add the project profile once actual commands and surfaces exist; do not fill it with anticipated commands.

For a ChatGPT plugin, use [plugin engineering](../../chatgpt-plugin/SKILL.md) to choose verified SDK profiles, UI consumers and portable packaging. Keep product runtime servers in the product, not in astack itself. Record host/account constraints and connection refresh commands when known.

For MCP backed by the foundation's Convex operations, serve its protocol adapter from a Convex HTTP action in `packages/backend/convex`; share the authorized operations with web and keep an MCP host bridge in `apps/mcp-ui` when it has a UI. Follow the [MCP server path](../../mcp-server/SKILL.md) for transport and proof. Create `apps/mcp` when a separate process or deployment is needed. A server with no web UI does not need `apps/web`, `packages/ui`, Pencil, or Storybook. Add persistence only when the behavior needs it.

For a new web product, install [Portless](https://portless.sh/) as a Bun-managed development dependency. It supports Vite and Next.js and currently requires Node.js 24+ alongside Bun. Keep root Turbo `dev` pointed at workspace `dev` scripts. Run `portless doctor` and establish proxy/TLS trust interactively before headless proof. Record the checkout's actual URL and startup command in `.astack/project.md`; linked worktrees get separate hostnames. Run CI build and lint directly when a proxy is unnecessary.

For example, use the product's actual name in the web workspace's [Portless command](https://portless.sh/commands):

```json
{
  "scripts": { "dev": "portless run --name myapp vite", "dev:app": "vite" }
}
```

Use `next dev` in both script commands for the Next.js profile. Portless injects the Vite port/host flags; verify the installed version's behavior and avoid script indirection that prevents detection. Register the actual URL in WorkOS origins and redirect settings.

For a new Next.js app, preserve the framework's generated `AGENTS.md` guidance to its version-matched bundled docs. Next.js 16.3+ can maintain that block when `next dev` runs; keep project instructions outside its managed markers. [Next DevTools MCP](https://nextjs.org/docs/app/guides/mcp) requires separate `next-devtools-mcp` installation and agent-client configuration even though Next.js 16+ supplies the development endpoint. Install it with Bun in the repository root and configure the project's Codex MCP server in trusted `.codex/config.toml` (or the actual agent client's equivalent):

```toml
[mcp_servers.next-devtools]
command = "bunx"
args = ["next-devtools-mcp"]
```

Verify Codex loads it and that its project metadata identifies this checkout's running server before relying on its logs, routes, or errors. Next.js also publishes a separate [`next-dev-loop` skill](https://nextjs.org/docs/app/guides/ai-agents#next-dev-loop) for the edit and verify loop; use it when installed and relevant. Use [Tester Army e2e](../../testing/references/e2e.md) as the default for repeatable web verification and live MCP inspection. Install exact compatible versions, commit the lockfile, and install or refresh its version-matched project skill. Configure and prove the actual agent client's MCP launcher; an entry in a config file alone does not prove the host loaded it. Keep a working browser driver for project app control when useful; framework diagnostics alone do not prove the user path.

Configure [shadcn lint](../../react/references/shadcn-lint.md) for web files and Storybook files when present, verify save-time diagnostics where an editor supports them, and record the UI lint command in `.astack/project.md`. Verify that the browser runtime can start, then record the project's web proof command and safe fixture route in `.astack/project.md`. Keep generated screenshots and recordings out of source control unless the project deliberately tracks them.

Once a product has a runnable user surface that needs repeatable driving, follow [app control and feature map](../../app-control/references/control-contract.md) to create or adopt a project-owned `astack-<app>` CLI that can drive and observe it. Keep its skill and script in `.codex/skills/astack-<app>/` and its map in `.astack/feature-map/<app>/`. Build the smallest real command set and map for the first feature, then extend them as the product grows. A project with several independently launched apps may need a control skill and map for each. A library without a running user surface keeps its existing executable checks; do not fabricate an app driver for it.

If the new app needs a database, choose [Convex](../../convex/SKILL.md) in `packages/backend/convex`, expose the generated API to consuming apps through the backend workspace, and record how to start and identify its local deployment in the project profile. The foundation uses WorkOS for web authentication and MCP OAuth; use [WorkOS identity guidance](../../workos-auth/SKILL.md) and the current platform integration. Keep local data and credentials out of version control. Do not create an unused backend or empty app packages just to fill the layout.


Finish through [runtime loop setup](runtime-loop.md): exercise the real path, record the project profile and agent-instruction pointer, retain evidence through cleanup, and report acceptance and remaining gaps in the PR.
