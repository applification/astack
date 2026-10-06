# Naming verification

Implementation: `7860c88755f9c0e69bf550f722973076e67e6c35`.
Observed on 2026-10-06, MacBookPro / macOS, Bun 1.4.0, TypeScript 6.0.2,
Convex client 1.46.0. The local backend used the existing pinned image digest
`d715e9ec088784407ca4ba2d3db592702cd328d02c76cdca3852c0018f2a76b4`, in a
separate disposable container on loopback ports 3320–3321. Production was untouched.

## Acceptance results

| Case | Observed result |
| --- | --- |
| Readable Work and activities | Real `gpt-6-luna` execution using saved ChatGPT auth generated two activity names and one Work heading from two synthetic conversations in one call. Native owner-authenticated Convex stored and returned all three. |
| Stable cache and grouping | Replays, updated capture revisions, repeated backfill and a second claim preserved ready names. The signed standalone CLI's subsequent `names --once` returned zero names and triggered no inference. Source title, outcome and explicit Work identity were preserved. |
| Capture independence | Telemetry ingestion succeeded while the naming-worker task was active. Collector capture/delivery code never awaits inference; worker timeout/cancellation checks passed alongside the existing capture/delivery regression suite. This was functional concurrency proof, not an inference-latency benchmark. |
| Authorization and policy | Anonymous, wrong-owner and machine subjects were denied all naming APIs. Metadata-only, withheld and context-only prompts were excluded. Removed matching folders, paused projects, changed event revisions, stale claims and changed Work membership prevented accepting invalid results. Identical Work IDs stayed separate across projects. |
| Bounds and recovery | Four-target batches, four Work request sources, 1,200-character excerpts, three-run backfill pages and 50-run label lookups were checked. Active claims resisted duplicate workers; abandoned claims recovered and failures backed off. Atomic cursor persistence/resumption passed. |
| UI | Native reactive App showed the shared Work heading, both activity headings, metadata-only fallbacks and the same heading after activity drill-down. Session and turn IDs remained visible. A render-loop defect found during this check was fixed; the real subscription hook now has a browser regression for fresh run objects. |
| Explicit names | Backend and Storybook cases verified that supplied Work labels override generated headings, including across loaded pages. |

`observatory:check` passed: type checking and **53 tests**. `observatory:test:e2e`
passed: **12 browser tests**. Lint, production UI build, Storybook build, site/plugin
integrity checks and frozen-lockfile installation passed. The compiled agentlog
binary was ad-hoc signed and ran against the native fixture backend. Convex functions
were pushed to the disposable instance and API bindings were regenerated.
Storybook retains its existing large-chunk advisory; builds passed.

Pencil was skipped because text changes fit existing layouts. Storybook was selected
for generated/fallback/explicit names and reactive subscription coverage.

## Convex reviewer result

Applied `convex:convex-reviewer` to the completed schema, ingestion integration,
naming functions and reactive client diff. All public functions require the owner
UUID identity and validate arguments/returns. Reads use indexes and bounded pages;
time checks occur in mutations. Source eligibility uses the current capture-policy
resolver both at claim and completion. External inference happens in the independent
local worker; Convex holds the durable naming projections and pending jobs.

Confirmed findings were fixed: current folder policy must be rechecked even when
a project remains enabled; changing subscription request objects caused a render
loop. Both have regressions. No unresolved security, authorization, validator,
index, pagination, reactivity or type-safety findings remain.

## Retained UI evidence and remaining operations

Only synthetic Storybook fixture data is retained:

- [Names and fallbacks, wide view](names-light.png)
- [Dark narrow view](names-dark-narrow.png)

Raw native fixture credentials, source transcripts and runner directories remain
outside the committed evidence. See the [behavior contract](behavior-contract.md)
and [worker setup](../../docs/agent-observatory.md#work-and-activity-headings).

Production deployment, selecting a signed-in Codex home on the permanent worker
host, and installing its separate LaunchAgent are outstanding operational steps.
Saved ChatGPT login/Luna inference was verified on this MacBookPro; worker login
and launchd supervision on Otis were not exercised.
