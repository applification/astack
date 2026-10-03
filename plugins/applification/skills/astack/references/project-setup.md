# Project setup

Use this when starting a new product, adopting astack in an existing project, or adding a proof route that the project has not described. The stack below is astack's greenfield default, not a condition for using its work routes or app control.

For the first feature in a clean repository with no chosen stack, establish the smallest runnable product and a Git publication target early. Start with **Bun workspaces and Turborepo**, even when only one app exists. Commit `bun.lock`, declare Bun in the root `packageManager` field, and use `apps/*` and `packages/*` workspaces with a root `turbo.json`. Use `bun install`, `bun run`, and `bunx` for JavaScript dependencies, scripts, and CLIs; do not introduce npm or pnpm lockfiles or commands. Keep Turbo tasks scoped to the apps and packages affected by a change. If the user has chosen another stack for a new product, use it and keep the same behavior and proof discipline.

Put deployable surfaces under `apps/` (`web`, `mcp`, `ios`, `desktop`, and others only when needed) and reusable code under `packages/`. Share code only where consumers and platform boundaries justify it. For a web UI, put a Next.js App Router app in `apps/web`, shared shadcn/ui components and Tailwind styling in `packages/ui`, then follow the [web feature path](web-feature.md) to decide whether Pencil and Storybook are useful for the initial feature. Consult the current [shadcn monorepo scaffold](https://ui.shadcn.com/docs/monorepo) and [Next.js installation guide](https://nextjs.org/docs/app/getting-started/installation) for Bun-compatible setup. Check the generated package manager, lockfile, workspace imports, and running scripts before building on it. Add the project profile once actual commands and surfaces exist; do not fill it with anticipated commands.

For a ChatGPT plugin, use [plugin engineering](chatgpt-plugin.md) to choose verified SDK profiles, UI consumers and portable packaging. Keep product runtime servers in the product, not in astack itself. Record host/account constraints and connection refresh commands when known.

For a new MCP server, create `apps/mcp` and follow the [MCP server path](mcp-server.md). A server with no web UI does not need `apps/web`, `packages/ui`, Pencil, or Storybook. Add a shared backend package only when its domain behavior has a real consumer; keep the protocol adapter in the MCP app.

For a new web product, install [Portless](https://portless.sh/) as a Bun-managed development dependency and use it for local Next.js startup. Portless currently requires Node.js 24+ to run, in addition to the project's Bun requirement. With Turborepo, use the web workspace's `dev` script for `portless`, a separate `dev:app` script for `next dev`, and a `portless` package setting with the app name and `"script": "dev:app"`. Keep the root Turbo `dev` task pointed at workspace `dev` scripts. Run `portless doctor` and start the app once in an interactive environment to establish its local proxy and TLS trust; first-run setup can require privilege and cannot prompt in a headless agent or CI session. Record the actual Portless URL and startup command in `.astack/project.md`. Linked Git worktrees get their own hostnames, so do not hardcode the main checkout's URL in proof commands. Run build and lint checks directly in CI when a local proxy is unnecessary.

For example, after adding Portless to `apps/web`, use this workspace setup with the product's actual name:

```json
{
  "scripts": { "dev": "portless", "dev:app": "next dev" },
  "portless": { "name": "myapp", "script": "dev:app" }
}
```

For a new Next.js app, preserve the framework's generated `AGENTS.md` guidance to its version-matched bundled docs. Next.js 16.3+ can maintain that block when `next dev` runs; keep project instructions outside its managed markers. [Next DevTools MCP](https://nextjs.org/docs/app/guides/mcp) requires separate `next-devtools-mcp` installation and agent-client configuration even though Next.js 16+ supplies the development endpoint. Install it with Bun in the repository root and configure the project's Codex MCP server in trusted `.codex/config.toml` (or the actual agent client's equivalent):

```toml
[mcp_servers.next-devtools]
command = "bunx"
args = ["next-devtools-mcp"]
```

Verify Codex loads it and that its project metadata identifies this checkout's running server before relying on its logs, routes, or errors. Next.js also publishes a separate [`next-dev-loop` skill](https://nextjs.org/docs/app/guides/ai-agents#next-dev-loop) for the edit and verify loop; use it when installed and relevant. Use [Tester Army e2e](e2e.md) as the default for repeatable web verification and live MCP inspection. Install exact compatible versions, commit the lockfile, and install or refresh its version-matched project skill. Configure and prove the actual agent client's MCP launcher; an entry in a config file alone does not prove the host loaded it. Keep a working browser driver for project app control when useful; framework diagnostics alone do not prove the user path.

Configure [shadcn lint](shadcn-lint.md) for web files and Storybook files when present, verify save-time diagnostics where an editor supports them, and record the UI lint command in `.astack/project.md`. Verify that the browser runtime can start, then record the project's web proof command and safe fixture route in `.astack/project.md`. Keep generated screenshots and recordings out of source control unless the project deliberately tracks them.

Once a product has a runnable user surface that needs repeatable driving, follow [app control and feature map](app-control.md) to create or adopt a project-owned `astack-<app>` CLI that can drive and observe it. Keep its skill and script in `.codex/skills/astack-<app>/` and its map in `.astack/feature-map/<app>/`. Build the smallest real command set and map for the first feature, then extend them as the product grows. A project with several independently launched apps may need a control skill and map for each. A library without a running user surface keeps its existing executable checks; do not fabricate an app driver for it.

If the new app needs a database, choose [Convex](database.md) in `packages/backend/convex`, expose the generated API to consuming apps through the backend workspace, and record how to start and identify its local deployment in the project profile. Keep local data and credentials out of version control. Do not create an unused backend or empty app packages just to fill the layout.

When adopting astack in an existing repository, keep its package manager, framework, database, layout, and working commands. Create `.astack/project.md` and a control CLI only where they earn their cost; record the commands that actually run. Migrate to Bun/Turborepo or another part of the greenfield default only when requested as a separate, reviewable change, including scripts, CI, and lockfile changes. Do not mix package managers or restructure a repository as a side effect of an unrelated fix.

Inspect the actual repository first: entry points and user surfaces, package scripts or task runner, local startup and fixture commands, existing tests and CI, authentication and safe data environments, project instructions, issue/PR workflow, and the current home for durable domain terms or decisions. Reuse working paths. Confirm a proposed command from its source or by running a safe check; do not invent a command that merely sounds conventional.

Create or update a tracked `.astack/project.md` with only what a later agent cannot cheaply infer. For a web UI design sprint, keep the behavior contract and retained evidence under `.astack/<feature>/`, alongside the Pencil file and supporting assets when selected; Storybook stories, when selected, stay with their components and are referenced from the contract. Do not make separate root `design/` and `docs/` folders for the sprint. Check the repository's ignore rules, remove or override any rule that ignores `.astack/`, and verify the files appear in Git before treating setup as complete.

```markdown
# astack project profile

## Product surfaces
Who uses each surface and which repository area serves it.

## Feedback and proof
Fast checks while editing, including the UI lint command for web and stories;
checkpoint checks; how to start, identify, drive, and stop a disposable running
instance; safe fixtures; evidence location.
Name checks that establish only a component or contract and those that reach
the real user path. Record regression, probe, rerun, exploration and triage commands
when present, model and budget policy, safe fixtures, instance ownership, required CI
checks, and durable evidence retention. Record actual commands, not anticipated ones. Link each existing `astack-<app>` skill and feature map.

## Selection rules
Which behavior or dependency changes call for each surface, including indirect
effects such as backend changes exposed through another client.

## Project decisions
Where durable domain terms and consequential decisions live; which feature
folders are active under `.astack/`; PR and release rules; actions reserved
for the owner.
```

Write concise paths and commands, with pointers to feature contracts and authoritative project sources. Do not copy long procedures or secrets into the profile or feature folders. astack does not prescribe an issue tracker or a universal test runner. A project may replace old guidance while adopting astack; reconcile conflicting instructions rather than leaving two active processes.

Exercise one harmless mapped user path through the control CLI after setup, including its doctor and cleanup commands where applicable. Confirm that captured evidence survives cleanup. If the route cannot run, record the missing prerequisite and exact limit; setup is not complete merely because the files exist.

When setup changes the repository, finish with a [pull request](pr.md) showing the resulting layout, proof route, and any migration limits.
