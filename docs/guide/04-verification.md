# Verify and maintain the loop

State a finish condition the agent can observe:

```text
$applification:astack Add a saved-item filter. Verify that changing it changes the visible list and reopening preserves the saved item.
```

Match proof to the claim. A CLI change runs its command; a UI change drives the changed flow; a persisted write gets a fresh authoritative read; a performance claim compares equivalent workloads. A build establishes compilation and does not substitute for those observations.

Setup makes that possible through the project control skill/CLI and feature map. Later work reads `.astack/project.md` for startup, identity, actors, fixtures, exact checks, evidence and cleanup. The control tool must identify the intended instance and stop only what it owns. Evidence must survive cleanup.

The result names what ran, its revision/environment and the actual observations. A retry pass remains flaky. Failure during login is inconclusive for saving; it is not proof of a save defect or a successful save test. Full temporary reports can remain ignored while decisive sanitized evidence is retained for review.

Control instructions age as the product changes. Repair them alongside changed user paths, or ask for an explicit audit:

```text
$applification:app-control Audit the saved-items CLI commands and feature map against source and the live app. Repair stale control guidance; report product defects separately.
```

The audit distinguishes a stale command from a product regression. It records the paths actually exercised and gaps rather than claiming full coverage from one passing path. [Re-running project setup](01-project-setup.md) refreshes the wider startup/check/CI loop when those foundations change.

Before the PR is ready, [pr](../../skills/pr/SKILL.md) checks intent and quality, assesses affected consumers and presents useful evidence. Kept changes finish in the designated PR; merge and hosting follow the user's authority and project policy.

Next: [Steer and resume](05-steer-and-resume.md).
