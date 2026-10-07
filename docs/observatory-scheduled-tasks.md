# Scheduled Codex tasks

Scheduled runs show a clock badge on Runs and run detail. **Filters → Run type → Scheduled tasks** limits the run list; **Scheduled task** selects one task on one machine. The **Scheduled tasks** navigation item groups captured activity and opens task history within the selected project.

The collector identifies automation from Codex's native `threadSource: automation` or a matching desktop `automation_runs` record. Prompt text is never used for classification. Task names and schedule snapshots come from a read-only join in the optional `<Codex home>/sqlite/codex-dev.db`. Missing databases, incompatible schemas and deleted definitions retain the native marker when available.

Task identity includes machine and automation ID; unknown definitions fall back to that machine's session ID. A task appearing in several projects has separate project rows and scoped histories. The page covers tasks with captured activity, and its counts cover loaded runs. **Load more** can add groups and increase counts. Schedule state and next-run times are explicitly last observed; editing a definition alone does not refresh an unchanged captured thread.

The collector summarizes common daily, weekly and hourly rules before telemetry redaction. Complex rules display **Custom schedule**. Raw recurrence strings are not stored in telemetry. Metadata-only capture remains supported; task classification does not alter assessed outcomes.

## Upgrade order

Upgrade the backend and UI before the collector. Older strict parsers do not accept the optional automation field. The upgraded collector performs one replay of retained history within its configured `since` window, with stable run/event IDs. Richer automation metadata survives recapture and native/T3 overlap. Existing runs without automation remain valid; no new table or schema migration is required. New ingestion maintains the existing indexed facet table for scheduled/task filters.

## Verification

From the checkout:

```sh
bun install --frozen-lockfile
bun run observatory:check
bun run observatory:lint
bun run observatory:build
bun run observatory:build:storybook
bun run observatory:test:e2e
bun run check
```

For the real reactive adapter, use an owned disposable anonymous local backend, following the [local Convex setup](observatory-evaluations.md#local-integration-proof). This fixture replaces that backend's auth and machine credentials with disposable synthetic values. Keep its development process running and execute:

```sh
bun packages/backend/scripts/verify-scheduled-local.ts
VITE_CONVEX_URL=http://127.0.0.1:3210 VITE_CONVEX_SITE_URL=http://127.0.0.1:3211 bun run --cwd apps/observatory dev --port 7412 --strictPort
E2E_TELEMETRY_DISABLED=1 bun x e2e run --config e2e.scheduled-local.config.ts
```

Use the backend's generated loopback URLs if different, and run the browser command in another terminal. The fixture rejects hosted or non-anonymous targets, ingests synthetic runs through SQLite and HTTP, authenticates the owner and confirms scheduled/history isolation and anonymous denial. Stop only these owned development processes afterward. Reports, local credentials and databases are ignored; retained review screenshots use synthetic Storybook data.

See the [behavior contract](../.astack/scheduled-tasks/behavior-contract.md) and [observed acceptance proof](../.astack/scheduled-tasks/evidence/proof.md). Production rollout is separate from this feature's local proof.
