# Architecture decisions

Read accepted decisions relevant to a change before implementing it. Decisions are separate from implementation and proof status. Routine fixes following a decision need no new ADR. A material reversal creates a replacement record with reciprocal supersession links.

| ID                                                     | Decision                                                               | Status   | Scope                                    |
| ------------------------------------------------------ | ---------------------------------------------------------------------- | -------- | ---------------------------------------- |
| [0001](0001-foundation-profile.md)                     | Vite, Convex, MCP and WorkOS core reference                            | accepted | New interactive foundation               |
| [0002](0002-data-forms-and-verification.md)            | Explicit data, forms and verification ownership                        | accepted | Foundation reference                     |
| [0003](0003-compiler-and-lint.md)                      | TypeScript 7 compiler with compatible typed ESLint                     | accepted | Foundation reference                     |
| [0004](0004-local-development-and-cloud-transition.md) | Persistent local development first; cloud transition initiated by user | accepted | New apps and requested cloud transitions |
| [0005](0005-authentication-proof-hierarchy.md) | Emulate for local/CI; disposable Staging users; explicit manual and installed-host acceptance | accepted | Auth testing |
| [0006](0006-composable-engineering-skills.md) | Independently callable engineering skills composed by astack | accepted | Plugin skills and delivery |

Owner confirmation: this chat on 4 October 2026 establishes the core profile and delegates selection of supported platform patterns. The implementation choices below apply that instruction. Existing products preserve their own accepted stack and policy. Future records use the next number and `proposed`, `accepted`, `rejected`, `deprecated` or `superseded` status. The owner reviews decisions through the PR; agents do not weaken their own judging policy.
