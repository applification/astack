# AStack routing and proof examples

Use these as realistic checks when editing the skill. Judge the chosen route and actual behavior, not whether the final wording matches this file. Run tasks in a disposable project or review a recorded trial before changing a broad instruction.

Invoke each task through `$applification <request>`. The user chooses only this entry point; AStack chooses the route. A bare `$applification` should ask for the task rather than inventing one.

| Request | Expected decision |
| --- | --- |
| "Change the label on the web account button" | Small web feature; use a proportionate Pencil update and Storybook state, then focused web proof and a PR. No MCP or iOS proof unless the shared component reaches them. |
| "Users lose an edit after saving and reopening" | Bug route; reproduce the lost edit before changing code, then rerun that exact path and a fresh read; open a PR with the before/after evidence. |
| "Move the document parser behind a smaller interface without changing outputs" | Refactor route; pin existing outputs and compare them after the move, then open a PR with the equivalence evidence. |
| "Why was the tenant check placed in the backend?" | Read-only investigation; inspect code and decision history, no PR or app run unless needed to answer. |
| "Add a new mobile planning flow; I'm unsure how it should feel" | Short behavior contract and affected-surface proof. Resolve product choices before production wiring; open a PR. Pencil and Storybook apply if the feature also has a web UI. |
| "In an empty repo, build a client-side reading list" | Create Bun workspaces and Turborepo with `apps/web` (Vite + React + TypeScript) and `packages/ui` (shadcn/ui + Tailwind); establish Pencil, Storybook, and shadcn lint for app and story files with save-time editor feedback; prove the running app, and open a PR. |
| "In an empty repo, build a web dashboard with server-rendered private data" | Create Bun workspaces and Turborepo with a Next.js App Router app, shared UI package, and Convex backend package; establish Pencil and Storybook, prove identity and data behavior in the running app, and open a PR. |
| "In an empty repo, build a reading list that survives reload" | Create Bun workspaces and Turborepo with `apps/web`, `packages/ui`, and `packages/backend/convex`; use local Convex with `bunx`, Pencil and Storybook for UI states, prove a saved item with a fresh database read, and open a PR. |
| "Start a new Next.js and shadcn app with Convex" | Consult `@Convex` new-app guidance and runbook first; use `$convex:quickstart` if its scaffold fits, then reconcile output with Bun workspaces and the backend package. Use `$convex:convex-expert` for backend edits and `$convex:convex-reviewer` before the PR is ready. |
| "Add Convex to our existing Vite app" | Use `@Convex` existing-project setup guidance with the actual framework and package manager; do not run `$convex:quickstart` or mistake `$convex:add` for the initializer. Review backend edits with the expert skill and the PR with the reviewer skill. |
| "Add search to the existing Convex + Next.js app" | Use `$convex:add` to consult the live capability catalog, then `$convex:convex-expert` for changes under `convex/`; verify the running path and require `$convex:convex-reviewer` before the PR is ready. |
| "Review a PR that changes convex/schema.ts and a mutation" | Run `$convex:convex-reviewer` against the diff. Resolve confirmed findings and rerun affected checks before marking ready; keep the PR in draft if the specialist review cannot run. |
| "In an empty repo, build a web flow with a timed confirmation" | Use the Pencil/Storybook design sprint to develop one behavior contract: link chosen frames and stories to material acceptance cases, then use agent-browser to prove the timed interaction in the running app; capture a short recording if timing matters, and open a PR with the contract and evidence. |
| "Build a four-state presence preview like Loami" | Track `.astack/project.md` and a `.astack/presence/` folder containing the behavior contract, Pencil file and supporting assets, and retained evidence. Tie `.pen` frames and Storybook story IDs to acceptance cases, then drive the running app to prove transitions. Ensure `.astack/` is not Git ignored; do not create root `design/` or `docs/` feature folders. |
| "Add an MCP-only tool" | Behavior contract, implementation, focused protocol proof, and a PR; no Pencil, Storybook, or shadcn lint because there is no web UI. |
| "In an empty repo, build an MCP-only tool" | Start a Bun/Turborepo workspace with `apps/mcp`; add shared packages only for real consumers. Prove the protocol path and open a PR; no web UI package, Pencil, Storybook, or Convex unless the feature needs them. |
| "Adopt AStack in an existing pnpm app" | Inspect scripts and CI; migrate package manager and workspace structure to Bun/Turborepo as a reviewable adoption change, with one lockfile and working proof commands. Do not mix package managers during feature work; open a PR. |
| "Cut report generation from four seconds to two" | Performance route; measure the same user path before and after, report limitations, and open a PR for the change. |
| "Review PR #42 and fix the confirmed regression" | Review against intent and proof, make the authorized fix, and update PR #42 rather than opening another PR. |
| "Finish the PR after browser proof captured a screenshot" | Attach the screenshot to the PR or link its committed copy. If proof captured no media, explain why it would not help review; do not demand a video by default. |
| "The backend now returns another field used by MCP" | Select focused backend and MCP checks even if no MCP source file changed. |
| "Update a web-only illustration" | Select visual proof on web; explain why server and unrelated client checks do not apply. |
| "Implement the proposed design despite an unresolved delete-confirmation choice" | Ask for the product decision before coding that branch; continue independent work. |

After a trial, record whether AStack chose the right route, found an important missing decision, selected checks proportionately, and reported proof honestly. Fix an observed failure narrowly rather than adding more universal gates.
