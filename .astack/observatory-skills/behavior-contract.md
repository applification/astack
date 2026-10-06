# Observatory skill badges and recorded sequence

The owner wants to see which astack skills contributed to the work and follow their use through the flow. Promote declared skills from secondary text to icon-and-name controls. Keep outcome checks and owner judgments separate from skill identity.

## Accepted behavior

- S1: Work phases show prominent skill badges, including a GitHub mark for PR, a shield for Verify, and a flask for Testing. Known namespaced skills have readable labels; unknown skills retain their name and a neutral book icon.
- S2: A separate Skill sequence view follows recorded phase order, preserves retries and route changes, and groups skills declared together without inventing order within the group. Omissions, unfinished phases and phases with no declarations remain explicit.
- S3: A phase badge opens only declarations that include that skill in that attempt, with phase status, recorded name and existing trace references. A flow badge shows its declaration history across attempts. Unavailable evidence stays explicit. Close restores focus to the activating badge.
- S4: Switching views preserves the selected evidence and does not change capture or assign grades. The actual persisted Otis evaluation supports both views and trace navigation.
- S5: Desktop/light and narrow/dark views stay readable without page overflow, including long custom skill names.

## Design and boundaries

The approved interactive HTML concept established the badge and grouped sequence direction before implementation. Pen is not selected for this incremental extension of the existing design system; its separate layout document would duplicate the approved concept. Storybook is selected for repeatable retry, route-change, missing evidence, custom-name, omission and narrow-layout states.

Only presentation and local selection state change. Existing workflow records and their ordering/pairing remain authoritative; no backend schema, capture behavior, skill invocation order, historical hashes or grades are inferred. A declaration in an omitted phase stays visible as an omitted declaration. Icons identify skills, never a passing verdict. Supporting links describe the recorded phase rather than uniquely attributed skill execution.

Verification results and selected synthetic screenshots are retained in `evidence/`. Live authentication uses the owner's existing private key through the project runner; private screenshots and keys are not retained here.

## Observed proof

UI revision `3e29104` passes strict types, UI lint, site/plugin integrity, production and Storybook builds, 97 native tests and all 34 component browser cases. Selected synthetic screenshots include desktop/light, narrow/dark and custom-name states; final capture waits for theme colors to settle and accounts for the sticky header.

Otis serves the matching HTML, JS and CSS. Seven authenticated live journeys pass, including S4 on the existing evaluation's eight persisted workflow records. The first badge-to-trace check was inconclusive because its locator matched both start and finish declarations; selecting the finish resolved the test ambiguity without changing the UI. That first observation and final live source hash are retained in `evidence/deployment.json`. Deployment wrote no owner judgments. UI-only rollout copied assets before replacing the entry page and kept the previous UI privately for recovery.
