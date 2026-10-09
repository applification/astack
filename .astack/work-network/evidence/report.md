# Captured work network proof

Product revision: `202af8b240903fcfe486a1153226e60dd6b1e809`. Evidence was
collected against this clean implementation commit. Later commits retain proof
only. The event log remains authoritative; Graph is a derived relationship
view and Work story remains the default.

| Contract | Observation |
| --- | --- |
| N1 | Overview uses conversation, task and result identities. Only explicit captured relationships form edges; completion, timestamps and matching command signatures do not create return or process-order links. |
| N2 | Expansion reveals captured turns, declarations, skills, activity and evidence. Filters preserve selection and trace identity. Unknown evidence and capture/display limits remain visible. |
| N3 | Force, Communities and Layered preserve typed topology. Browser checks cover selection, neighbor inspection, keyboard focus, pan, zoom, fit, layouts, filters and narrow screens. |
| N4 | Completion, result presence, host delivery, acknowledgement and declared use remain independent. Known skill hashes/provenance can form reference hubs; unknown versions remain distinct. |
| N5 | Current summaries/activity retain existing authorization and frozen evaluation evidence. Local persisted readback and native tests cover permitted/denied reads, missing child capture, duplicate host tasks and bounded previews. |

## Verification

Strict types and **222 data tests / 1,107 assertions** passed. UI lint,
production build, Storybook build and site/plugin checks passed. The full
deterministic browser run `01a11f88-7118-789a-91fd-1f5380309907` passed
**49 tests**, zero failed/flaky/skipped, at the product revision above.
[Browser results](browser-results.json) retain revision, timestamps, selected
outcomes and the original runner report hash. Full logs remain local/ignored.

An owned anonymous Convex backend on `127.0.0.1:3210` compiled and pushed the
exact updated function source. Authenticated synthetic ingestion and fresh
readback persisted presence, delivery and acknowledgement, retained 18
observations without child traces, and preserved the final response and frozen
evaluation runs. Anonymous and paused-project reads were denied. The graph
projection returned 5 current summaries, 11 activity previews, 85 nodes,
100 edges and 3 tasks. [Local readback](local-readback.json) records these
observations. The actual Vite UI on port 6021 also rendered this persisted
capture: 85 expanded nodes, 100 links and no alert. The backend/project was
left enabled solely for the running local preview.

The independent read-only reviewer applied `convex:convex-reviewer` at the
pinned revision and found no remaining material P1/P2 issues. Its focused
domain/backend suite passed **69 tests / 304 assertions**. Six confirmed issues
were corrected before the final pin: event-role promotion; parent-scoped use;
host-task deduplication across provider turns; streaming the activity scan;
shared task identities across views; and frozen snapshot revision provenance.
[Review facts](review.json) retain the resolutions and command. The streaming
probe yielded two 200 KB event rows, including the threshold-crossing row,
instead of loading all 49; one metadata preview remained and truncation was
reported. This instrumentation establishes the scan behavior, not deployed
Convex read-limit capacity.

An earlier broad browser run exposed a real regression: switching to Graph hid
the original request's connection to the work section. A visible anchor in
both modes restores it; the existing regression and final full suite pass.
No retry conceals this failure. Review regressions also verify same-ID tasks
in separate parents and historical revision 7 fallback.

## Media and limits

[Force](force.png), [Communities](communities.png) and [narrow-screen](narrow.png)
captures are unedited screenshots of the actual shared component using
synthetic Storybook fixtures. The inline HTML preview bundles the same
`WorkflowEvidence` implementation and fixture, with system font fallback and a
450px canvas for the conversation frame. Full traces belong to the running
app; the inline fixture has no backend connection.

Pen was skipped because the owner accepted the running SVG network experiment.
Storybook supplies presentation/interaction proof; the separate persisted
local backend supplies adapter/auth proof. No production deployment, real
deployed user-data UI session or installed collector upgrade was performed.
The graph shows direct captured relationships; omitted/nested activity needs
the full traces. Community coloring treats connectivity as undirected and
does not establish teams, ownership, quality or causal dependencies. Layout
position is not a time scale. The 360-node display cap retains the bounded
projection for inspector selection but deliberately omits excess canvas detail.

[Verification and artifact hashes](verification.json) ·
[Automatic task proof](task-proof.json).
