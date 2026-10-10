---
name: review
route: pr
---

# Review

1. **research**: Read the request, full diff, affected consumers and proof at a pinned revision.
2. **review**: Apply [code-review](../../code-review/SKILL.md) and [verify](../../verify/SKILL.md). Use a fresh reviewer when the task/project requires independence; report unavailable review as a gap.
3. **implementation**: Fix confirmed findings only when authorized, on the existing branch. Otherwise return prioritized findings and stop; record this step as skipped.
4. **lead**: Recheck affected behavior and rerun the review contribution after material fixes, then finish through [pr](../../pr/SKILL.md) when authorized changes are retained. Posting a review requires task authorization. An assessment grants no merge authority.

The lead owns integration. Resolve model roles through [orchestration](../references/orchestration.md); inherited roles may run directly. Preserve the task’s authority and report omitted steps with reasons.
