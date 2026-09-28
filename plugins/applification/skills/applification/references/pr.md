# PR and review

Repository changes meant to be kept finish in a PR, whether they came from a feature, bug fix, refactor, performance change, or project setup. Continue an existing PR when it already covers the task. A read-only investigation or review needs no new PR. If required design or proof is blocked after independent work is complete, open a draft PR that names the blocker and unverified claims; do not describe the change as finished. A missing remote or base branch must be resolved before a PR can exist.

Before opening or updating a PR, inspect the full diff against the agreed intent. Review two questions separately:

1. **Intent:** Does the diff satisfy the requested outcome, with an appropriate proof result for each applicable acceptance case? Did it add material behavior outside scope?
2. **Quality:** Does the code preserve project invariants, keep a clear data shape, avoid unnecessary layers, and have tests at useful seams?

For a change to a shared contract, persisted shape, event, or lifecycle, trace affected consumers beyond direct callers. State the fact that must hold for the change to be safe and the evidence supporting it; mark that fact unverified when the available source cannot establish it.

Use a second reviewer or subagent only when the change's risk or breadth justifies the extra pass and the project permits it. Independent review remains advisory; the lead assesses each finding against actual code and intent.

Keep the PR description brief and useful to a reviewer:

- **Why:** the intended outcome and reason for change.
- **Scope:** the material behavior and implementation boundaries.
- **Acceptance:** the agreed observable cases for a substantial behavior change; omit for a small change whose outcome is already clear from Why.
- **Tradeoffs:** only choices a reviewer would reasonably question.
- **Blast radius:** affected users, surfaces, or data and the key safety fact.
- **Verification:** applicable acceptance IDs or other named claims with result, exact revision and environment, commands or journeys run, linked evidence, and any skipped or inconclusive checks.

Attach media when it makes a claim easier to inspect. Do not substitute a list of commands for their observed outcomes. Keep existing project CI and merge requirements visible. Follow the user's and project's merge policy; AStack itself does not authorize a merge or deployment.
