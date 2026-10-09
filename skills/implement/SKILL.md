---
name: implement
description: Implement an agreed feature or behavior change in coherent slices with affected-surface proof and a pull request.
metadata:
  short-description: "Deliver an agreed feature with observable proof"
---

# Feature

For multi-step delivery, apply [sequence verifiable units](../principle-sequence-verifiable-units/SKILL.md).

Use this skill directly for the requested outcome, or as the selected astack delivery route. Read relevant project instructions, `.astack/project.md` when present and working commands; user scope and project constraints take precedence.

Clarify the observable outcome through a [behavior contract](references/behavior-contract.md). For a web UI feature, use [the web feature path](../web-feature/SKILL.md) to decide independently whether Pencil and Storybook are useful before production wiring. For a new app without a chosen stack, use [the astack greenfield default](../project-setup/SKILL.md); if it needs a database, follow [the Convex path](../convex/SKILL.md). In an existing app, work with its current stack. Trace affected entry points from trigger through data, ownership, and side effects. Check history before removing an unusual constraint; distinguish recorded intent from an inference based on current code. Sketch data shape and module boundaries before promoting prototype state or changing a costly interface. Implement in coherent slices, use fast checks, and [prove](../verify/SKILL.md) the integrated behavior on applicable surfaces. End with a [pull request](../pr/SKILL.md) linking the contract and proof result, including any unresolved gaps.

Return the delivered outcome, changed boundaries, acceptance results and remaining choices. Use domain-modeling when concepts need sharpening, and show-me when a shape or alternative needs explaining.

Use [architect](../architect/SKILL.md) when the change makes a consequential interface, ownership, persisted-shape or lifecycle decision. Retain a caller usage sketch, types/boundaries, invariants and the reason for the chosen shape; compare an alternative when the tradeoff matters. For retries, migrations or background writes, include interruption, compatibility and recovery in acceptance before dependent wiring. Keep routine edits using settled interfaces lightweight.

Read and apply linked skills when needed. Skill composition is sequential instruction use unless delegation is available, permitted and useful; it does not require a new agent. Keep one writer per worktree and return unresolved decisions to the caller.
