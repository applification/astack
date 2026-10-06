# Remembered login and Claude CLI versions

Owner request: show the Claude **CLI** version alongside Codex and remember the personal access key through refreshes and deployments. This explicitly supersedes the earlier preference-only localStorage policy in the [Observatory contract](../agent-observatory/behavior-contract.md).

Implementation: `bad82135337f49b88c785c40ba4c049481ada5ab`, based on `6e50980`, on Otis/macOS arm64 with Bun 1.4.0. The production frontend and collector were deployed on 2026-10-06; live verification is recorded below.

- **Remembered login — pass:** the real authentication hook and production login form run in Strict Mode against a synthetic session endpoint. Successful login stores the trimmed owner key, reload sends it to obtain a fresh session, and the JWT is absent from localStorage. Rejected saved keys are removed and can be replaced; a temporary outage retains the key, and restricted storage permits an in-memory session.
- **CLI provenance — pass:** native version lookup requires a strong T3 Claude session identity, matching working directory and user/assistant records in that provider turn's time interval. Resumed sessions across upgrades retain the appropriate version per turn; conflicting records clear a prior version. Missing logs, malformed/model values, weak identities, symlink escapes and files over 32 MiB stay unknown. Native message content is not imported.
- **Replay and integration — pass:** the previous checkpoint format replays once, then remains stable. Enrichment preserves the original run and event IDs, and a captured version survives later log removal. Complete collector capture and native Convex ingestion return the CLI version in a fresh owner query and version filter choices; native Codex remains available through a T3 outage. The signed portable binary passes the same collector integration.
- **Installed source — pass:** a read-only authenticated T3 projection plus its matching native transcript normalizes the reported Claude turn to version `2.1.291` with 11 events. The isolated probe queued zero records. The subsequent production rollout also confirmed this version in the live runs table.

Observed checks: strict types and the full domain/backend suite passed **71 tests**; the final focused collector/version suite passed **17 tests / 113 assertions**. UI lint, production UI build, Storybook build and site/plugin checks passed. The signed portable route passed **14 tests / 105 assertions**. The browser suite passed **18 tests**, with a final single-test capture confirming the full version table. Raw reports remain ignored under `.proof/claude-cli` and `.e2e`.

One intermediate test used a forbidden direct password-value assertion (`POLICY_DENIED`). It was corrected to assert that the retry button remains enabled after a rejection, without reading the password. This was a test-API error; no product failure or flaky test remains. Initial checks required installing the frozen dependencies. The collaborative browser could not reach the local fixture server; the project's existing e2e runner supplied the retained screenshots instead.

Pen was skipped because this preserves the existing layout and adds one explanatory login sentence. Storybook was selected to check the real form/hook lifecycle and known/unknown version rows. Both retained images contain synthetic data; the runner masks the password input even when empty.

![CLI versions, including Codex and unavailable Claude metadata](claude-cli-versions.png)

![Login explains that the key is remembered](remembered-access-login.png)

The implementing agent applied the installed Convex reviewer checklist to the completed client diff and existing session/ownership consumers. No unresolved findings: the server verifies the owner key and issues short-lived JWTs; native Convex authentication and per-operation owner checks remain authoritative. No schema, public function, validator, index or query changed. This was self-review, not independent review.

Production rollout on Otis used the implementation revision above, a frontend built with the existing Otis backend URLs, and an ad-hoc signed portable collector. The served HTML and JavaScript match the build byte for byte; the installed collector matches the signed candidate. The web server was reloaded and the launchd collector restarted, with recovery copies under the runtime's `backups/login-version-20261006T174924Z`. Native and T3 source health and forwarding are `ok`, with zero pending records.

- Served frontend: `/assets/index-CqIfzoXj.js`, SHA-256 `f8ca3b50c7611755e43efbe45cd7b7555fa2cd9f4b73da10aaad4db1706526a2`.
- Installed collector SHA-256: `d47cbd33b41e416d032a638dec2c7ec5f210d6a33bfb98d53e67592b3d43956a`.
- **Live owner journey — pass:** the targeted installed e2e test signs in through the production form, confirms the saved access-key entry, reloads, restarts the browser with its stored state, and confirms the authenticated runs table without another login. The Claude filter then shows `2.1.291 · Otis`. One test passed on `private-otis`; report `.e2e-live/report.json` remains ignored. The owner key came from the existing private key file through the runner's secret channel. No live screenshots, traces, videos or key values were retained.
- The shared collaborative preview loaded the same new frontend and the remembered-key explanation. An initial sign-in in each browser profile seeds its saved key.

The collector's checkpoint revision handles existing T3 history without new run IDs. The optional `claudeHome` setting supports the native transcript directory; additional per-provider custom homes and standalone Claude trace capture are outside this change. The [operator documentation](../../docs/agent-observatory.md) describes persistence and provenance limits.
