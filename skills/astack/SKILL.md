---
name: astack
description: Select an engineering playbook for a task and run its steps with focused skills, project checks and configured model roles.
metadata:
  short-description: "Run engineering playbooks with project model choices"
---

# astack

Read the task, project instructions, `.astack/models.json` and optional `.astack/project.md`. The user supplies the outcome and a finish condition; choose the playbook rather than asking them to name skills. Honour fixed technology choices. Compare open choices against product constraints. Settle observable questions by running things; ask only about unresolved product or preference decisions. Preserve scope, authority and the existing PR.

## Choose a playbook

A playbook is an ordered task procedure that composes skills and names the model role for each contribution. Read the chosen file and put its steps in the plan before implementation. Keep omissions visible with reasons; small tasks need no extra artifacts. A new task rematches; a follow-up continues the current work.

| Task | Playbook |
| --- | --- |
| New or changed behavior | [feature](playbooks/feature.md) |
| Reported defect | [bug fix](playbooks/bug-fix.md) |
| Structure change with behavior preserved | [refactor](playbooks/refactor.md) |
| Measured slowness | [performance](playbooks/performance.md) |
| Read-only question | [investigation](playbooks/investigation.md) |
| Assess a diff or fix its findings | [review](playbooks/review.md) |
| Repair or add a product-driving capability | [app control](playbooks/app-control.md) |
| Empty repo or first working milestone | [new project](playbooks/new-project.md) |

For model preferences use [setup-astack](../setup-astack/SKILL.md). It configures the agent; it does not scaffold an application. Use [role orchestration](references/orchestration.md) for model resolution and delegation. Missing setup inherits the current session. Load only the skills and project-owned platform guidance the selected steps need.

## Apply principles where they matter

Read the relevant leaf in full at its decision. Principles guide judgment; the project's compiler, lint rules and behavior checks enforce concrete invariants.

| Decision | Principle |
| --- | --- |
| Typed states or signatures | [type system discipline](../principle-type-system-discipline/SKILL.md) |
| Validation or external adapters | [boundary discipline](../principle-boundary-discipline/SKILL.md) |
| Preventing a demonstrated repeated mistake | [encode lessons in structure](../principle-encode-lessons-in-structure/SKILL.md) |
| Claiming the outcome works | [prove it works](../principle-prove-it-works/SKILL.md) |
| Designing assertions | [test behavior](../principle-test-behavior-not-implementation/SKILL.md) |
| Diagnosing a defect | [fix root causes](../principle-fix-root-causes/SKILL.md) |
| Ordering a multi-step change | [sequence verifiable units](../principle-sequence-verifiable-units/SKILL.md) |

For repeated agent corrections, use [correct](../correct/SKILL.md) to add demonstrated safeguards in the consuming project and prove bad/valid cases with its existing tools. Keep commands and any enforcement table in project guidance; astack's `lint/` validates its own package, not the application's architecture.

Carry the task through its selected finish condition. Report actual revision, observations and gaps; resolve findings before claiming completion. Read-only work ends with an answer. Kept changes follow the project's delivery policy and [PR guidance](../pr/SKILL.md). Builds, routing examples and saved model preferences alone do not establish agent delivery.
