# Evaluation review flow

The owner wants a readable account of the agent's work and a simple way to judge the result. Preserve Original intent. Show a result summary, a chronological timeline of linked captured requests/responses, expandable checks, and outcome feedback. Technical traces and detailed assessments remain available through disclosures.

- U1: Existing evaluations show chronological turns with readable headings, captured request/response excerpts and trace links. Excerpts are current captured evidence, not inferred phases or hidden reasoning. Missing or withheld content has an explicit fallback. Run completion never means the engineering outcome passed.
- U2: Checks show expected behavior and actual observations, preserving failure, missing proof, flaky attempts and technical artifact references. Keep the previous detailed assessment/history available without making it the default review.
- U3: The authenticated owner can answer Yes, Partly, No or Not sure yet and optionally comment. Save an immutable, idempotent feedback record tied to this evaluation; reload shows it. Feedback creates no intent/skill grades or proof certification. Reject anonymous writes and changed reuse of a request ID. Failed writes retain the draft.
- U4: The primary page, expanded evidence and review controls work at desktop and 390px widths in light/dark themes. Existing original-request deep links still open the exact trace event.

Design: use the owner's accepted HTML proposal as the visual specification, with Observatory's existing tokens and navigation. Pen is skipped because the selected direction is already reviewable in that proposal; a second design artifact would not resolve another choice. Storybook is selected for success/failure/missing-content states, feedback interactions and responsive inspection. Native Convex tests and an authenticated local browser prove persisted feedback separately. Otis update continues the earlier authorized review deployment; no merge.

Validation: domain/backend regressions for U1/U3; production component stories and deterministic browser checks for U1/U2/U4; local save/reload for U3; live Otis read-only journey and exact served-build check after rollout. Retain synthetic screenshots only. Inspect first failures and report them with their disposition.

## Result

U1–U4 pass on the delivered product sources at `bb4061e2bacc3dc0d23c8783de9e6347250fc635`. Strict types, UI lint, 87 unit/integration checks, nine final component browser cases, three persisted local browser cases and six live Otis journeys pass. An earlier full component suite passed all 27 cases; the final focused run covers the presentation polish. The screenshot helper subsequently received a type-only correction after CI rejected its undefined return; the corrected revision passed full CI, including all 27 component browser cases. [Proof index](evidence/ux-review.json) retains the run identities and first-failure dispositions.

The Convex reviewer checklist passed: owner auth and current capture policy, indexed bounded reads, additive schema, immutable feedback retries and separate grades. The Otis backend was pushed before the UI; served HTML, JS and CSS match the build. The actual review has three readable headings, three request excerpts and three response excerpts. Anonymous review writes and wrong-project reads are denied. Deployment added no owner feedback or assessment.

Synthetic component captures show the [timeline](evidence/ux-timeline-light.png), [outcome review](evidence/ux-outcome-review.png) and [expanded checks at phone width in dark mode](evidence/ux-checks-narrow-dark.png). The timeline uses recorded turns and bounded excerpts, with full traces available; phase classification and branch graphs remain outside this slice.
