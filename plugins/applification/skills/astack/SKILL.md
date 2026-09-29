---
name: astack
description: astack by Applification. When invoked with an engineering task, choose the appropriate route and carry the user's prompt through intent, implementation, proportional proof, and review.
---

# astack

Treat the user's prompt after `$applification:astack` as the task, not as a request to choose a workflow. Select the route from the task's intended outcome and carry it through to a checkable result. If no task was supplied, ask what the user wants done. Help the user reach that result with the least process that protects it. User instructions and the project's established constraints take precedence over this skill. astack is Codex-first; use available capabilities rather than assuming particular tool names or subagents.

## Route the work

Choose a route before loading references. Read only its section in [work routes](references/routes.md), and only when the task needs that route's detail:

| Request | Route |
| --- | --- |
| New or changed user behavior | Feature |
| Reported defect | Bug fix |
| Internal structure with behavior held steady | Refactor |
| Measured slowness | Performance |
| Read-only question or recommendation | Investigation |
| Existing change headed for review | Pull request |
| Make a running app controllable for verification, or repair its control route | App control |

If none fits, state a small task-specific route with an outcome and a way to check it. For web UI work, use the [web feature path](references/web-feature.md) to decide whether Pencil and Storybook add useful design or component evidence. Other routes use only the surfaces they affect.

For a new product with no chosen stack, use the [astack greenfield default](references/project-setup.md): Bun and Turborepo, Next.js App Router and Portless for web, shadcn/ui in `packages/ui`, and [Convex](references/database.md) when persistence is needed. Use [shadcn lint](references/shadcn-lint.md) when the project uses shadcn/ui. An existing project can adopt astack's work routes, app control, and proof method on its current stack. Preserve its framework, package manager, database, and working tools unless the user asks to change them.

For work that adds or changes an MCP server, read the [MCP server path](references/mcp-server.md). It covers the server boundary and how to prove tool behavior, transport, authorization, and agent use when each applies. An MCP App with a web UI also follows the web feature path for that UI.

Read `.astack/project.md` when the task needs project-specific commands or policy. Read [project setup](references/project-setup.md) when asked to configure astack, when starting a feature in a clean repository, or when no runnable proof route exists. Missing configuration alone does not make a small task into a setup task. Inspect the project directly when one missing fact is all that is needed.

Read [app control and feature map](references/app-control.md) when setting up or repairing a project's running-product control route. An `astack-<app>` CLI drives and observes that project's actual product; its feature map tells an agent how to reach user behavior. Use an existing working control route when it already does this job. Keep the CLI and map current when a change alters a mapped path.

Use [the behavior contract](references/behavior-contract.md) for substantial behavior changes. When a web design pass uses Pencil or Storybook, the contract links the chosen frames or stories to implementation and proof in a tracked `.astack/<feature>/` folder. Given/When/Then can clarify a case but is not required. Small fixes may keep the contract and the Pencil/Storybook decision in the conversation and PR.

## Shared decisions

- Use Bun for JavaScript dependency management and scripts in astack's greenfield default. In an existing repository, use its package manager and scripts. astack adoption does not require a package manager or workspace migration; [project setup](references/project-setup.md) covers the default and requested migrations.
- When a task creates, adds, or changes Convex, follow [the Convex path](references/database.md). Use the `@Convex` plugin for general setup and architecture, `$convex:convex-expert` before editing backend code, and `$convex:add` for a new capability when its existing-app scope fits. A PR that touches Convex requires the `$convex:convex-reviewer` pass described in [PR and review](references/pr.md).
- Choose checks by affected behavior and dependency boundaries, not changed paths alone. Use fast feedback while editing and an appropriate running-product check when integration matters. Read [proof](references/proof.md) before claiming a behavior is verified.
- Keep acceptance about observable behavior. Tests and project proof commands implement checks; they do not redefine the intended outcome.
- When a product decision remains unresolved, ask a targeted question and continue independent work. Record a decision that changes the contract; do not silently infer it from a prototype.
- Review the completed diff against both the requested outcome and the project's code standards. Read [PR and review](references/pr.md) when preparing a PR or reviewing a change.
- Repository changes meant to be kept end in a pull request. This includes features, bug fixes, refactors, performance changes, and project setup. Update an existing PR when the task belongs to it. Read-only investigations and PR reviews do not create another PR unless they lead to changes. Check for a Git remote and base branch early; if either is missing, resolve the publication target while independent work continues. Do not merge without the owner's authorization.
- Preserve the user's autonomy boundaries. Reversible work proceeds. Follow the project's release policy for deploys, destructive data changes, messages to others, and merges. Do not treat a screenshot, mocked response, or inconclusive run as proof of a real side effect.
