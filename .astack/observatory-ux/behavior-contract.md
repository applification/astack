# Agent Observatory UX

The owner can recognize what a run was asked to do, inspect concise metadata,
understand skill problem rates, and browse results without an always-open filter
form. The eight browser annotations and approved proposal guide this change.

## Acceptance

- U1: Lists and detail headings use the same cached task name. Existing meaningful
  titles survive; technical fallback titles use readable repository/provider context.
  Activate the existing private naming worker and resume eligible historical naming.
- U2: Codex and Claude names have bundled provider marks; unknown providers retain
  readable text. Repository links use a compact name and host icon, with safe remote
  normalization and the full remote available. Local directories remain inspectable.
- U3: Detail headings fit the dashboard. Session and attempt IDs are independently
  labelled, shortened, revealable, and copyable with truthful clipboard feedback.
- U4: Events without timestamps omit the time label. Available source/hook times
  remain labelled and sequence stays unchanged. Explain missing times once.
- U5: Problem rate explains warning/error runs divided by observed runs within the
  same project and capability version/provenance group, including actual counts.
  Help works by hover, keyboard focus/activation, and touch; it escapes table clipping.
- U6: Runs, Work and Problems start with collapsed filters. Active counts/selections
  and clearing stay visible outside the panel. Opening, closing and clearing preserve
  catalog loading, unavailable selections, dates and existing drill-down behavior.

## Design and proof choices

Pen is skipped: the owner approved the inline responsive HTML proposal before
implementation; it establishes the compact metadata/disclosure direction while
preserving existing Astack typography, colors and component structure. A second
design canvas would repeat that settled decision.

Storybook is selected for provider/fallback states, identifiers, clipboard failure,
rate help, collapsed/active/loading filters and narrow light/dark layouts. Retained
captures use synthetic data. Exact e2e checks exercise the interactions; lint,
strict types and existing domain/backend checks cover integration. The deployed
private UI and fresh naming-label reads provide separate live proof for activation.

No source merging: T3 already records times for its own events. Native-first source
ownership prevents a later source from replacing/enriching those records; changing
that needs reconciliation and historical migration proof. Missing native item times
cannot be restored through the current supported app-server history contract.

## Results

Implemented on `t3/agent-runs-ux-improvements` from `30cc7ea`. Verification ran
on Otis, macOS arm64, Bun 1.4.0, React 19.3 and the pinned e2e web runner.

| Behavior | Evidence |
| --- | --- |
| U1 readable list/detail headings | Domain title precedence regression, reactive naming fixtures, live annotated run uses one generated name in both places |
| U2 provider/repository marks | Bundled asset load assertions, normalized credential-free link regression, live `astack.git` link |
| U3 compact metadata | Exact synthetic session clipboard payload, denied-write feedback, full-ID disclosure, 32px narrow heading, live annotated IDs |
| U4 absent event times | Mixed agent/hook/unknown-time fixture and live trace: no placeholders, available times preserved |
| U5 understandable rate | Numerator/denominator/scope text, hover/focus/Enter/tap, pointer movement, outside/Escape dismissal, visible portal geometry inside narrow viewport, live help |
| U6 filter disclosure | Closed/active/loading/unavailable/category/date fixtures, project-wide live catalogs and historical branch results across Runs/Work/Problems |

- `bun run check`: passed.
- `bun run observatory:lint`: passed.
- `bun run observatory:check`: strict types plus 67 tests / 415 assertions passed.
  Final strict type check also passed after adding the live metadata assertions.
- Production UI and Storybook builds: passed. Vite retains its existing advisory
  about large chunks; this change does not claim a bundle-size improvement.
- `bun run observatory:test:e2e`: 14/14 passed, run
  `01a111f2-0561-729d-b5dd-d81272f56860` (11.29s).
- `bun run observatory:test:live`: 4/4 passed, run
  `01a111f3-66b9-72d3-8787-8e132f19b272` (6.24s). The private access key is supplied
  by the runner's secret boundary; live traces/video are disabled. No production
  conversation screenshot is retained here.

### Failures investigated

The interaction review reproduced an activation bug: hover could open a tooltip
before a click closed it, and automatic table scrolling could immediately close
activated help. Activated help now stays pinned until explicit dismissal or blur.
The final check requires a visible card with positive dimensions inside the viewport
and retains that actual rendered state. A pre-existing mobile `h1` rule also
superseded the new heading size; it now excludes run headings, with a 32px assertion.

Earlier check failures exposed test setup errors: an immediate image-read race,
locator refocusing during Shift+Tab, hidden filter options counted before opening,
and an outside-click target covered by the card. Checks now wait for loaded assets,
use natural keyboard traversal, open the panel before reading its choices, and
activate a visible outside target. These were repaired without removing assertions.

T3 DOM inspection additionally confirmed bundled assets and the narrow heading size.
Its snapshot operation later reported a client automation error; the retained final
visual evidence comes from the project-owned e2e runner's synthetic fixtures.

### Live rollout

The existing naming functions had not been deployed (`naming:labels` was absent).
They were deployed before the new UI; the current frontend asset is
`index-Bdc9U-YE.js`. The previous UI is backed up privately at
`~/.local/share/astack/observatory/backups/ux-20261006T155252Z/dist`, and earlier
hashed assets remain available to already-open clients.

The separate `net.applification.astack-agentlog-names` LaunchAgent is running with
the owner's existing ChatGPT Codex login, `gpt-6-luna`, and a mode-0600 naming config.
A fresh authenticated read found cached activity names for 39 of 40 recent Astack
runs, including the annotated run. Historical backfill remains in progress under
that durable worker; naming error logs were empty. Current or unavailable requests
continue to use readable fallbacks. Collector status reported healthy native/T3
sources and forwarding with zero queued records.

The temporary Storybook server and its owned Tailscale route on 8454 were removed;
the existing private deployment routes remain in place.

### Retained review media

All media contains synthetic data:

- [Compact metadata, desktop/light](evidence/metadata-light-desktop.png)
- [Identifiers, clipboard feedback and 32px heading, narrow/dark](evidence/metadata-dark-narrow.png)
- [Visible problem-rate help outside the table, narrow/dark](evidence/problem-rate-help-dark-narrow.png)

Manual review covered owner-authorized naming, safe remote links, independent
clipboard feedback, timing provenance, filter URL/catalog behavior and help-card
focus/dismissal. Timestamp recovery still depends on the source recording a time;
this change hides missing times without fabricating replacements.
