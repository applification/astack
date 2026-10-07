# Scheduled tasks proof — 2026-10-07

The tested candidate is retained in source revision `99e109cf9e8540ef0079e455bbfc55751591c5cd`, based on `5d842d76e34e36dfd7e06875546ab742f8de7b6b`. Checks ran against that source before the commits were created. This evidence/documentation commit changes no runtime source. Environment: macOS, repository-pinned Bun/TypeScript and e2e Playwright engine, owned anonymous local Convex backend on loopback. No production deployment was performed.

| Acceptance | Observed result and regression |
| --- | --- |
| A1 | Native `threadSource: automation` classifies metadata-only capture; identical automation-looking prompt text on an ordinary thread does not. [Collector regression](../../../packages/agentlog/src/automations.test.ts). |
| A2 | Real temporary SQLite lookup returns names, active/paused state and schedule summaries; missing/incompatible databases create no files, and deleted/invalid definitions retain task identity. Redaction and LocalStore persistence retain the readable schedule. The supplied real thread also resolved through the read-only lookup to an active daily task; its private record is excluded from retained evidence. |
| A3 | Versioned replay enriches older retained runs once, preserves outcomes and event IDs, and retains richer facts across native/T3 overlap. [Collector regression](../../../packages/agentlog/src/automations.test.ts). |
| A4 | Native-function checks cover historical enrichment, indexed filter pagination, combined filters, project scope, different machines, stale-facet removal and anonymous denial. The actual local HTTP fixture persisted six runs, returned five scheduled runs and exactly two desktop task runs, and denied anonymous reads. [Backend regression](../../../packages/backend/tests/observatory.test.ts), [local ingestion fixture](../../../packages/backend/scripts/verify-scheduled-local.ts). |
| A5 | Component checks cover mixed run badges, grouped task history, project separation, missing definitions and empty states. The real reactive UI opened the correct machine/project history and latest run, showed the persisted schedule, survived reload, and changed between five scheduled and six total runs. [Local browser journey](../../../apps/observatory/e2e/scheduled-local.e2e.ts). |
| A6 | Keyboard focus, scoped history links and narrow scrolling pass. Real UI checks show no page overflow at desktop and 390px. Loaded-count and last-observed copy are visible in [desktop](desktop.png) and [narrow](narrow.png) synthetic captures. |

Final results: `observatory:check` passes strict types and **116 tests / 681 assertions**; `observatory:lint`, `observatory:build`, `observatory:build:storybook`, `bun run check` and `git diff --check` pass. Component run `01a1171b-c762-724a-89b8-a0f435e91e43` executed **44/44 passing**, zero flaky/skipped, starting `2026-10-07T16:04:19.274Z`. Local reactive run `01a1171e-a00a-7ae2-9ba4-9a8c4206ae4c` executed **1/1 passing**, starting `2026-10-07T16:07:25.752Z`. Raw runner reports/logs and local databases remain ignored; only these selected synthetic images and summarized observations are committed.

## Review and corrected observations

The Convex reviewer skill was applied as self-review: owner authentication precedes reads; argument/return validators and existing indexes are preserved; result pages remain bounded; every candidate combines task, project and other filters; queries use no observation clock and retain native reactivity. Project rows are checked before parsing their JSON. No unresolved security, authorization, index, pagination, reactivity or type finding remains in the changed functions.

Early checks found and corrected an optional-field/redaction mismatch on provider overlap, an outdated filter-menu count, and raw RRULE strings becoming redacted at persistence. The last issue is fixed by deriving a readable description before telemetry redaction, with a persisted roundtrip regression. Desktop navigation overflow at 1280px was corrected by wrapping the header earlier. The local browser journey now waits for the destination heading before matching task-name text during a route transition. Final runs include these corrections.

An existing background-delivery test timed out once under concurrent build/test load, with subsequent teardown errors. The unchanged test and entire final suite passed in 11.17 seconds; its timeout was not relaxed. Initial dependencies also needed installation before the repository's `tsc6` binary was available. Earlier failure reports stay in ignored local proof storage.

## Limits

Schedule definitions are private optional desktop metadata, so unsupported database versions can provide only the native scheduled marker. Schedule state and next-run time are last observed, and the page covers tasks with captured runs. Grouping/counts cover loaded pages; task history is project- and machine-specific. Existing records without automation remain valid. Roll out backend and UI before the upgraded collector, which replays retained history once.

The anonymous fixture configured disposable local auth and machine credentials; owned dev processes were stopped after verification. No real screenshot, secret, local Convex data or credential is committed. No Otis deployment, live scheduler freshness, second physical machine, independent review agent, CI result or owner approval is claimed. Optional agentlog delivery capture was skipped because this task's trusted captured parent-run identity was unavailable.
