---
name: testing
description: Design, write or repair regression, integration and browser checks for changed behavior; reproduce findings with exact assertions and maintain trustworthy fixtures and test reports.
metadata:
  short-description: "Build meaningful checks and reproduce product findings"
---

# Engineering tests

Apply [test behavior, not implementation](../principle-test-behavior-not-implementation/SKILL.md) when designing assertions.

Read `.astack/project.md` when present for the project's runtime, control and verification commands; use the requested scope without requiring the astack coordinator or a setup pass.

When a recurring mistake needs an enforceable check, apply [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md).

Use directly to build or repair a check, or while implementing a change. Start with the behavior and failure the assertion must distinguish. Preserve the project's working runner and fixture conventions. [verify](../verify/SKILL.md) selects/consolidates delivery proof; this skill owns how checks exercise behavior and how findings become trustworthy regressions.

Choose the seam that owns the rule: pure functions for deterministic domain transforms, backend calls for validation/ownership/transactions, a protocol client for MCP contracts, and a real browser for rendered interaction. Mock an unrelated expensive boundary only when it preserves the claim; do not mock the data or identity boundary being tested. A schema test cannot prove persistence and a component fixture cannot prove backend authorization.

- Encode distinguishing outcomes, not implementation text or private call order. Include a meaningful rejected/boundary case when it exposes a plausible wrong implementation. Use stable IDs and explicit fixtures instead of depending on other tests' writes or wall-clock luck.
- For a bug, retain the original failing observation before changing source, then rerun the same case. A passing new assertion alone cannot show that it caught the old defect. Where useful, retain the regression with the passing suite.
- For a material authorization, persistence or recovery check, challenge a plausible incorrect implementation or the original failing revision when practical. Retain the failing counterexample and the passing corrected case. This focused discrimination check need not become a mutation-testing framework or apply to low-impact edits.
- Make async assertions wait for the effect they claim, with a bounded condition. Avoid arbitrary sleeps and success-toasts as persistence proof; perform a fresh authoritative read for a material write. Distinguish request failure from an empty valid result.
- Scope each test's actor/state and cleanup. Stop only owned processes, preserve first failures and attempts, and keep raw reports ignored. Do not weaken an expectation, suppress a relevant test or move it to advisory status to obtain green output.
- Confirm that the intended tests ran: inspect selection, body assertions and report format. Setup/locator/provider/budget failures are inconclusive for the product case. A retry pass retains its first failure as flaky.

Use the project's chosen runner and browser tools. When it uses Tester Army e2e, read [its loop](references/e2e.md) for inspection, cache, charter, reproduction and report rules. For WorkOS integrations, [auth testing](../workos-auth/references/testing.md) distinguishes provider/host layers.

Return the tested claim, fixtures, original failure when relevant, actual observations and remaining gaps. Do not add ceremonial tests for a reversible low-impact edit. Use [pr](../pr/SKILL.md) when the requested job retains code/test changes; test work alone does not authorize external effects or a broader repair.

Use [agent-evaluation](../agent-evaluation/SKILL.md) when the question is whether a model, skill or harness improves delivery. Application tests alone do not establish that comparative claim.
