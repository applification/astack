---
name: verify
description: Select and run proportionate engineering checks, interpret failures and partial proof, and report observed results with revision and environment.
metadata:
  short-description: "Run proportionate checks and report actual proof"
---

# Verify the outcome

When owning a substantive verification task with agentlog readable capture, use the [automatic evaluation handoff](../astack/references/observatory.md#automatic-task-evaluations) at task start and delivery. During an enclosing delivery task, reuse its existing task ID and return actual proof to its owner instead of creating another evaluation. Telemetry failures must not block verification.

Read [prove it works](../principle-prove-it-works/SKILL.md) before claiming the named outcome.

Read `.astack/project.md` when present for the project's runtime, control and verification commands; use the requested scope without requiring the astack coordinator or a setup pass.

Use this directly to verify a named change or claim, or during astack delivery. Start from the request or acceptance cases, affected diff and the project's actual commands and surfaces. Do not replace the intended outcome with whatever the existing suite happens to check.

1. Identify the failure each material case must distinguish. Choose the cheapest useful check and any running-product observation needed for data, identity, timing or integration. Trace affected consumers; a backend change can require a browser check.
2. Establish the intended checkout, revision, build/environment and safe fixture before driving it. Use the project's working control skill or runner. If the requested claim requires missing control tooling, use [app-control](../app-control/SKILL.md) when creating it is in scope; otherwise report the prerequisite.
3. Run the selected checks and inspect their assertions, reports, attempts and artifacts. Confirm material effects with a fresh read or independent view. Preserve the first failure, distinguish product defects from setup failures, and retain useful regressions after an authorized fix.
4. Return a concise result for each applicable case: expected observation, actual observation, revision/environment, evidence and remaining gap. Use pass, fail, inconclusive, skipped or not applicable with reasons. Report a retry pass as flaky rather than erasing its first failure.

Read [proof policy](references/proof-policy.md) for surface selection, candidate confirmation, evidence retention and host boundaries. When authoring or repairing checks, apply [testing](../testing/SKILL.md); it owns regression design and the e2e loop. Keep component, protocol, emulated-host, live-provider and installed-host observations distinct. Builds and routing examples do not establish agent delivery.

For example, a save test that never gets past login is inconclusive for saving. A successful save followed by a fresh read of the changed record can support persistence on that actor/environment, while leaving another host untested. A copy correction may need only a focused rendered check.

Keep full output in ignored folders or CI; retain the decisive sanitized report, source identities and selected media. Stop only owned processes and preserve evidence through cleanup. A later implementation change requires fresh proof for behavior it could affect. Report proof to the caller; use [pr](../pr/SKILL.md) when PR preparation is requested or the enclosing delivery task requires it. Verification alone does not authorize unrelated fixes, merge, release or external messages.
