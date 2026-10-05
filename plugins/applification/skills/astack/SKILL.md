---
name: astack
description: Coordinate an engineering request from intent through implementation, proportional verification and review by composing focused Applification skills.
metadata:
  short-description: "Coordinate engineering work from intent to proof"
---

# astack

Treat the prompt after `$applification:astack` as the task. Read project instructions, affected source and existing proof commands. Confirm the intended outcome when ambiguity matters; ask about material product choices while continuing independent work. Preserve the user's stack, scope, authority and existing PR. A small fix can keep intent and proof in the conversation and PR.

## Compose only useful expertise

Choose the workflow for the outcome: [implement](../implement/SKILL.md) for changed behavior, [bug-fix](../bug-fix/SKILL.md) for a defect, [refactor](../refactor/SKILL.md) for structure with behavior held steady, [performance](../performance/SKILL.md) for measured slowness, [investigate](../investigate/SKILL.md) for a read-only question, or [pr](../pr/SKILL.md) for review/publication.

Apply technical guidance at the affected boundary: [TypeScript](../typescript-best-practices/SKILL.md), [React](../react/SKILL.md), [Convex](../convex/SKILL.md), [WorkOS authentication](../workos-auth/SKILL.md), [MCP server](../mcp-server/SKILL.md), [ChatGPT plugin](../chatgpt-plugin/SKILL.md), or [testing](../testing/SKILL.md) when building or repairing checks. Read its relevant examples, not the entire collection. Each skill is useful directly and owns its engineering knowledge; none requires re-entering this coordinator.

Use [domain-modeling](../domain-modeling/SKILL.md) when concepts need resolving and [show-me](../show-me/SKILL.md) when a view helps explain a shape or choice. [web-feature](../web-feature/SKILL.md) owns the design-to-product workflow and separate Pencil/Storybook decisions. Use [project-setup](../project-setup/SKILL.md) for setup/adoption, [app-control](../app-control/SKILL.md) for repeatable product driving, and [cloud-transition](../cloud-transition/SKILL.md) only for an owner-chosen hosting transition.

Carry outcome, scope, acceptance, authority and completed observations between selected skills. Reuse a completed phase; composition does not require another agent. Resolve findings against intent and source, recheck affected behavior, and use [verify](../verify/SKILL.md) to consolidate actual observations and gaps. Finish kept work through pr in the owner-selected PR; coherent slices can be commits there. A read-only task ends with its source-grounded answer. Missing required proof keeps delivery partial/draft; an unresolved decision names its owner and resumption condition. Builds and routing examples establish only what they actually checked.

## When work is delegated or arrives from a COS

For actual delegation, use [specialist contributions](references/specialists.md) to bound the question, context, actions, proof and escalation. Keep one writer per worktree; assess returned findings before integrating. Without delegation, apply the selected expertise sequentially and disclose self-review where independence matters.

Use [portable handoffs](references/handoffs.md) and [examples](references/handoff-examples.md) for delegated briefs or COS assignments/results. Preserve supplied work/attempt identities, revision/environment, authority and execution limits. Ordinary direct requests need no separate contract record or role roster. astack owns the engineering method and handoff meanings; the external COS host owns durable records, priorities, dispatch, deduplication and follow-up. Skill selection does not grant messaging, merge, release or destructive-action authority.
