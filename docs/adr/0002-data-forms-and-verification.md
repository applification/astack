# 0002: Give data, drafts and checks explicit owners

Status: accepted. Date: 2026-10-04. Scope: foundation reference. Implements the owner's instruction to use supported platform patterns and behaviour-based tests.

## Decision and reason

Convex's native reactive client owns persisted web data and transactional mutations. TanStack Router owns validated, shareable URL filters. Do not add another Query cache for the same Convex data. MCP's adapter owns host-delivered tool data and refreshes it through tools after writes; presentation receives typed props/callbacks. The backend remains authoritative across both.

Use TanStack Form with Standard Schema/Zod validation for the React reference. Domain contracts own shared constraints, Convex uses native argument/return validators, and untrusted tool results are parsed in the adapter. A form owns its unsaved draft; failed submissions preserve it and show an actionable error. Pending submission disables duplicate submission. Reset only on observed success; uncertain writes are not automatically replayed. Next.js and other platforms follow their supported forms/auth patterns in their own profile.

Adopt strict shared TypeScript presets and verified ESLint correctness/boundary rules, not blanket bans on context, effects or component size. Keep tests about observable behaviour and meaningful contracts; `.ts` versus `.tsx` is not a restriction. Stories establish useful presentation states, real browser/protocol checks establish integration, and actual provider/host observations remain distinct.

Quick checks operate on changed files with correct project configuration. Affected checks include consumers; shared/config changes broaden scope. CI checks all applicable packages and running journeys. Formatting/staged lint run before commit with lint-staged's protections; an affected pre-push hook remains optional until measured cost supports it. The [provisional local feedback budget](../../.astack/foundation/feedback-proof.md#provisional-local-feedback-budget) sets investigation thresholds from the retained candidate measurements, with explicit host and cache scope. It does not weaken correctness or claim new timing observations.

## Consequences and verification

Shared UI cannot import backend, router, auth or host SDKs. Resolved dependency checks and valid/invalid fixtures prove the enforced boundary, including alias and relative paths. Narrow generated-code/invalid-fixture exclusions do not weaken handwritten code. Browser tests must detect a meaningful failure and survive internal refactoring. Feedback commands and hooks need measured scope, failure and partially staged evidence.

[TanStack Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation), [Convex reactive queries](https://docs.convex.dev/client/react), [React effects](https://react.dev/learn/you-might-not-need-an-effect), [lint-staged](https://github.com/lint-staged/lint-staged).
