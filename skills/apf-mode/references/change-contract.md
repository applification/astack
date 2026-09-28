# Change contract

Use for substantial behavior changes and design sprints. The contract states what should happen; the proof plan states how this change will demonstrate it. Do not require Example Mapping, Gherkin, tickets, or a full story map.

Draft this in the task, keeping it short:

```markdown
## Outcome
Who can do what, and why it matters.

## Acceptance
A1. Given a meaningful starting state, when the actor does something,
    then an observable result occurs.
A2. Given an important boundary or failure, when ..., then ... .

## Scope
Affected entry points and surfaces; material exclusions.

## Open decisions
Product choices that cannot be settled from the design or code.
```

Use a few cases that distinguish success from plausible wrong behavior. Include cancellation, authorization, persistence, error handling, or accessibility only when material to this change. Give each case a stable ID within the change so tests, proof results, and review can refer to it. Do not turn every UI state into a separate requirement.

For a design sprint, link the chosen design and relevant Storybook states. Capture interactions and data effects that a static frame cannot express. A presentation prototype may inform the contract, but its fake state does not prove production behavior.

Resolve decisions that change the intended result before implementing them. If learning changes acceptance, update the contract explicitly and tell the user when the choice is theirs. The contract is allowed to evolve; it must not drift silently to match the implementation.

The current task can hold a short working contract. For multi-session work before a PR, put it in the project's existing issue or another durable location named in `.astack/project.md`. Once a PR exists, its description carries the agreed contract and the proof result for the exact revision. Keep enduring domain concepts in project documentation when useful; do not create a permanent per-change spec archive by default.
