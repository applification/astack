# Agent Observatory evidence

## Dashboard navigation link, 2026-10-06

Added **Convex dashboard** to the shared authenticated navigation, opening private port 8453 in a new tab with `noopener noreferrer` and no credential in the URL. On the working tree based on `72feb86`, UI lint, strict types and all 22 tests, production/Storybook builds, five existing synthetic browser tests, one authenticated deployed UI journey and site/plugin checks passed. Direct browser inspection confirmed the link destination/new-tab attributes and no horizontal overflow at 1051px and 390px. Otis's served HTML and JavaScript exactly matched the built UI; Observatory and the dashboard returned HTTP 200. Only web assets were deployed. The existing navigation layout is reused, so no separate Pen exploration or new component story was needed.

## Convex admin dashboard, 2026-10-06

Installed the official Convex dashboard pinned at `sha256:f85cf0d0448b9c835ae3df5c7c1c6f0145dd4c8f0f92eb0245daf304efdd9f1a` alongside the existing backend. Docker binds it only to `127.0.0.1:6792`; Tailscale Serve exposes private HTTPS on port 8453. The container health check passed, the HTTPS page returned 200, and the browser displayed the Convex login form with the correct deployment URL (`https://otis.tail12a0a0.ts.net:8451`). The existing private admin key successfully listed the five expected tables through the native CLI. Credentials were copied directly to the local clipboard without being printed; browser sign-in is left to the owner. This dashboard uses the actual Observatory database.

Strict types, all 22 tests and the existing site/plugin checks passed. Deployment now synchronizes the runtime Compose definition and establishes the dashboard route; the existing login startup starts the new service. Pen/Storybook are not applicable to the unchanged vendor UI; HTTP, container health and the observed login page establish startup. No authenticated browser dashboard session or post-reboot test is claimed.

## Readable content update, 2026-10-06

Implemented and deployed revision `2eeebee` on Otis. This supersedes the initial metadata-only privacy decision below. New collectors default to redacted content; explicit existing metadata-only settings remain respected. Otis enables readable capture and includes its separate viewer credential in private known-secret matching. Trace titles remain metadata, with readable previews and expanded Message/Command/Output/Arguments/Result/Error sections controlled by Show content.

- Strict types, all 22 domain/collector/native-backend tests, UI lint and public site/plugin checks passed. New cases exercise readable/metadata-only replay with stable identities and first observation times, known secrets and nested/embedded JSON credentials, omitted reasoning, and the CLI capture setting. The production UI and signed portable collector built and deployed successfully.
- Five synthetic Storybook browser tests passed, including content visible by default, content removed from the DOM when hidden, status metadata retained, preference persistence after reload, restoration, and narrow dark rendering. The first attempt hit an ambiguous locator because it matched both a visible preview and the same text in a collapsed detail; narrowing to visible text resolved the test setup issue. Existing timing/filter/empty/theme/navigation checks remain green.
- One authenticated deployed UI journey passed. It observed real readable previews, their removal when Show content was disabled, restored content, run/work/skill navigation, and localStorage containing only theme and visibility preferences. Keys/JWTs and conversation content are not stored there.
- Native private-service proof passed all missing/wrong-identity and machine-credential denial cases and read a persisted trace with redacted content. A fresh owner query for the user's open run confirmed 18 events, including 4 readable message fields, 5 commands and 5 outputs. The first runs page contained 20 runs marked for content capture at that observation.
- All 1,322 locally retained runs were re-read with content enabled. The history refresh is queued with existing IDs; pending uploads decreased from 86,065 to 84,091 while capture and forwarding reported `ok`. Complete historical delivery is not claimed. The open run and recent runs were prioritised and verified in the native backend.
- One replay attempt reported `capture_unavailable` and the collector recovered on its next attempt. Simultaneous normal and operator-priority forwarding caused a native optimistic-concurrency retry failure on the shared machine row; sequencing the uploads resolved it, with queued revisions retained. The normal supervised collector is running again.
- Applied the Convex reviewer checklist as self-review to the retained data/auth boundaries: the existing authenticated, paginated query and ingestion paths accept the already-supported event JSON shape. No schema or function change was required. Permitted/denied native calls and revision replay passed.

Pen is skipped for this addition because it reuses existing trace controls/layout; Storybook and the running deployment cover its states. The original feature's separate Pen comparison gap still keeps the overall PR draft. Remote Observatory, site and plugin CI passed for `2eeebee`; the broader foundation reference check is reported by the PR checks.

![Synthetic readable trace](evidence/trace-content-readable.png)

![Synthetic trace with content hidden](evidence/trace-content-hidden.png)

## Initial feature and appearance proof, 2026-10-05

Environment: Otis/macOS arm64, Bun 1.4.0, Node 24.21, Codex CLI 0.160.0, Convex SDK 1.46.0. Date: 2026-10-05. Initial collector/backend/native-service proof applies to `a201b49`, with current main incorporated at `6264517`. Appearance, bundled fonts, four component browser tests and the deployed UI journey apply to `43fad6c`; the deployed UI source matches that commit. Strict types, 19 domain/collector/backend tests, UI lint and existing site/plugin checks passed after the theme changes. This revision annotation changes documentation only. Raw private reports remain ignored under `.proof/agent-observatory` and `.e2e-live`.

| Acceptance | Observed result |
| --- | --- |
| CAPTURE | A compiled, supervised collector reads real persisted Desktop turns from the local app-server and all configured source kinds/archives. The source reports `ok`. Full-history capture held 1,315 turns and 105,530 events locally; the pending queue decreased from 93,198 to 91,238 as native ingestion progressed. A real first page contained 31 runs with capability evidence and 58 capability groups were available. Native tools, failures and traces were present. Historical forwarding remains in progress in bounded batches; capture completeness is not claimed. |
| PORTABLE | The compiled collector runs from the permanent private runtime without the source worktree or web app. Adapter types remain outside the shared domain. A native-CPU MacBook installer/enrollment flow is supplied. MacBook installation is explicitly deferred by its owner. |
| PRIVACY | V1 rejects raw-content mode. Tests cover nested credential keys, environment assignments, known secrets, bearer tokens, URLs and private keys. Disk reopen proves only redacted records remain. Large-detail omission, byte-bounded batching and non-blocking hashing of a real FIFO are tested. Public screenshots contain fixtures only. |
| OFFLINE | A real local HTTP 503 followed by success retains/replays a SQLite queue across close/reopen. Concurrent revision updates survive old acknowledgements; unchanged replays deduplicate. A wrapper test preserves agent stdout and exit code 3 while associating work. |
| PRIVATE | Actual self-hosted functions pushed successfully. Missing/wrong viewer credentials, absent machine credentials and machine-key UI access were denied. Anonymous native queries were denied; the owner received a verified UUID-subject JWT and read stored traces. Tailscale stripped a forged owner identity header (401). Docker ports bind only loopback; Serve endpoints are tailnet-only. |
| LINKS | Tests bind work/project context to completed runs immediately and preserve it across later snapshots. JSON launch events bind automatically. Workflow/outcome annotations queue locally. Current Astack has no actual COS launcher/work store; no real work-store integration is claimed. |
| TRACE | Four deterministic Storybook browser tests cover expansion, failures/interventions filtering, missing timing/privacy, empty state, desktop/narrow light/dark rendering and theme persistence. A separate actual private UI test covers auth gating, filtered run → trace, Work, Skills, exact-version drill-down, Problems and Capture health. Only the theme preference appears in production localStorage; authentication remains in memory. |
| FEEDBACK | Function/domain tests establish matching-failure thresholds, unknown outcome, no inferred intervention from ordinary prompts, exact version grouping, idempotent rollups, stale revisions, pagination and independent machine credentials. Legacy unknown start times are not measured as long-running work. |
| PERSISTENCE | Restarted the actual backend and confirmed the identical completed run remained queryable. Container health recovered, collector forwarding resumed, and the recent-history queue drained to zero before full historical backfill was enabled. The deployment starts via a user LaunchAgent/OrbStack at login; machine reboot was not exercised. |

The local check set is `bun run check`, `bun run observatory:check` (19 tests), `bun run observatory:lint`, production UI/collector builds, Storybook build and 4 browser tests, native private-service proof and 1 deployed UI browser test. CI runs the public/synthetic subset without private credentials; its remote result belongs to the PR checks, not this local observation.

The owner-requested appearance refinement matches the actual Astack reference in light/dark tokens, bundled type families and compact top navigation. Theme persistence and system-mode changes were observed in a real browser; explicit dark before sign-in and light on authenticated Capture health passed on the deployed UI. The first Storybook theme test failed because restarting opened Storybook's manager, which stores its own `@storybook/manager/store` entry; that known fixture-host key is now excluded from the component check. The production check strictly permits only the theme preference. A missing font-subset import initially failed the build; corrected to the actual pinned package exports, after which font loading/build/lint passed. Raw first-failure runner output stayed ignored.

## Review and remaining limits

Applied `$convex:convex-reviewer` as **self-review**, not an independent agent review. Authentication/authorization, validators, internal visibility, indexed bounded reads, native pagination, deterministic reactive queries, mutation bounds, revision replay and type safety were checked. Confirmed issues fixed during review: special-file hash reads can no longer stall historical capture; email was replaced with an opaque UUID JWT subject; machine credential configuration now fails closed; ingestion chunks and collector batch bytes are bounded; exact capability-version facets were added and existing projections repaired. Security/function regressions and the actual native service checks passed afterward.

Pen was selected but its stale canvas connection did not save an artifact here; blank screenshots cannot establish layout proof or design comparison. See [design scope](design.md). That selected comparison remains unverified and keeps the PR draft. Actual Storybook pixels and live behavior are separately observed.

Installed-host MCP loading and editor save diagnostics were unavailable in this headless worktree. The e2e runner and CLI UI lint worked. Optional native hooks were not installed/trusted. Physical second-machine capture awaits the owner’s MacBook setup; two machine identities were exercised in isolated native-function tests, not presented as two installed machines. Persisted item timestamps/token counts and historical skill versions unavailable from the source remain explicitly unknown. Ephemeral/cloud-only capture and unsupported composite tool details remain coverage limits.

## Retained review captures

![Synthetic desktop runs](evidence/runs-mixed.png)

![Synthetic dark desktop runs](evidence/runs-dark.png)

![Synthetic failure trace](evidence/trace-failure-expanded.png)

The [narrow capture](evidence/runs-narrow.png) establishes responsive navigation and a bounded horizontal table. These captures demonstrate presentation, not real work outcomes or capture completeness.
