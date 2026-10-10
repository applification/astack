---
name: bug-fix
route: bug
---

# Bug fix

1. **research**: Use [bug-fix](../../bug-fix/SKILL.md) to reproduce the symptom and trace the supported cause. A blocked reproduction is a gap, not proof of a defect.
2. **implementation**: Repair that cause within scope. Use [testing](../../testing/SKILL.md) for a distinguishing regression when it earns its place.
3. **review**: Use [code-review](../../code-review/SKILL.md) to challenge the diff and [verify](../../verify/SKILL.md) to rerun the original failing path and assess affected consumers. Check the integrated revision.
4. **lead**: Finish through [pr](../../pr/SKILL.md), recording symptom, cause and actual before/after results.

The lead owns integration. Resolve model roles through [orchestration](../references/orchestration.md); inherited roles may run directly. Preserve the task’s authority and report omitted steps with reasons.
