# e2e proof reference

This example exercises astack's verification policy with real Chromium and no model calls. It uses a tiny unstyled disposable app with defective and fixed variants. Selecting the already-selected Idle state should pause playback. The defective variant returns early; the fixed variant pauses. Both use the same actions and outcome assertion.

From this directory:

```sh
bun install --frozen-lockfile
bunx --no-install playwright install chromium
bun run typecheck
bun test src
bun run verify
```

On Linux, install Chromium system dependencies with `bunx --no-install playwright install-deps chromium` if needed. The pinned compatibility set is e2e 0.15.1, @e2e-dev/web 0.11.1 and Playwright 1.63.0. Upgrade them together only after checking compatibility and revalidating report fields. No optional model provider or subscription is installed.

`verify` performs these checks:

1. Run an isolated probe against the defective variant. Confirm exactly one test failed on its body assertion, without setup/run errors or model judgments.
2. Rerun with `--last-failed` in a new directory. Compare every original report/artifact digest to prove the first evidence survived and record `rerunOf`. An invalid-target rerun also proves its selection seed is kept separate from fresh evidence when startup fails.
3. Run the retained regression against the fixed variant. The same repro now passes.
4. Serve an intentionally wrong run identity. The setup assertion fails; it cannot confirm a product defect.
5. Interpret a [sanitized recorded exploration report](fixtures/README.md) that exited zero with a failed step and no findings. Keep it inconclusive.

The expected failures are part of `verify`; the command itself fails if any expected observation differs. `bun run test:e2e` runs only the passing regression against the fixed variant. The probe remains outside that suite. The reference keeps both declarations to demonstrate promotion while sharing the unchanged repro body; a real product moves the fixed probe into its suite and removes the duplicate declaration.

Raw evidence lands in distinct `.e2e/runs/<mode>-<uuid>/` directories. `identity.json` records the full commit, dirty state, digest of source/config/test/lock inputs, run ID, variant, actor/fixture and rerun lineage. The server returns run/source identity headers, checked before each interaction. The runner owns an ephemeral loopback server and browser; e2e disposes them on exit. `.e2e/verification.json` links acceptance outcomes, candidate/confirmation/fix/regression history and original evidence digests. Raw files remain ignored; retain selected sanitized evidence in the feature folder for review.

`src/report-policy.ts` is deliberately a project-owned adapter for one selected test/target and the pinned framework version. It refuses missing/unknown reports, setup or locator failures, mixed model steps, ambiguous selections and inconsistent statuses. Its pass interpretation relies on the identity assertions in `tests/helpers.ts`; a report parser alone cannot establish server identity or that an assertion matches a candidate. A retry pass records a passed latest observation, preserves flaky status and leaves readiness false.

The browser tests verify visible interaction, not animation stability, persistence or authorization. The exploration fixture checks report interpretation, not live exploration quality. Authenticated state, native mobile, actual Codex MCP configuration loading and subscription-backed charters require separate trials. The reference server is a teaching fixture, not astack's greenfield product scaffold or a universal app driver.

For product setup, use [the e2e workflow](../../plugins/applification/skills/astack/references/e2e.md) and the installed version-matched e2e skill. Keep existing working runners; backend, protocol and installed-host checks retain their own proof routes.
