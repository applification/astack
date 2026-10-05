# PR and review

Repository changes meant to be kept finish in a PR, whether they came from a feature, bug fix, refactor, performance change, or project setup. Continue an existing PR when it already covers the task. A read-only investigation or review needs no new PR. If required design or proof is blocked after independent work is complete, open a draft PR that names the blocker and unverified claims; do not describe the change as finished. A missing remote or base branch must be resolved before a PR can exist.

Before opening or updating a PR, inspect the full diff against the agreed intent. Review two questions separately:

1. **Intent:** Does the diff satisfy the requested outcome, with an appropriate proof result for each applicable acceptance case? Did it add material behavior outside scope?
2. **Quality:** Does the code preserve project invariants, keep a clear data shape, avoid unnecessary layers, and have tests at useful seams?

For a change to a shared contract, persisted shape, event, or lifecycle, trace affected consumers beyond direct callers. State the fact that must hold for the change to be safe and the evidence supporting it; mark that fact unverified when the available source cannot establish it.

When the PR changes Convex schema, functions, configuration, or client integration, invoke `$convex:convex-reviewer` on the completed diff before marking it ready. Check its findings against the code, fix confirmed security, authorization, validator, index, pagination, reactivity, and type-safety issues, then rerun affected checks. Record the reviewer result and any unresolved finding in the PR. If the reviewer skill is unavailable, keep the PR in draft and name that missing review; astack cannot claim the Convex review gate passed.

Use an additional independent reviewer or subagent only when the change's risk or breadth justifies the extra pass and the project permits it. This is separate from the required Convex reviewer skill. Independent review remains advisory; the lead assesses each finding against actual code and intent.

Before marking a PR ready, select the screenshots or recordings that help a reviewer assess the result and attach them to the PR, or link committed media accessible from it. Keep redundant captures with the raw runner artifacts; a proof index can map multiple observations to one byte-identical image. If media is unnecessary for review, state why briefly. Video is optional; use it when motion, timing, or a journey needs to be seen. Follow [proportional evidence retention](proof.md#keep-review-evidence-proportional) rather than committing a full run directory.

Keep the PR description brief and useful to a reviewer:

- **Why:** the intended outcome and reason for change.
- **Scope:** the material behavior and implementation boundaries.
- **Behavior contract and validation:** link the tracked `.astack/<feature>/behavior-contract.md` for design sprints and summarize its agreed cases, Pencil and Storybook decisions for web UI work, any chosen frames or story IDs, running-product results, and gaps. Name the exact revision and environment for proof. Omit a separate contract for a small change whose outcome is already clear from Why; put its web UI tool decisions in the PR.
- **Tradeoffs:** only choices a reviewer would reasonably question.
- **Blast radius:** affected users, surfaces, or data and the key safety fact.
- **Verification for other changes:** named claims, observed results, revision and environment, and any skipped or inconclusive checks when there is no behavior contract.

Do not substitute a list of commands for their observed outcomes. Keep existing project CI and merge requirements visible. For running-app changes, map acceptance IDs to observed results and retained evidence. Summarize unresolved candidates, confirmed defects, flaky tests and inconclusive charters separately from required regression checks. A green advisory exploration job does not satisfy acceptance. A confirmed defect affecting the requested cases keeps the PR in draft until fixed or explicitly accepted by the owner. Name gaps caused by artifact expiry; retain evidence supporting lasting claims beyond short CI retention. Follow the user's and project's merge policy; astack itself does not authorize a merge or deployment.
