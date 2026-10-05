# Agent Observatory evidence

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
