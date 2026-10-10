---
name: correct
description: Investigate repeated agent mistakes in a project and replace recurring corrections with demonstrated architectural, type, lint or behavioral safeguards within the authorized scope.
license: MIT
metadata:
  short-description: "Prevent repeated mistakes with proven safeguards"
---

# Close the correction loop

Read project instructions, relevant corrections, failing observations, reverts and review findings. Group demonstrated repeats by the mechanism that allowed them; do not invent a recurring class from one unrelated failure. Use [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md) to choose the strongest practical safeguard.

First ask whether clearer ownership or one supported interface eliminates the mistake. Then consider a type that cannot express it, a focused lint/banned import with an actionable diagnostic, or a real behavioral regression. Write guidance for decisions that still require judgment. Preserve the user's task and authority; a correction request does not authorize an unrelated migration or global host change.

For each retained safeguard, reproduce the original bad case in a disposable fixture or use its preserved failing revision. Run the guard and observe rejection, correct the case, and run the same guard again. Keep valid neighboring behavior passing. A new rule that has never rejected the demonstrated mistake has unproven coverage.

Record the mistake, its evidence, owning layer, enforcement command and negative/positive results in the existing task record or a concise [rule table](references/rule-table.md). Put project enforcement in the project. Change reusable skills only when the lesson applies across projects. Reuse the same command locally and in CI, including affected script/tooling boundaries when they own the failure.

Return the corrected classes, selected mechanism and observed coverage. Unresolved classes name the missing decision or prerequisite. Kept changes follow the project's delivery policy; investigations may end with findings. Do not weaken an invariant simply to silence its check.

[Source and adaptations](upstream.json); [MIT licence](LICENSE).
