---
name: refactor
description: Improve internal structure while preserving behavior through pinned outputs and equivalence checks.
metadata:
  short-description: "Improve structure while preserving tested behavior"
---

# Refactor

Before editing, apply [affected-capability selection](../astack/references/capability-selection.md) for the boundaries this task reaches. Reuse a selected skill already in progress; do not restart through astack.

Use this skill directly for the requested outcome, or as the selected astack delivery route. Read relevant project instructions and working commands; user scope and project constraints take precedence.

State the behavior that must remain unchanged and pin it with an existing test, recorded output, or a temporary equivalence check. Name the structural improvement and the expected reduction in reader load. Move in small steps, run the pin, and delete obsolete paths once callers have moved. [Prove](../verify/SKILL.md) the affected real artifact when the move crosses a user-visible or integration boundary. If behavior must change, use the Feature route for that part. End with a [pull request](../pr/SKILL.md) showing the equivalence evidence and structural improvement.

Inspect affected consumers and existing rationale before choosing the new boundary. Use show-me for a useful before/after shape. A renamed symbol or moved file is not equivalence evidence. Report which outputs or invariants were pinned, their actual comparison and any integration path left untested.

Read and apply linked skills when needed. Skill composition is sequential instruction use unless delegation is available, permitted and useful; it does not require a new agent. Keep one writer per worktree and return unresolved decisions to the caller.
