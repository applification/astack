---
name: pr
description: Review an existing change or prepare and update its pull request with intent, quality, useful explanations and observed proof.
metadata:
  short-description: "Review changes and prepare a PR with useful evidence"
---

# PR and review

Use this skill directly for a review or PR, or when astack delivery reaches review. Read the request, current diff, project PR rules and available proof first. Repository changes meant to be kept finish in a PR, whether they came from a feature, bug fix, refactor, performance change, or project setup. Carry the owner-selected PR through later additions and revisions. Continue it when it covers the task; coherent slices can be separate commits within it. A new capability or skill does not by itself authorize a second PR. A read-only investigation or review needs no new PR. If required design or proof is blocked after independent work is complete, open a draft PR that names the blocker and unverified claims; do not describe the change as finished. A missing remote or base branch must be resolved before a PR can exist.

For a read-only review, return findings with source locations and proof gaps. For PR preparation, inspect the full diff against the agreed intent. Review two questions separately:

1. **Intent:** Does the diff satisfy the requested outcome, with an appropriate proof result for each applicable acceptance case? Did it add material behavior outside scope?
2. **Quality:** Does the code preserve project invariants, keep a clear data shape, avoid unnecessary layers, and have tests at useful seams?

For a change to a shared contract, persisted shape, event, or lifecycle, trace affected consumers beyond direct callers. State the fact that must hold for the change to be safe and the evidence supporting it; mark that fact unverified when the available source cannot establish it.

When domain meaning changes or ambiguity was resolved, check the affected request, code, glossary, behavior contract and review explanation for consistent terms. Use [domain language guidance](../domain-modeling/SKILL.md); link relevant definitions and consequential decisions without putting implementation specifications in the glossary. Report unresolved meaning or residual naming drift. A routine PR using settled terms needs no glossary edit or ADR.

When the PR changes Convex schema, functions, configuration, or client integration, invoke `$convex:convex-reviewer` on the completed diff before marking it ready. Check its findings against the code, fix confirmed security, authorization, validator, index, pagination, reactivity, and type-safety issues, then rerun affected checks. Record the reviewer result and any unresolved finding in the PR. If the reviewer skill is unavailable, keep the PR in draft and name that missing review; astack cannot claim the Convex review gate passed.

Use an additional independent reviewer or subagent only when the change's risk or breadth justifies the extra pass and the project permits it. This is separate from the required Convex reviewer skill. Independent review remains advisory; the lead assesses each finding against actual code and intent.

## Show the change

Use [$applification:show-me](../show-me/SKILL.md) when a view will clarify the completed change. Give it the relevant diff, actual source and the reviewer's question; place its focused output beside the explanation it supports. A simple label correction can stay with a sentence and relevant evidence. Follow [PR artifact delivery](references/explanation-delivery.md) to make an HTML illustration or retained capture accessible at the PR destination.

Explain what changed and why the boundary or order matters. Link source locations or acceptance cases where useful, label proposals or unknowns, and refresh the view when the diff changes. An explanatory diagram, sketch or HTML illustration does not establish that the depicted behavior ran. Keep actual observations and gaps in the proof summary.

Before marking a PR ready, select the screenshots or recordings that help a reviewer assess the result and attach them to the PR, or link committed media accessible from it. Keep redundant captures with the raw runner artifacts; a proof index can map multiple observations to one byte-identical image. If media is unnecessary for review, state why briefly. Video is optional; use it when motion, timing, or a journey needs to be seen. Follow [proportional evidence retention](../verify/references/proof-policy.md#keep-review-evidence-proportional) rather than committing a full run directory.

Keep the PR description brief and useful to a reviewer:

- **Why:** the intended outcome and reason for change.
- **Scope:** the material behavior and implementation boundaries.
- **Explanation when useful:** one focused view of the changed logic, structure, state or interaction beside the claim it clarifies; distinguish an illustrative view from observed product evidence.
- **Behavior contract and validation:** link the tracked `.astack/<feature>/behavior-contract.md` for design sprints and summarize its agreed cases, Pencil and Storybook decisions for web UI work, any chosen frames or story IDs, running-product results, and gaps. Name the exact revision and environment for proof. Omit a separate contract for a small change whose outcome is already clear from Why; put its web UI tool decisions in the PR.
- **Tradeoffs:** only choices a reviewer would reasonably question.
- **Blast radius:** affected users, surfaces, or data and the key safety fact.
- **Verification for other changes:** named claims, observed results, revision and environment, and any skipped or inconclusive checks when there is no behavior contract.

Do not substitute a list of commands for their observed outcomes. Keep existing project CI and merge requirements visible. For running-app changes, map acceptance IDs to observed results and retained evidence. Summarize unresolved candidates, confirmed defects, flaky tests and inconclusive charters separately from required regression checks. A green advisory exploration job does not satisfy acceptance. A confirmed defect affecting the requested cases keeps the PR in draft until fixed or explicitly accepted by the owner. Name gaps caused by artifact expiry; retain evidence supporting lasting claims beyond short CI retention. Follow the user's and project's merge policy; astack itself does not authorize a merge or deployment.
