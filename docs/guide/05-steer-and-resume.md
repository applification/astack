# Steer and resume

Principle names are useful shorthand for a concrete engineering decision. The coordinator has a trigger index; each `principle-*` skill owns the full discipline and is callable directly.

| When steering this decision | Principle |
| --- | --- |
| Contradictory state combinations or an unsafe signature | `principle-type-system-discipline` |
| Validation and business logic scattered across adapters | `principle-boundary-discipline` |
| A recurring mistake answered with another reminder | `principle-encode-lessons-in-structure` |
| Completion claimed from a build or another proxy | `principle-prove-it-works` |
| A test that cannot distinguish the named defect | `principle-test-behavior-not-implementation` |
| A symptom hidden without a supported diagnosis | `principle-fix-root-causes` |
| A migration building on an unexplained failed slice | `principle-sequence-verifiable-units` |

For example:

```text
Apply prove it works: run the export and inspect the actual rows it wrote.
```

```text
$applification:principle-boundary-discipline Review where this adapter parses external input into domain values.
```

The relevant leaf must be read before it is applied. Ask what decision the principle changed; a list of names alone tells you little.

For work you will review later, leave a checkable goal, scope, authority and finish condition:

```text
$applification:astack Continue the parser migration on this branch. Done means the named fixtures pass and the scoped callers use the new API. Keep decisions and evidence in the task record. Open the PR; I will review it before merge.
```

Keep important decisions with reasons, evidence and the next incomplete phase. On resumption, inspect the current checkout and record, verify inherited claims that matter and continue without repeating finished phases. When later wakeups are needed, request the host's scheduling explicitly.

Review the output against the original finish condition. A missing prerequisite remains visible; the agent must not relax acceptance to report completion. Meaningful lessons belong in a scoped structural fix or project guidance. Test skill changes with realistic tasks and inspect actual reads, actions and artifacts; frontmatter checks and routing examples alone do not establish agent behavior.

Back to the [guide index](README.md).
