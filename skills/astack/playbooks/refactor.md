---
name: refactor
route: refactor
---

# Refactor

1. **research**: Use [refactor](../../refactor/SKILL.md) to name the invariant and pin consumer-visible behavior with a useful baseline.
2. **implementation**: Simplify ownership and move callers in coherent units. Rerun the pin and delete obsolete paths.
3. **review**: Use [code-review](../../code-review/SKILL.md) to challenge the diff and [verify](../../verify/SKILL.md) to compare the same cases and inspect affected boundaries. Behavior changes need explicit scope.
4. **lead**: Use [pr](../../pr/SKILL.md) to deliver the structural change and equivalence evidence.

The lead owns integration. Resolve model roles through [orchestration](../references/orchestration.md); inherited roles may run directly. Preserve the task’s authority and report omitted steps with reasons.
