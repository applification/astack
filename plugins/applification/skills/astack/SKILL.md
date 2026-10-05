---
name: astack
description: Coordinate an engineering task from intent through implementation, proportional verification and review using astack's focused skills.
metadata:
  short-description: "Coordinate engineering work from intent to proof"
---

# astack

Treat the prompt after `$applification:astack` as the engineering task. Select a route and carry it to a checkable result with the least process that protects it. If no task is supplied, ask what the user wants done. User instructions and established project constraints take precedence.

## Choose the delivery route

| Request | Route |
| --- | --- |
| New or changed user behavior | Feature |
| Reported defect | Bug fix |
| Internal structure with behavior held steady | Refactor |
| Measured slowness | Performance |
| Read-only question or recommendation | Investigation |
| Existing change headed for review | Pull request |
| Make a running app controllable for verification, or repair its control route | App control |

Apply the owning delivery skill: [implement](../implement/SKILL.md), [bug-fix](../bug-fix/SKILL.md), [refactor](../refactor/SKILL.md), [performance](../performance/SKILL.md), [investigate](../investigate/SKILL.md), [pr](../pr/SKILL.md) or [app-control](../app-control/SKILL.md). The [route index](references/routes.md) records this mapping. If none fits, state a task-specific outcome and way to check it. Routes describe the intended engineering outcome; the skills below perform reusable jobs within a route.

## Compose the work

Read project instructions and `.astack/project.md` when commands or policy are needed. Inspect source and affected consumers, clarify material acceptance cases, and use the [behavior contract](references/behavior-contract.md) for substantial changes. Small fixes can keep their outcome and proof in the task and PR. When a product choice is unresolved, ask a targeted question and continue independent work.

Use the focused skill that owns the next useful job. Each can also be invoked directly without this coordinator:

| Job | Skill |
| --- | --- |
| Explain the current topic, code shape or choice visually | [$applification:show-me](../show-me/SKILL.md) |
| Resolve concepts and record agreed domain language | [$applification:domain-modeling](../domain-modeling/SKILL.md) |
| Establish a new project or adopt astack | [$applification:project-setup](../project-setup/SKILL.md) |
| Build or repair product driving and its feature map | [$applification:app-control](../app-control/SKILL.md) |
| Select, run and interpret proof for the affected behavior | [$applification:verify](../verify/SKILL.md) |
| Review a change or prepare/update its PR | [$applification:pr](../pr/SKILL.md) |

Read and apply the selected delivery skill and the capability skills it needs, including only relevant supporting references. Carry the original outcome, scope, acceptance, authority, revision and completed phase results between them. Reuse a completed result rather than restarting the same phase. Passing work to another skill does not require spawning an agent. When delegation is available, permitted and useful, give a bounded assignment with source, intended result, scope, acceptance, authority and revision/environment. Use one writer per worktree; assess returned findings and proof before integrating. Without delegation, apply the selected skills sequentially and disclose when review is not independent. The coordinator remains responsible for resolving findings and the consolidated result.

Implement coherent slices, use fast feedback, and return to intent when evidence changes a material assumption. Use verify for affected checks and observed outcomes; invoke pr for kept changes. Read-only investigations end with an answer. A direct focused skill invocation finishes its own requested job, without starting unrelated phases or calling astack recursively.

## Specialist contributions and handoffs

Keep the chosen route and one delivery lead. Select expertise by affected behavior, trust boundaries and uncertainty using [specialist guidance](references/specialists.md); a small fix can stay with the lead. Read the selected role rows, not every linked platform guide. Delegate bounded contributions when available and permitted; otherwise apply the guidance yourself and disclose missing independent review. Assign one writer per worktree, and keep shared-contract ownership explicit.

Use [portable handoffs](references/handoffs.md) for COS assignments, specialist briefs and consolidated results. Preserve the caller's work identity, evidence, acceptance, authority and limits. A small direct request can carry these in the conversation and PR without another file. Distinguish completed engineering work, partial/draft results and blocked decisions. astack defines the method and handoffs; the external COS host owns durable records, prioritisation, dispatch, deduplication and follow-up.

## Select platform skills only when needed

- For web UI work, use [$applification:web-feature](../web-feature/SKILL.md) to decide separately whether Pencil and Storybook help, and [shadcn lint](references/shadcn-lint.md) when applicable.
- For persistent web/MCP products, the [foundation profile](references/foundation.md) provides the worked reference. New apps start locally; the user chooses hosting. Follow [$applification:cloud-transition](../cloud-transition/SKILL.md) for an authorized hosting request.
- For Convex, follow [database guidance](references/database.md), use the companion expert before backend edits, and complete the Convex reviewer pass required by pr.
- For MCP server changes, use [$applification:mcp-server](../mcp-server/SKILL.md). For ChatGPT plugin UI, packaging, extensions or events, use [$applification:chatgpt-plugin](../chatgpt-plugin/SKILL.md) and its selected compatibility/host references.

Existing projects keep their working stack and package manager unless migration is requested. The new-project defaults belong to project-setup. Acceptance is observable behavior, not whatever checks happen to pass. Keep proof revision/environment and failed, partial or untested claims visible. Routing examples and builds do not establish observed delivery.

Preserve the owner-selected PR as the delivery target when scope evolves. Coherent implementation slices can be separate commits in that PR; they do not by themselves justify another PR. Finish kept changes in that existing PR, or create one when no target exists, draft when required work is blocked. Check the publication target early and resolve missing prerequisites while independent work continues. Skill composition does not expand authority: merges, releases, destructive changes and external messages follow the owner's authorization and project policy.
