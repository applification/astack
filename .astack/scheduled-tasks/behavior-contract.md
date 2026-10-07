# Scheduled tasks in Observatory

The owner can distinguish Codex automation activity from other runs, filter it, and browse a dedicated Scheduled tasks page with task names, schedule snapshots, latest captured activity and links to history.

Classification comes from Codex's `threadSource: automation` or a matching local automation-run record. Prompt text never classifies a run. Definition metadata is optional: deleted tasks, unavailable databases and older clients must not break collection. Existing stored runs remain valid and an upgraded collector replays retained history once. Native/T3 overlap preserves automation facts without duplicating trace events.

Task identity includes the machine and automation ID; an unidentified automation stays specific to its session. Project scope applies to every query and history link. Counts and grouping describe loaded pages. Schedule state and next-run times are explicitly last-observed snapshots, not a promise that a task will run or a statement of engineering success.

## Acceptance

- A1: Metadata-only capture recognizes a structured automation marker; an ordinary prompt containing an automation header does not create a badge.
- A2: A read-only Codex database lookup enriches the task name, readable schedule description, state and next run; missing/incompatible/deleted definitions leave usable partial metadata.
- A3: Upgrade replay enriches existing run identities, retains outcomes and events, and does not repeatedly replay unchanged history.
- A4: Authenticated, indexed scheduled/task filters combine with project scope and pagination. Anonymous queries are denied; same task IDs on different machines do not merge.
- A5: Run rows and detail metadata identify scheduled activity. The Scheduled tasks page groups captured runs, links to the exact task's history and handles unknown names/schedules and empty results.
- A6: The UI supports keyboard navigation and a narrow viewport, with counts explicitly limited to loaded runs.

## Design and verification

Pen is skipped: this adds a badge and a table using Observatory's existing layout and typography; no new visual direction is needed. Storybook is selected for mixed runs, schedule snapshots, missing definitions and empty states. Exact browser checks cover badges, filtering, task-history links and narrow layout. Collector regressions use real temporary SQLite databases; backend regressions use Convex's native test runtime. An anonymous local Convex push and a synthetic running-product fixture cover the actual reactive adapter. Production deployment is outside this change.

All six acceptance cases pass on the source retained at `99e109cf9e8540ef0079e455bbfc55751591c5cd`: strict types and 116 regressions, 44 component browser checks, and one authenticated local reactive-app journey. UI lint, production/Storybook builds and existing site/plugin checks pass. The required Convex reviewer checklist was applied as self-review, with no unresolved finding in the changed functions.

See the [acceptance results, observed failures and limits](evidence/proof.md), [synthetic desktop capture](evidence/desktop.png), [synthetic narrow capture](evidence/narrow.png), and [operation and rollout guide](../../docs/observatory-scheduled-tasks.md). These results establish local behavior; Otis has not been deployed with this feature.
