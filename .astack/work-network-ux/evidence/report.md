# Graph workspace interaction proof

Product revision: `84378da403d4f0d649685c1fedc9d028c65833a9`.
The [source manifest](source.json) binds the retained results to ten source files.
The graph proof of concept at `b164c303` is the presentation baseline.

## Observed behavior

The compact toolbar separates layout, grouped filters, view options and scope
expansion. Restrictions have an active count and reset. Hover or keyboard focus
provides orientation; selecting a node or relationship opens persistent supporting
content. Relationship inspection explains its captured meaning, exposes both
endpoints and retains the relevant source trace.

Desktop inspection overlays the canvas without changing its viewBox when opened.
Subsequent keyboard navigation pans a covered node or edge midpoint into the
exposed viewport, below sticky navigation, without changing zoom. Narrow inspection
stacks below the graph. Escape and Close restore graph focus; a filtered-out
selection remains inspectable while its panel is open, and the notice accurately
describes the closed state. Work story retains the same evidence selection.

## Design comparison

Pen is connected to the owner's document
`/Users/rufus/Apps/astack/design/astack.pen`. The original HTML interaction
specification preceded implementation. Pen was subsequently used for comparison
and refinement, including the row layout label and a single dismissal action;
it was not the source of the initial generated implementation.

- `nGcY7`: selected compact-inspector direction; retained as [pen-direction.png](pen-direction.png).
- `I3aA07` / browser `KEJOr`: running shared Network Explorer component.
- `VSjck` / `X7ZkJ`: observed expanded inspection, refreshed with the final capture.
- `blGY1`: an earlier editable inspector import for comparison.

[Relationship inspection](relationship-inspector.jpg) is an actual Pen browser
capture of the synthetic component, with 60 nodes and 70 relationships. The
[narrow capture](narrow-inspector.png) comes from the final browser suite at
390×844. Neither screenshot demonstrates production data or assistive-technology
behavior. The document remains in the owner's main checkout; exported evidence
is retained here for PR access.

## Verification

At the product revision, strict types and **222 data tests / 1,107 assertions**
passed. Lint, production build, Storybook build and site/plugin checks passed.
The [component browser run](browser-results.json) passed **54/54** checks, including
both fit-scale and increased-zoom native keyboard reproductions. The
[local application run](local-browser-results.json) passed **1/1**, using the
existing authenticated, persisted synthetic fixture in an isolated anonymous
Convex deployment and the real Observatory adapter. This iteration made no
backend, grading or capture writes.

The self-contained interactive preview bundles the same `WorkflowEvidence`
component with the synthetic journey fixture. Its 728px and 1100px previews
rendered without console errors. Source-trace navigation is provided by the
running Observatory application, not by the isolated component preview.

## Review and resolution

Read-only integrated review round 1 found a covered keyboard target and a
hidden-selection notice that described a closed inspector. Both were fixed with
native keyboard and state regressions. Round 2 confirmed those fixes, edge
midpoint visibility, Escape/return focus and narrow stacking, then reproduced a
zoomed node under sticky navigation. The final boundary change and regression
include the header, viewport and actual hit testing of the focused node.

Final focused independent confirmation passed at `84378da`: both zoom levels
clear the inspector and header, the focused circle's center resolves the actual
node, and zoom remains unchanged. Edge dismissal, focus return and narrow
stacking also passed. Full task identities, source pins, findings and parent
responses are retained in [review.json](review.json). No material findings remain.

No production deployment, installed collector upgrade, screen-reader check,
physical touch-device check or other-browser proof was performed. The inherited
bounded relationship projection and its capture gaps remain explicit.
