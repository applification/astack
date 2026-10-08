# Work views proof

Product revision: `135ae74594cd3ed73960ea04f851874a30ad5625`, based on
`a1faa617a8d5ba534b0c76166a6a986849cc2172`. Subsequent changes only document
the terms, decision and retained evidence. Environment: macOS arm64, Bun 1.4.0,
TypeScript 6.0.2, Storybook 10.6.1, e2e 0.15.1 with web engine 0.11.1.

## Acceptance observations

| Case | Result | Observed proof                                                                                                                                                                                                                                   |
| ---- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| W1   | pass   | Browser selection and trace links survive Work story → Graph → Work story. Work story opens by default.                                                                                                                                          |
| W2   | pass   | Parent phases, retries, separate dispatches, child turns and repeated skill reads remain inspectable; unknown times stay unknown. Graph sequence paths bypass result observations.                                                               |
| W3   | pass   | Domain and browser checks distinguish completion, presence, delivery, acknowledgement and use. Presence creates no return edge. Missing join evidence retains the parent's declaration with its coverage gap.                                    |
| W4   | pass   | Native-first and T3-first collection preserve the owning trace, outcome and counts through refresh/replay. Real local ingestion retains all three observation kinds; frozen evaluation runs stay unchanged.                                      |
| W5   | pass   | Browser checks exercise keyboard selection, inspector focus, return focus, five child contributions and local graph scrolling at 390px without document overflow.                                                                                |
| W6   | pass   | Backend regressions retain indexed row/byte limits and deny anonymous, paused, removed-folder, foreign and content-disabled capture. Approved parent observations survive absent child capture; known child restrictions continue to block them. |

`bun run observatory:check` passed strict types and **210 tests / 1,042
assertions**. `observatory:lint`, production build, Storybook build and the site
`check` passed. The production JS bundle is 335.70 kB, 102.52 kB gzip.

The full browser run **01a11d7c-a31a-7f8a-b7ad-d8a6db36a726** passed all
**48 tests**, zero failed/flaky/skipped. It started with the review fixes
uncommitted on `2888bfc`; the same tested product content was committed as
`eefc1bc` during the run. [results.json](results.json) preserves that captured
VCS state, run times, selected test outcomes and the full local report hash.
The full runner output remains in ignored `.e2e/`. The later `135ae74` change
only affects backend legacy lookup; the UI and browser test content is unchanged.

## Persisted and installed-host checks

A disposable anonymous Convex backend on loopback compiled the updated functions
and passed authenticated HTTP ingestion and fresh query checks: present,
delivered and acknowledged observations persisted; frozen evaluation runs stayed
unchanged; anonymous and paused-project reads were denied. Eighteen parent
observations remained readable without child traces and did not displace the
parent's final response. The latest push/smoke used `135ae74`. The owned backend
was stopped after proof.

A separate passive read of the installed T3 host
`0.0.46-nightly.20261008.2833` projected five task records across three provider
turns into an isolated temporary LocalStore. It retained eight observations:
four present and four acknowledged. Replay retained their original observation
times; occurrence times stayed unknown. Nothing was uploaded, and the installed
collector configuration, version and process were not changed. This read did
not cause delivery or acknowledge a task. Automatic delivery is covered by
synthetic host/adapter/browser checks, not this live observation.

## Review and first failures

Independent round 1 at `2888bfc` confirmed the UI behavior and reproduced three
P2 defects: supplemental events could crowd out the final response, absent child
capture hid approved parent observations, and refresh/upload counts disagreed.
`eefc1bc` fixes all three with indexed prompt/output reads, explicit handling of
missing versus restricted child capture, and one canonical-event count rule.
Permanent backend, collector and browser regressions cover each reproduction.
Independent round 2 at `eefc1bc` cleared R1–R3, reviewed the Button variants,
selection/focus/mobile behavior and the Convex boundaries, then reproduced R4:
legacy rows without the optional indexed kind projection lost their excerpts.
`135ae74` adds a separately indexed, bounded legacy slice and combines its
sequence order with modern rows. Two permanent regressions cover all-legacy
and mixed captures. Both slices retain 12-row bounds and share the existing
32 KiB per-end and 256 KiB total limits. Follow-up R4 review is pending when
this report is first written.

Earlier browser attempts exposed two test issues: an immediate count before
React readiness, and an ambiguous synthetic title locator. The first full run
`01a11d73-04db-7392-baf8-e146ad4a3956` had 47 passes and one locator failure.
Readiness assertions and the intended unique locator were corrected; the latest
full suite passed. No retry conceals a known product failure.

## Selected media and limits

[Work story](work-story.png) and [Graph](work-graph.png) are unedited captures of
the actual integrated Storybook build using synthetic fixtures at 1440×1050.
Both select UI checks and expose the same independent facts. The Graph capture
is locally scrolled to show delivery returning to the parent while presence has
no return edge. These pictures establish rendering, not backend persistence.

Pen was omitted because the owner authorized building the already reviewed
prototypes. Storybook provides the selected presentation proof. React/SVG is
sufficient for this bounded graph; no graph library was added. Direct children,
capture truncation and missing timing remain explicit. Passive snapshots cannot
recover historical states the host no longer exposes. Otis deployment, a real
deployed UI session and an installed collector upgrade were not performed.
