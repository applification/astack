# Domain language

Use this when a change introduces a domain concept, exposes ambiguous terminology, or changes what an existing term means. Keep the selected work route: domain modeling supports intent, implementation and review rather than adding another delivery route. A routine fix using settled terms needs no separate modeling session.

## Find the language in use

Read the project's existing glossary, relevant decision history, affected code and concrete user cases. Reuse its authoritative location and format, including paths recorded in `.astack/project.md`. When a root `GLOSSARY-MAP.md` exists, follow it to the relevant context's glossary and decisions. The same word may have different meanings in different contexts; preserve those boundaries and describe their relationship only when this work needs it. Ask about the context when the sources cannot resolve a material ambiguity.

Without an established home, use root `GLOSSARY.md` for the first agreed project term. Create it when that term is resolved, not as an empty setup artifact. Introduce a map and separate context glossaries only when actual distinct contexts justify them. Do not require a glossary for every repository or every PR.

## Sharpen meaning while working

Treat the glossary as an active source of shared meaning. When a request uses a term inconsistently, name the ambiguity and propose precise alternatives. Check relationships with concrete scenarios: can one reservation cover several guests, can a guest have several reservations, and what remains after cancellation? Choose questions that affect this change; do not interrogate every familiar word.

Compare the stated meaning with the implementation. A contradiction may indicate a defect, an outdated definition or an unresolved product choice. Surface the discrepancy with source evidence and a distinguishing acceptance case. Do not silently rewrite the glossary to legitimize existing code, or change behavior merely to make a definition true. Resolve material choices with the owner while continuing independent work.

Within authorized repository work, record an agreed definition promptly and reconcile affected acceptance cases and documentation. Keep tentative meanings and blocked choices in the task or behavior contract until resolved. A read-only investigation reports discrepancies without editing files. Terminology agreement does not authorize a broad code rename, migration or change to external contracts; keep implementation within the agreed scope and prove any changed consumers under the selected route.

## Record definitions, behavior and decisions in their own homes

| Information | Home |
| --- | --- |
| Agreed domain terms and relationships | Existing glossary, or `GLOSSARY.md` when first needed |
| Intended observable behavior, acceptance cases and open product choices | Behavior contract, task or PR according to change size |
| Consequential choice and its rationale | Existing decision register or ADR location |
| Implementation procedures and operational detail | Relevant code or project documentation |

Keep glossary entries short and specific to the project's domain. Give the canonical term, its meaning and any relationships needed to distinguish it. Mark confusing alternatives when useful; do not fill the file with generic programming vocabulary, retry policies or speculative entities. Link the glossary from feature contracts rather than maintaining competing definitions there.

For example, after agreement in a booking project:

```markdown
# Booking language

## Terms

**Reservation**: An agreement to hold places for named guests on one scheduled visit.
Avoid using “visit” for this agreement.

**Visit**: One scheduled occasion that reservations refer to. Cancelling a reservation
does not cancel the visit.
```

Those definitions do not specify storage, endpoints or all cancellation behavior. Acceptance cases establish the relevant behavior separately.

Record an ADR when a real choice involves a meaningful reversal cost, a non-obvious tradeoff and rationale future maintainers will need. Follow the project's numbering, format and status policy. Without an existing home, create `docs/adr/NNNN-short-name.md` lazily for the first such decision, with concise context, decision and rationale; add alternatives or consequences only when useful. Routine reversible implementation choices need no ADR. Preserve asset and feature evidence locations described by the behavior contract.

## Review the result

Before a PR, check the affected request, glossary, code names, contract and explanation for inconsistent meanings. Account for residual naming drift or unresolved choices instead of claiming complete alignment. Link relevant glossary or decision changes in the PR when they help review. Definitions and diagrams explain the intended model; observed checks establish whether the implementation meets its acceptance cases.
