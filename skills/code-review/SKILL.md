---
name: code-review
description: Review a completed diff or consequential design for correctness, indirect effects and structural simplicity, with fresh independent assessment when authorization, compatibility, concurrency or lifecycle changes warrant it.
license: MIT
metadata:
  short-description: "Challenge correctness, ownership and code quality"
---

# Review code and its consequences

Read the original request, acceptance, project instructions, full diff and relevant consumers. Pin the reviewed revision and working-tree state. Use this directly for a code assessment or as the quality contribution to [PR delivery](../pr/SKILL.md); it does not authorize editing, publication or a new PR.

Review intent and quality separately. Check the behavior against acceptance, then apply [the quality rubric](references/quality-rubric.md). Trace serialized data, persisted records, indirect consumers, teardown and ownership beyond changed symbols. State the fact that makes a shared-boundary change safe and demonstrate it with the cheapest meaningful real check.

Use a fresh read-only reviewer by default for changed authorization/identity, persisted compatibility, concurrency or shared lifecycle. Give the reviewer intent, source/diff, exact revision, relevant project rules and evidence; let it assess the code before seeing the author's proposed findings. A second model is useful only when an additional perspective justifies its cost. Select available models through the host and preserve explicit user settings. Keep local presentation edits lightweight.

The lead adjudicates every material finding against actual source and behavior. Separate confirmed fixes, justified optional improvements and dismissed findings, with reasons. Agreement between reviewers is a signal to inspect, not proof. Require a distinguishing reproduction or precise source argument for a claimed defect; keep unavailable proof visible. When authoring a check, apply [testing](../testing/SKILL.md) and challenge it with a plausible incorrect implementation where useful.

Returned review evidence belongs to the reviewed revision. Recheck findings and affected acceptance after material changes; an earlier review does not certify the new diff. Keep platform reviews required by the consuming project in the owning PR workflow.

Return prioritized findings with source locations, consequence, supporting evidence, scope and unresolved proof. Name self-review honestly when a fresh reviewer is unavailable. The delivery owner resolves findings and verifies the integrated result.

[Source and adaptations](upstream.json); [MIT licence](LICENSE).
