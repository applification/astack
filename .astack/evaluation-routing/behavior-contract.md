# Evaluation routing and skill capture repair

Generated evaluations must show available skill evidence even when no agent declared a structured route. Future T3 captures must recognize ordinary successful shell reads, and agents must be able to invoke the installed collector without a global PATH change.

## Acceptance

- R1: The reported generated evaluation shows its captured parent skill sequence with exact trace links, including repeated reads. Missing route/phase declarations remain explicit.
- R2: Recorded routes, phase retries, child lanes and explicit joins retain their existing behavior. Observed parent reads are disclosed separately from phase declarations. Prompt/result lines follow visible stops when that disclosure opens or closes.
- R3: Successful T3 shell wrappers and multiple literal read paths produce skill evidence. Failed commands, quoted examples, variable paths and ambiguous shell compositions do not. Upgrading replays previously checkpointed T3 history once, preserving existing event identities and source ownership.
- R4: The bundled launcher reaches the private collector install when `agentlog` is absent from PATH. The installed Observatory reference directs agents through that launcher for route/phase and evaluation recording.
- R5: Current readable-capture/project/machine policy governs skill projection; paused projects expose no reads. Parent reads are bounded to 64, child reads to 32 and the existing shared byte budget remains enforced. Evaluation snapshots and owner grades are unchanged.
- R6: The five-child route fits desktop widths of 1280, 1600 and 1920 pixels with every child lane visible. Narrow screens retain readable lanes and allow both outer children to be panned into view. Resizing preserves aligned connectors and does not retain an obsolete oversized SVG canvas.

## Supported causes

Authenticated inspection of the reported evaluation found one linked run, no structured workflow records and no branches. Its full trace contains 19 skill events. The query previously projected ordinary reads only for children; the view drew no parent map without explicit workflow annotations.

Independent read-only collector diagnosis confirmed that the supplied agent checked `command -v agentlog`, found no executable and recorded the handoff as unavailable. The private binary was installed and healthy. Another recent T3-owned run contained successful `/bin/zsh -lc 'cat …/SKILL.md'` commands but no skill events: the parser recognized only a bare reader with one path. The older illustrated evaluation had explicit route/phase/join annotations recorded after delivery.

Live rollout also exposed a source-wide T3 collection failure. An encoded delegated Claude turn produced a 369-character run ID; adding an ordinary 174-character message item produced a 547-character event ID, exceeding the domain limit. The collector aborted before processing later runs. The emitter now preserves previously valid event IDs and hashes oversized item/variant suffixes while retaining the run prefix required by ingestion. Version-5 checkpoints replay completed history once.

## Design and proof

Pen is skipped because this repair reuses the existing connected-map layout and skill icons. Storybook covers observed-only and recorded-plus-observed paths, exact links, repeated reads, desktop/narrow geometry and disclosure changes. Native Convex checks cover real generation and current-policy projection; collector checks cover shell parsing, failure exclusions, deduplication and checkpoint upgrades. An owned anonymous backend push and live Otis readback are separate verification claims.

The initial parent-read regression failed because the projection lacked reads; the same test passes after repair. A real browser regression then showed that closed details descendants retained layout boxes, causing the result bridge to follow hidden observed reads. Explicit disclosure visibility and toggle remeasurement repaired it. The long-item identity regression likewise failed with the live `too_big ["id"]` signal before repair and passes with stable, distinct replay identities afterward.

Early verification setup failures were missing checkout dependencies, a capitalization mismatch in a new browser assertion, an incorrect new test invocation of `persistSnapshot`, and a local backend that was not kept running. Python's incomplete local CA store also blocked an artifact check; native Bun HTTPS requests verified the served entry and assets. Raw reports stay ignored under `.proof/evaluation-routing`; retained pixels use synthetic data.

## Observed outcome

At source revision `0187a892191bbe755f0d72e0ac2f5200bb304455`, strict types, 151 unit/native-function tests, lint, plugin/site integrity and the production build pass. Nine focused synthetic browser regressions cover routes, retries, child counts 0–4, joins, observed parent reads and disclosure geometry. Two real Otis browser tests pass without retries: the reported evaluation has 19 skill stops, 19 main lines, root/prompt/result bridges, working exact trace links and no page overflow at desktop/narrow widths; the older declared journey retains its route and evidence interaction.

Native Otis readback returns all 19 parent reads in exact trace order. The original saved request, run snapshots, source, assessments and feedback have an unchanged digest. The illustrated child journey still has five declarations, two available children and one explicit join. The newer T3-owned run recovers 12 distinct skills from zero. Both native and T3 collection, project policy and forwarding are healthy, with no pending records. UI/backend were updated before the signed collector; the prior runtime and backend source are retained privately for rollback. The installed plugin reference and launcher were patched without publishing a package release.

Independent review found F1 newline compositions and F2 brace expansion creating phantom reads. Both findings were accepted, repaired and cleared in a follow-up review. The identity repair received a separate independent pass, including Codex/Claude boundary fixtures and actual native Convex ingestion. The diagnosis proposal to hash an entire event ID without its run prefix was declined because it violates ingestion ownership. Existing limits still govern very long run prefixes; this repair covers the observed composed-item failure. Hashed IDs retain T3 timestamps or unavailable timing; native hook enrichment for those IDs was not independently verified.

[Verification facts](evidence/verification.json) retain counts and hashes. [The representative capture](evidence/observed-parent-skills.png) uses synthetic data. Historical route/phase declarations were never captured and remain unknown; the map does not invent them from skill reads. No owner judgment was written.

## Follow-up: clipped routing map

The reported five-child evaluation used a 2816-pixel canvas inside a 1440-pixel viewport at a 1600-pixel desktop width. Fixed lane widths and page caps clipped the outer children. Evaluation pages now use the available screen width; lanes account for the viewport, lane count, gaps and outward label gutter. Text retains its normal size. Below 1025 pixels, readable 264-pixel lanes remain horizontally pannable. Larger branch counts can still need panning when their minimum readable width exceeds the viewport.

A new five-child Storybook regression and the exact live evaluation both failed before repair with hidden routes and an oversized map. Resize testing then exposed an old SVG retaining its width through `scrollWidth`; measuring the map's layout box removes that stale canvas. Pen remains unnecessary for this correction to the established layout; Storybook includes a retained [synthetic five-child capture](evidence/five-child-routes-full-width.png).

At `bf1616c`, nine focused Storybook browser tests and three real Otis tests pass without retries. The five-child route fits all three desktop widths; connectors stay on their anchors through resizing, and both narrow-screen outer headings can be reached. Strict types, 151 unit/native checks (781 assertions), lint, site/plugin checks, production and Storybook builds pass. The UI-only Otis update preserves backend/collector revisions and retains prior assets privately. Served HTML and asset hashes match the candidate build. [Width verification facts](evidence/width-verification.json) record this follow-up separately from the original recovery.
