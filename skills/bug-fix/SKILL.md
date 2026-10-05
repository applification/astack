---
name: bug-fix
description: Reproduce a reported defect, repair its supported cause and retain proportionate before-and-after regression evidence.
metadata:
  short-description: "Reproduce and repair a defect with regression proof"
---

# Bug fix

Apply [fix root causes](../principle-fix-root-causes/SKILL.md) for the reproduction and supported repair.

For a demonstrated recurring failure, apply [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md) to prevent recurrence at its owning boundary within scope.

Use this skill directly for the requested outcome, or as the selected astack delivery route. Read relevant project instructions, `.astack/project.md` when present and working commands; user scope and project constraints take precedence.

Reproduce the reported symptom on its real surface or build the closest runnable signal that can fail on that symptom. Make the loop as fast and deterministic as practical. Use code and history to distinguish causes, then change the smallest mechanism supported by evidence. Rerun the original signal after the fix; a neighboring unit test alone does not establish that the reported symptom is gone. Add a regression check at a meaningful seam when it earns its maintenance cost. Findings from exploration follow the [candidate confirmation and regression loop](../testing/references/e2e.md) when e2e is in use; setup or locator failures do not confirm a bug. End with a [pull request](../pr/SKILL.md) that names the original symptom, cause, fix, and observed before/after proof.

If reproduction is blocked, report the missing observation and continue independent source investigation. Do not infer a confirmed defect from a failed login or locator. Fixes must stay within the requested scope; a broader redesign needs a scope decision. Return the original signal, supported cause, before/after observations and remaining gaps.

Read and apply linked skills when needed. Skill composition is sequential instruction use unless delegation is available, permitted and useful; it does not require a new agent. Keep one writer per worktree and return unresolved decisions to the caller.
