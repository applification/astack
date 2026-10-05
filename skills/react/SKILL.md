---
name: react
description: Implement or review React components, hooks, forms and data adapters when changing rendering, state ownership, effects or reusable UI APIs. Preserve the project's React version and design system.
metadata:
  short-description: "Build React UI with clear state and adapter ownership"
---

# React engineering

Read `.astack/project.md` when present for the project's runtime, control and verification commands; use the requested scope without requiring the astack coordinator or a setup pass.

When changing adapters or typed state, read [boundary discipline](../principle-boundary-discipline/SKILL.md) or [type-system discipline](../principle-type-system-discipline/SKILL.md) as applicable.

Use directly for a component, hook, form or React review. Inspect the owning app, React version, consumers and existing component/data conventions. Apply [TypeScript guidance](../typescript-best-practices/SKILL.md) for `.ts`/`.tsx` changes. Keep an existing framework and design system; new-project choices belong to [project-setup](../project-setup/SKILL.md).

## Put state where it belongs

- Render derived values from props/state instead of copying them into state with an effect. Keep editable drafts local; choose an explicit reset/commit policy when the selected record changes. Do not overwrite an unsaved draft whenever a subscription updates.
- Keep Convex subscriptions authoritative for Convex records. Select an ID, then derive the selected record from the current result. An absent record must render a deliberate state; a stale selected object must not remain editable. Use [Convex](../convex/SKILL.md) for its client/auth boundaries.
- Put user-triggered writes in event/submit handlers. Await the operation, expose pending/error outcomes and prevent repeated submission where it would duplicate an effect. Do not show a saved state before persistence succeeds.
- Use effects to synchronize external systems, not to chain local derived state or initiate a user action. Include the actual reactive dependencies. Pair subscriptions/listeners/bridge connections with cleanup; abort or ignore obsolete requests. Test remounts when a lifecycle changes, including Strict Mode's development checks.
- Keep `packages/ui` or the existing shared UI browser-safe: typed data and callbacks through props, no Convex/WorkOS client, host bridge, server secrets or filesystem imports. Web/MCP adapters own those integrations. Read [state and adapter examples](references/state-and-adapters.md) when changing this boundary.

## Design an interaction, not just a render

Use semantic controls, accessible names, associated labels and actual form submission. Make loading, empty, error, disabled/read-only and conflict states distinguishable when the interaction requires them. Preserve keyboard and focus behavior after a modal, error or destructive action. Use stable entity keys; changing a key deliberately resets the subtree, so do not use random keys to force refreshes.

Keep shared component APIs explicit. Prefer children/slots or small variant components when booleans create contradictory modes; introduce context for genuinely shared sibling state, with its provider owning the implementation. Avoid a universal component for unrelated behaviors. If installed, Vercel's `vercel-composition-patterns` adds concrete compound-component examples; apply only relevant rules and check React-version constraints.

New Vite forms use TanStack Form with the project's Zod schemas. Form validation supports feedback; backend authorization/validation remains authoritative. An existing Next.js project may use its documented server-action form path. Adding Form does not require Query. Consult the installed libraries' official docs rather than transplanting framework APIs.

For shadcn/ui work read [scoped lint guidance](references/shadcn-lint.md), preserving existing tooling. [web-feature](../web-feature/SKILL.md) owns substantial visual direction and the optional Pencil/Storybook workflow; technical React work does not require a design sprint.

Exercise the changed interaction and relevant state transitions with [testing](../testing/SKILL.md). A fixture story proves its component state; real save/authorization claims need the running adapter/backend and a fresh read. Return the changed ownership, observed cases and gaps to the caller; use [pr](../pr/SKILL.md) only when delivering kept repository changes or preparing a PR.

Primary guidance: [derived state and effects](https://react.dev/learn/you-might-not-need-an-effect), [effect lifecycle](https://react.dev/learn/synchronizing-with-effects), [state preservation](https://react.dev/learn/preserving-and-resetting-state), [TanStack Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation).
