---
name: astack
description: Route an engineering request to project setup, delivery, investigation or review, composing focused skills and applicable principle leaves through the requested outcome.
metadata:
  short-description: "Coordinate engineering work from intent to proof"
---

# astack

Treat the prompt after `$applification:astack` as the task; ask for it when none is supplied. The user describes the outcome; you select and compose the work rather than asking them to choose skill names. Read project instructions, `.astack/project.md` when present, affected source and existing proof commands. Honour fixed technology choices. Compare open choices against product constraints, recommend a choice or decide within delegated authority, and settle observable questions by running things. Ask only about unresolved product or preference decisions while continuing independent work. Preserve scope, authority and the existing PR. A small fix can keep intent and proof in the conversation and PR.

Apply [main-thread orchestration](references/orchestration.md): the main agent owns the request through integration and verification; children return bounded contributions. This default also applies to standalone sessions and direct skill invocation. Delegate only when useful, through the actual host's available mechanism.

## Compose only useful expertise

Choose the workflow for the outcome: [implement](../implement/SKILL.md) for changed behavior, [bug-fix](../bug-fix/SKILL.md) for a defect, [refactor](../refactor/SKILL.md) for structure with behavior held steady, [performance](../performance/SKILL.md) for measured slowness, [investigate](../investigate/SKILL.md) for a read-only question, or [pr](../pr/SKILL.md) for review/publication.

Use the consuming project's selected platform skills and version-matched documentation for technical implementation. astack supplies engineering method; the project owns language, framework, provider, compiler and lint configuration. Load only guidance relevant to the changed boundary. Use [testing](../testing/SKILL.md) when building or repairing checks. Each core skill also works directly.

Use [architect](../architect/SKILL.md) before committing to a consequential interface, persisted shape, lifecycle or abstraction. Use [code-review](../code-review/SKILL.md) for a concrete quality assessment, with a fresh pass for changed identity/authorization, persisted compatibility, concurrency or shared lifecycle. Use [correct](../correct/SKILL.md) to close demonstrated recurring mistakes with safeguards, and [agent-evaluation](../agent-evaluation/SKILL.md) for a controlled experiment about agent or skill effectiveness. These are focused contributions within the owning route; settled small changes need no extra phase or artifact.

Use [domain-modeling](../domain-modeling/SKILL.md) when concepts need resolving and [show-me](../show-me/SKILL.md) when a view helps explain a shape or choice. Use [project-setup](../project-setup/SKILL.md) to establish the smallest verified milestone or integrate an agreed project upgrade. Use [app-control](../app-control/SKILL.md) for a bounded control-tool change and [cloud-transition](../cloud-transition/SKILL.md) for an owner-chosen hosting transition.

Use the current conversation to resolve follow-ups such as “do it” or “continue”. An explicit new task or changed outcome rematches the work; a status question does not replace the active objective. For a mixed request, combine the useful skills in dependency order and carry one outcome and proof record. When no single route fits, compose a bounded plan from the owned skills and actual project tools; do not force the task into a mismatched route. Missing `.astack/project.md` alone does not initiate setup or block a narrow task. A direct skill invocation completes its own job and can use the same leaves without re-entering astack.

## Apply principles at the decision

Read an applicable leaf in full before applying it. The index supplies triggers; the leaf owns the discipline. A user can name a principle to steer a decision; explain the concrete choice it changed when that helps assess the result rather than merely listing names. Select only principles that affect the current task, whether coordinating or using a focused skill directly.

| When making this decision | Leaf skill |
| --- | --- |
| Designing types, state variants or a typed function signature | [principle-type-system-discipline](../principle-type-system-discipline/SKILL.md) |
| Wiring validation, error handling or framework/protocol adapters | [principle-boundary-discipline](../principle-boundary-discipline/SKILL.md) |
| Repairing a recurring failure or choosing how to enforce an invariant | [principle-encode-lessons-in-structure](../principle-encode-lessons-in-structure/SKILL.md) |
| Reporting that a requested outcome works | [principle-prove-it-works](../principle-prove-it-works/SKILL.md) |
| Designing or reviewing assertions | [principle-test-behavior-not-implementation](../principle-test-behavior-not-implementation/SKILL.md) |
| Diagnosing and repairing a reported defect | [principle-fix-root-causes](../principle-fix-root-causes/SKILL.md) |
| Sequencing a multi-step change or migration | [principle-sequence-verifiable-units](../principle-sequence-verifiable-units/SKILL.md) |

Project-owned technology guidance supplies concrete implementation details alongside these language-independent principles. A principle invocation returns the applied decision or assessment to its caller; it does not start an unrelated delivery workflow.

## Carry the work to its outcome

Carry outcome, scope, acceptance, authority and completed observations between selected skills. For multi-step work, keep a concise plan of useful phases and checkable finish conditions, with reasons for material omissions. On resumption, inspect the current checkout and retained decisions, verify inherited claims that matter and continue from the next incomplete phase. For work the user will review later, retain important decisions with their reasons and evidence in the task record; use host scheduling only when future wakeups are requested. Reuse a completed phase; composition does not require another agent. Resolve findings against intent and source, recheck affected behavior, and use [verify](../verify/SKILL.md) to consolidate actual observations and gaps. Finish kept work through pr in the owner-selected PR; coherent slices can be commits there. A read-only task ends with its source-grounded answer. Missing required proof keeps delivery partial/draft; an unresolved decision names its owner and resumption condition. Builds and routing examples establish only what they actually checked.

## When work is delegated or arrives from a COS

For actual delegation, use [specialist contributions](references/specialists.md) to bound the question, context, actions, proof and escalation. Keep one writer per worktree; assess returned findings before integrating. Without delegation, apply the selected expertise sequentially and disclose self-review where independence matters.

Use [portable handoffs](references/handoffs.md) and [examples](references/handoff-examples.md) for delegated briefs or COS assignments/results. Preserve supplied work/attempt identities, revision/environment, authority and execution limits. Ordinary direct requests need no separate contract record or role roster. astack owns the engineering method and handoff meanings; the external COS host owns durable records, priorities, dispatch, deduplication and follow-up. Skill selection does not grant messaging, merge, release or destructive-action authority.
