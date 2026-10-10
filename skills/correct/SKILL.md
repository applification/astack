---
name: correct
description: Improve the agent's codebase environment with deterministic tooling and checks that prevent demonstrated mistakes, while preserving application source and behavior.
license: MIT
metadata:
  short-description: "Improve the agent environment with proven checks"
---

# Improve the agent's environment

Change only the environment in which the agent works: project tooling, lint/compiler configuration, structural checks, verification tools, hooks and CI. Make the intended development path obvious and mechanically enforce it. Preserve application source and runtime behavior; application fixes, refactors, types, schemas and runtime helpers belong to separately requested work.

Read project instructions, relevant conversations, corrections, failing observations, reverts, review findings and existing check commands. Ground each change in a demonstrated mistake or missing enforcement of an explicit project invariant. Group repeats by mechanism; distinguish a single gap from a recurring class. Use [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md) to choose enforcement within this environment-only remit.

Prefer the project's existing tools: strengthen or wire an existing check before adding one. Use deterministic lint/compiler rules, import/API or filesystem checks, check-runner improvements and regression checks for the named invariant. Diagnostics should identify the rejected pattern and supported alternative. Guidance may explain the enforcing command; reminders alone do not complete this task. Preserve the selected stack and host configuration.

For each retained guard, reproduce the bad contribution in a disposable fixture or use a preserved failing revision. Observe its rejection, then run the same guard on a valid case and valid neighbors. Verify application source is unchanged. If the current application violates the proposed rule, report that prerequisite for separate work; do not repair production code, disable checks or hide violations to get a passing baseline.

Wire retained checks into local verification and CI. Record the evidence, environment change, enforcing command, negative/positive results and remaining coverage in the existing task record or [rule table](references/rule-table.md). Put project enforcement in the project; change reusable skills only for lessons that apply across projects.

Return the deterministic environment improvements and observed coverage. Report application defects and judgment-only findings separately. If no justified deterministic improvement is available, return findings rather than substitute product changes. Kept changes follow the project's delivery policy; investigations may end with findings.

[Source and adaptations](upstream.json); [MIT licence](LICENSE).
