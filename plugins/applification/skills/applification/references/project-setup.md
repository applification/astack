# Project setup

Use this when installing AStack in a project or when the task needs a proof route that the project has not described.

For the first feature in a clean repository, establish the smallest runnable product and a Git publication target early. Start with **Bun workspaces and Turborepo**, even when only one app exists. Commit `bun.lock`, declare Bun in the root `packageManager` field, and use `apps/*` and `packages/*` workspaces with a root `turbo.json`. Use `bun install`, `bun run`, and `bunx` for JavaScript dependencies, scripts, and CLIs; do not introduce npm or pnpm lockfiles or commands. Keep Turbo tasks scoped to the apps and packages affected by a change.

Put deployable surfaces under `apps/` (`web`, `mcp`, `ios`, `desktop`, and others only when needed) and reusable code under `packages/`. Share code only where consumers and platform boundaries justify it. For a web UI, put the app in `apps/web`, shared shadcn/ui components and Tailwind styling in `packages/ui`, then follow the [web feature path](web-feature.md) with Storybook and a Pencil design file. The official [shadcn monorepo scaffold](https://ui.shadcn.com/docs/monorepo) can create the web and UI workspaces with Turborepo; for example, `bunx shadcn@latest init -t vite --monorepo` starts the default web path. Select Vite or Next.js by the web feature rule. Check the generated package manager, lockfile, workspace imports, and running scripts before building on it. Add the project profile once actual commands and surfaces exist; do not fill it with anticipated commands.

For a new MCP server, create `apps/mcp` and follow the [MCP server path](mcp-server.md). A server with no web UI does not need `apps/web`, `packages/ui`, Pencil, or Storybook. Add a shared backend package only when its domain behavior has a real consumer; keep the protocol adapter in the MCP app.

For a new web product, configure [shadcn lint](shadcn-lint.md) for web and Storybook files, verify save-time diagnostics where an editor supports them, and record the UI lint command in `.astack/project.md`. Add [agent-browser](https://agent-browser.dev/installation) as a Bun-managed development dependency for repeatable running-app proof. Verify that its browser runtime can start, then record the project's web proof command and safe fixture route in `.astack/project.md`. Keep generated screenshots and recordings out of source control unless the project deliberately tracks them.

Once a product has a runnable user surface, follow [app control and feature map](app-control.md) to create or adopt a project-owned `astack-<app>` CLI that can drive and observe it. Build the smallest real command set and map for the first feature, then extend them as the product grows. A project with several independently launched apps may need a control skill for each. A library without a running user surface keeps its existing executable checks; do not fabricate an app driver for it.

If the new app needs a database, choose [Convex](database.md) in `packages/backend/convex`, expose the generated API to consuming apps through the backend workspace, and record how to start and identify its local deployment in the project profile. Keep local data and credentials out of version control. Do not create an unused backend or empty app packages just to fill the layout.

When adopting AStack in an existing repository, inspect its current package manager and layout. If it differs from this standard, make the Bun/Turborepo migration an explicit, reviewable part of adoption, including scripts, CI, and lockfile changes. Do not silently mix package managers or restructure a repository as a side effect of an unrelated fix.

Inspect the actual repository first: entry points and user surfaces, package scripts or task runner, local startup and fixture commands, existing tests and CI, authentication and safe data environments, project instructions, issue/PR workflow, and the current home for durable domain terms or decisions. Reuse working paths. Confirm a proposed command from its source or by running a safe check; do not invent a command that merely sounds conventional.

Create or update a tracked `.astack/project.md` with only what a later agent cannot cheaply infer. For a web UI design sprint, keep the behavior contract, Pencil file, supporting design assets, and retained validation evidence together under `.astack/<feature>/`; Storybook stories stay with their components and are referenced from the contract. Do not make separate root `design/` and `docs/` folders for the sprint. Check the repository's ignore rules, remove or override any rule that ignores `.astack/`, and verify the files appear in Git before treating setup as complete.

```markdown
# AStack project profile

## Product surfaces
Who uses each surface and which repository area serves it.

## Feedback and proof
Fast checks while editing, including the UI lint command for web and stories;
checkpoint checks; how to start, identify, drive, and stop a disposable running
instance; safe fixtures; evidence location.
Name checks that establish only a component or contract and those that reach
the real user path. Link each existing `astack-<app>` skill and feature map.

## Selection rules
Which behavior or dependency changes call for each surface, including indirect
effects such as backend changes exposed through another client.

## Project decisions
Where durable domain terms and consequential decisions live; which feature
folders are active under `.astack/`; PR and release rules; actions reserved
for the owner.
```

Write concise paths and commands, with pointers to feature contracts and authoritative project sources. Do not copy long procedures or secrets into the profile or feature folders. AStack does not prescribe an issue tracker or a universal test runner. A project may replace old guidance while adopting AStack; reconcile conflicting instructions rather than leaving two active processes.

Exercise one harmless mapped user path through the control CLI after setup, including its doctor and cleanup commands where applicable. Confirm that captured evidence survives cleanup. If the route cannot run, record the missing prerequisite and exact limit; setup is not complete merely because the files exist.

When setup changes the repository, finish with a [pull request](pr.md) showing the resulting layout, proof route, and any migration limits.
