---
name: principle-sequence-verifiable-units
description: Sequence a multi-step change or migration into coherent units with a baseline and useful verification before building dependent work on them.
license: MIT
metadata:
  short-description: "Sequence changes into coherent and verifiable units"
---

# Sequence work into verifiable units

Order work as coherent units, each ending in a state you can check. Do not build the next dependent unit on an unexplained failure; independent work may continue while a prerequisite is unresolved.

**Why:** A break caught at the unit that caused it is cheap to localize. A break caught after a batch is buried, and you have already built further on a broken base. Sequencing those same units into a delivery a reviewer can replay turns "trust me" into "watch it go red, then green."

**Execution.** In a sweep, migration, or any run of similar edits, verify each change before starting the next. Each unit is a before/after bracket: known-good state, one change, run the check, then proceed. Use the agreed base and capture the actual baseline before changing it; preserve an existing branch/PR and unrelated work. When a lever does the edits, the per-unit check is nearly free. Run it anyway.

**Delivery.** Order commits in the designated PR so a reviewer can follow and verify the work. The canonical shape is the failing test first, then the fix on top. Other story orders are a subtraction before the reshape, a baseline capture before the treatment, the scaffold before the feature. Record the expected red regression result separately from the passing delivery checks; a baseline capture or failing regression can explain why the next unit is needed.

Use [prove it works](../principle-prove-it-works/SKILL.md) for the check itself and [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md) when a repeatable mechanism would make it reliable.

Apply this leaf directly or alongside a workflow/platform skill. Read relevant project instructions and `.astack/project.md` when present. Return the concrete decision and actual evidence or limits; the caller owns delivery and publication.

[Imported source and adaptations](upstream.json); [MIT licence](LICENSE).
