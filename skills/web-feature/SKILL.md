---
name: web-feature
description: Design and deliver a web UI change with proportionate Pen, Storybook and running-product evidence.
metadata:
  short-description: "Design and deliver web UI with proportionate proof"
---

# Web UI decision and design sprint

Use this skill directly or during astack delivery for a feature or fix that changes a web UI. Inspect the affected user path, existing design files, component stories, and acceptance cases before choosing checks. Decide **separately** whether Pencil and Storybook would help resolve a design choice or catch a likely regression. The number of changed lines does not decide: a one-line change to a loading state or shared component can warrant either tool, while a one-line label correction may need only a running-app check. Record each decision briefly in the behavior contract when one exists, otherwise in the PR. A reason to skip a tool must refer to the change and the evidence that will cover it.

Use **Pencil** when the change needs a visual direction, layout or state comparison, or an update to an existing agreed design. Use **Storybook** when isolated component states or interactions would make the intended behavior clearer or expose a regression. Use both when comparing a component to a selected design frame matters. A new product's first substantial web UI normally benefits from both. A project without either tool can still adopt astack's work method; add a tool when the task earns its setup cost. If a selected check is unavailable, name the blocker and the claim left unverified.

Pencil is now Pen (pen.dev); use its available MCP guidance and tools. For a new product's substantial UI, establish a visual specification before implementation. No existing design is a reason to choose a direction, not by itself a reason to skip design. The foundation's portable `.astack/design/` demonstrates this with tokens, component instances, selected web/MCP frames and corresponding stories. A design reconstructed from completed code cannot establish that it guided generation.

## Choose the stack

Keep the existing framework and design system. For a new product without a chosen stack, use [project-setup](../project-setup/SKILL.md). Apply [React engineering](../react/SKILL.md) for state, forms, adapters and UI lint, [Convex](../convex/SKILL.md) for affected data boundaries, and [testing](../testing/SKILL.md) for checks. This workflow owns visual direction and design evidence; those skills own the implementation rules.

When Storybook is selected, use the official [React/Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite) or [Next.js/Vite](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite) integration for the actual framework and verify it starts. Preserve an existing project's working component tools. Read version-matched docs for the installed APIs.

## Develop the behavior contract

1. For a substantial change, start `.astack/<feature>/behavior-contract.md` with the actor, problem, intended outcome, material interaction states, and open product choices, following the [behavior contract](../implement/references/behavior-contract.md). Add a few observable acceptance cases with stable IDs when they help. For a small change, keep the outcome and design-tool decisions in the conversation and PR.
2. If Pencil is selected, create or update a `.pen` file in the same feature folder and read Pencil's tool guidance before editing. `.pen` files are not plain text and must not be inspected or changed with shell text tools. Show the consequential states the decision depends on, with supporting assets beside the file.
3. If Storybook is selected, create or update stories for the affected presentation components using fixture data through props. Check the states and interactions that matter to the change, run the project's UI lint check, and confirm the story renders. Treat mocked requests and placeholder state as component evidence.
4. When both are selected, load the relevant Storybook story in Pencil's browser, compare it with the chosen frame, and correct material differences. Record frame names and story IDs beside the acceptance cases they support, with the observed result and any gap. When only one is selected, record that tool's result. Resolve product choices with the user when the available context cannot settle them.
5. Implement the real data and ownership path. For new web projects, follow [e2e](../testing/references/e2e.md) to inspect the live app, run exact regressions, explore selected risks and confirm findings; existing projects keep their working runner. Select running-product checks from the acceptance cases and add their observed results to the contract or PR. Put evidence worth retaining in `.astack/<feature>/evidence/`; keep disposable captures outside the repository. Pencil and Storybook evidence cannot establish real data effects, timing in the app, or authorized persistence.

When a design sprint uses a tracked `.astack/<feature>/` folder, link its contract from the PR. An unavailable tool blocks completion only when its selected check is needed to support the claim; report that limit rather than marking the result as passed.

## Finish the requested job

When composed as a bounded contribution, return its result to the caller if the caller owns integration, verification or PR publication; reuse completed phases and do not open a duplicate PR. For a read-only assessment, return source-grounded findings and gaps. For kept implementation changes, use [verify](../verify/SKILL.md) to consolidate the applicable observations and [pr](../pr/SKILL.md) to finish in an existing or new PR, draft when required work is blocked. Return the delivered outcome, affected boundaries, revision/environment, proof and remaining decisions. Do not merge or release without owner authority.
