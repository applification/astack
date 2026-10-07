---
name: astack
description: Route an engineering request to project setup, delivery, investigation or review, composing focused skills and applicable principle leaves through the requested outcome.
metadata:
  short-description: "Coordinate engineering work from intent to proof"
---

# astack

Treat the prompt after `$applification:astack` as the task; ask for it when none is supplied. The user describes the outcome; you select and compose the work rather than asking them to choose skill names. Read project instructions, `.astack/project.md` when present, affected source and existing proof commands. Confirm the intended outcome when ambiguity matters; ask about material product choices while continuing independent work. Preserve user choices, scope, authority and the existing PR. An ordinary feature or fix uses the established stack; a setup/upgrade request can improve it through project-setup. A small fix can keep intent and proof in the conversation and PR.

## Compose only useful expertise

Choose the workflow for the outcome: [implement](../implement/SKILL.md) for changed behavior, [bug-fix](../bug-fix/SKILL.md) for a defect, [refactor](../refactor/SKILL.md) for structure with behavior held steady, [performance](../performance/SKILL.md) for measured slowness, [investigate](../investigate/SKILL.md) for a read-only question, or [pr](../pr/SKILL.md) for review/publication.

At the start of substantive work, state the chosen route and a short reason tied to the user's requested outcome. Carry a useful phase plan through the task. When Observatory and trusted captured session/turn identities are available, record that selection and meaningful phase transitions using [Observatory context](references/observatory.md). Attach actual trace references and the skills applied at each phase; distinguish declarations from supporting observations. Preserve retries, reasons for material omissions and changes of route. A different reasonable composition can satisfy the task; do not optimize for a fixed skill sequence or a count of completed phases.

Apply technical guidance at the affected boundary: [TypeScript](../typescript-best-practices/SKILL.md), [React](../react/SKILL.md), [Convex](../convex/SKILL.md), [WorkOS authentication](../workos-auth/SKILL.md), [MCP server](../mcp-server/SKILL.md), [ChatGPT plugin](../chatgpt-plugin/SKILL.md), or [testing](../testing/SKILL.md) when building or repairing checks. Read its relevant examples, not the entire collection. Each skill is useful directly and owns its engineering knowledge; none requires re-entering this coordinator.

Use [domain-modeling](../domain-modeling/SKILL.md) when concepts need resolving and [show-me](../show-me/SKILL.md) when a view helps explain a shape or choice. [web-feature](../web-feature/SKILL.md) owns the design-to-product workflow and separate Pencil/Storybook decisions. Use [project-setup](../project-setup/SKILL.md) to establish a new project or integrate/upgrade an existing project toward astack's runtime and verification loop. Use [app-control](../app-control/SKILL.md) for a bounded control-tool change and [cloud-transition](../cloud-transition/SKILL.md) for an owner-chosen hosting transition.

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

TypeScript and platform skills supply concrete implementation guidance alongside these language-independent principles. A principle invocation returns the applied decision or assessment to its caller; it does not start an unrelated delivery workflow.

## Carry the work to its outcome

Carry outcome, scope, acceptance, authority and completed observations between selected skills. For multi-step work, keep a concise plan of useful phases and checkable finish conditions, with reasons for material omissions. On resumption, inspect the current checkout and retained decisions, verify inherited claims that matter and continue from the next incomplete phase. For work the user will review later, retain important decisions with their reasons and evidence in the task record; use host scheduling only when future wakeups are requested. Reuse a completed phase; composition does not require another agent. Resolve findings against intent and source, recheck affected behavior, and use [verify](../verify/SKILL.md) to consolidate actual observations and gaps. Finish kept work through pr in the owner-selected PR; coherent slices can be commits there. A read-only task ends with its source-grounded answer. Missing required proof keeps delivery partial/draft; an unresolved decision names its owner and resumption condition. Builds and routing examples establish only what they actually checked.

## When work is delegated or arrives from a COS

For actual delegation, use [specialist contributions](references/specialists.md) to bound the question, context, actions, proof and escalation. Keep one writer per worktree; assess returned findings before integrating. Without delegation, apply the selected expertise sequentially and disclose self-review where independence matters.

Use [portable handoffs](references/handoffs.md) and [examples](references/handoff-examples.md) for delegated briefs or COS assignments/results. Preserve supplied work/attempt identities, revision/environment, authority and execution limits. Ordinary direct requests need no separate contract record or role roster. astack owns the engineering method and handoff meanings; the external COS host owns durable records, priorities, dispatch, deduplication and follow-up. Skill selection does not grant messaging, merge, release or destructive-action authority.

## Agent feedback when Observatory is installed

Use [Observatory context](references/observatory.md) for stable work/session correlation and explicit workflow/outcome annotations. Automatic capture is independent of this method; telemetry must never block delivery. Keep external work ownership and capture provenance intact when using observed behavior to improve the harness.

For substantive tasks with readable capture, use the [automatic evaluation handoff](references/observatory.md#automatic-task-evaluations): record criteria at task start, preserve its task ID across follow-ups, and queue the evaluation at delivery. The user does not need to request or author the review record.
