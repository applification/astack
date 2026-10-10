---
name: pr
description: Review an existing change or prepare and update its pull request with intent, quality, useful explanations and observed proof.
metadata:
  short-description: "Review changes and prepare a PR with useful evidence"
---

# PR and review

Read the request, project instructions, current diff, existing PR and available proof. Carry the owner-selected PR through revisions. Read-only investigation needs no publication; kept repository changes finish in a PR when authorized by the task and project.

Review intent and quality separately:

- Does the change deliver the requested behavior without material scope additions?
- Does it preserve invariants, ownership and consumer compatibility with a simple structure and meaningful tests?

Apply [code-review](../code-review/SKILL.md) for quality. Trace indirect consumers of changed contracts, persisted shapes, events and lifecycles. Use the consuming project's platform guidance and required reviews. An independent reviewer is useful when risk or breadth justifies it and delegation is permitted; the lead adjudicates findings against source and behavior.

Fix confirmed defects, rerun affected checks and keep unresolved acceptance or required review gaps visible in a draft. Follow the project's actual CI and merge policy. Review evidence belongs to the assessed revision.

Write a brief description: the problem and resulting behavior, consequential choices, affected consumers, observed validation with revision/environment, and remaining gaps. Link an existing [behavior contract](../implement/references/behavior-contract.md) when useful; small changes need no separate file. Keep domain terms consistent with the project's agreed definitions.

## Show the change

Use [show-me](../show-me/SKILL.md) and [explanation delivery](references/explanation-delivery.md) when a diagram clarifies ownership or behavior. Illustrations explain the design; observations establish proof. Attach useful captures or link approved retained evidence according to the project's policy. Keep raw run records out of source commits.

Confirm the posted description and links are readable and current. Report the PR, outcome, actual checks and material limits to the caller. astack does not itself grant merge, release or messaging authority.
