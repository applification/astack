# PR and review

Before opening or updating a PR, inspect the full diff against the agreed change contract. Review two questions separately:

1. **Intent:** Does every acceptance case have an implementation and an appropriate proof result? Did the diff add material behavior outside scope?
2. **Quality:** Does the code preserve project invariants, keep a clear data shape, avoid unnecessary layers, and have tests at useful seams?

Use a second reviewer or subagent only when the change's risk or breadth justifies the extra pass and the project permits it. Independent review remains advisory; the lead assesses each finding against actual code and intent.

Keep the PR description brief and useful to a reviewer:

- **Why:** the intended outcome and reason for change.
- **Scope:** the material behavior and implementation boundaries.
- **Acceptance:** the agreed observable cases for a substantial behavior change; omit for a small change whose outcome is already clear from Why.
- **Tradeoffs:** only choices a reviewer would reasonably question.
- **Blast radius:** affected users, surfaces, or data and the key safety fact.
- **Verification:** acceptance IDs with result, exact revision and environment, commands or journeys run, linked evidence, and any skipped or inconclusive applicable checks.

Attach media when it makes a claim easier to inspect. Do not substitute a list of commands for their observed outcomes. Keep existing project CI and merge requirements visible. Follow the user's and project's merge policy; AStack itself does not authorize a merge or deployment.
