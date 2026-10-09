# Reliability implementation evidence

Starting revision: `0ff54b0a15ab58fe5353f55175d5a9a62a28bbc5`. Scope and acceptance: [behavior contract](behavior-contract.md). Owner pilot: [new-repository validation](../../docs/agent-validation.md).

## Guidance and package checks

- `bun run check` passed with 122 declared routing examples, portable manifests, skill identities/UI metadata and local links. These are consistency checks, not 122 executed agent evaluations.
- `bun test scripts` passed: 15 tests and 56 assertions.
- Codex skill-creator `quick_validate.py` passed for architect, code-review, correct and agent-evaluation. The first attempt lacked PyYAML; a disposable Python environment supplied it, with no repository dependency changes.
- Foundation `typecheck` passed before runner integration. Its Vite warning about a future native configuration loader is existing reference behavior; it did not fail compilation.

## Independent guidance contribution

T3 task `astack-reliability-guidance-forward-review-20261009-r1` performed a read-only review and four forward exercises. The scoped bytes stayed fixed across HEAD advancing to `619860a`; the child recorded aggregate SHA-256 `cf7c3f79d7358c02527d57bcbed301f83e760f567ba8b25332602fb5e87d9843`.

- Retryable-export design: proposed durable operation identity, fenced attempts, atomic cancellation/publication and reconciliation, with product assumptions explicit. This was a design exercise, not implemented runtime proof.
- Save review: identified the missing persistent effect of returning an immutable changed snapshot; did not invent surrounding authorization or runtime behavior.
- Tiny CLI label: selected a narrow route, same-command observation and self-review without architecture, evaluation or extra tests.
- Experiment interpretation: retained 10/12 planned outcomes, activation failure and timeout, and kept uncalibrated quality unassessed.

The parent confirmed both findings: G1 needed a predeclared reviewer qualification rule, now in the rubric/protocol/calibration recipe; G2 linked a mutable external recipe, now a package-relative guide with a recorded-source requirement. Structural package checks passed after the corrections. This contribution establishes practical instruction use on these exercises, not an accuracy score or general software-quality improvement.

## Runner and fresh-repo observations

Before integration, the draft CLI created `/private/tmp/notebook-maintainer-seed-20261009` as its own Git repository. The parent opened its actual loopback app through T3 preview, created two Alice notes, clicked Done on the first, reloaded and restarted the owned service. The first record remained `done: false`, and the adjacent note remained unchanged. [The retained initial screenshot](evidence/seed-done-rejected.png) shows the still-open note; disk inspection confirmed the persisted value. The fixture is deliberately defective, so this is an expected baseline failure, not a harness completion claim. The final integrated checker and real-agent comparison are still pending.

## Owner acceptance still to run

The owner follows the manual guide in a newly initialized repository, records browser/keyboard and direct HTTP results, and assesses supervision/usefulness. Human-adjudicated calibration, blinded craftsmanship grading, actual sequential fresh-agent maintenance and repeated comparisons are required before a broad improvement claim. Simulated actor ownership does not establish live authentication.
