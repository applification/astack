# Foundation feedback and hook proof

The disposable candidate passed the six feedback and Git-hook checks in [its compact summary](feedback-evidence/summaries/2026-10-04-candidate.json). The reference snapshot was `9c1a666867faffac745697945d498884776448b5` with source digest `2e6308bf8bc6ba52882866ec33df94e3e6f261e17e43980e35cec2b6dd625cad`. The only candidate overlay was `turbo.json`, recorded with its contents and digest. The summary also records the post-scaffold source digest, manifest digest and lock digest; the exact root manifest remains in the archived original report.

| Check                                                          | Observed result                                                                                                                         |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Quick feedback on a valid domain file                          | First run 3289 ms, including the initially missing embedded MCP resource build; repeat 1227 ms                                          |
| Quick feedback on an explicit floating promise                 | Rejected in 1262 ms with `@typescript-eslint/no-floating-promises`                                                                      |
| Affected checks after a shared UI source edit                  | Passed in 11117 ms; output confirms standalone web and MCP UI consumer typechecks                                                       |
| Repeated Turbo lint and typecheck                              | All 11 tasks hit the local cache in 83 ms after a 7969 ms population run                                                                |
| Shared compiler-config byte change                             | All 11 tasks missed in 7538 ms, with changed task hashes                                                                                |
| Valid staged edit with invalid unstaged lines in the same file | Installed Husky hook committed the valid edit in 2175 ms; committed source excluded the invalid lines and exact unstaged bytes survived |
| Staged floating promise                                        | Installed hook rejected the commit in 1650 ms; HEAD remained unchanged and staged data remained available                               |

The [first-failure summary](feedback-evidence/summaries/2026-10-04.json) retains the real cache failure: two unchanged Turbo runs missed all 11 tasks and changed every task hash. The reference used the recursive global input `packages/config/**`, which included the task-log directory alongside actual configuration. The [cache comparison](feedback-evidence/cache-comparison.json) preserves the later diagnostic's exact global inputs before and after the repeat, plus the original and candidate task hashes and HIT/MISS results. The repeat adds `packages/config/.turbo/turbo-lint.log` to the global hash. `turbo.json` now names `packages/config/typescript.json`, `packages/config/eslint.mjs` and `packages/config/package.json` explicitly. The successful candidate proves unchanged work is cached while shared compiler changes still invalidate every check.

A [separate diagnostic snapshot](feedback-evidence/summaries/2026-10-04-diagnostic.json) caught a shorthand void callback in the sign-in error handler; the reference fixed that callback before the successful candidate snapshot. The [later original-glob diagnostic](feedback-evidence/summaries/2026-10-04-original-cache.json) also retained a root-tooling lint failure in its newer source snapshot. Both diagnostic summaries remain marked failed; the candidate summary identifies the acceptance snapshot separately.

The summaries and cache comparison are explicitly labelled derivatives. [Key acceptance logs](feedback-evidence/README.md#key-logs) remain separately readable. All 126 original files are preserved verbatim in [the deterministic raw archive](feedback-evidence/raw-evidence.zip), with an [archive checksum](feedback-evidence/raw-evidence.zip.sha256) and [per-file manifest](feedback-evidence/raw-evidence.files.tsv). Curation changes presentation only; it does not alter the original measurements or run another acceptance gate.

Repeat the proof from an astack checkout:

```sh
bun scripts/prove-foundation-feedback.ts /absolute/path/to/astack /absolute/path/to/new-evidence-directory
```

The optional `--turbo-config /absolute/path/to/candidate-turbo.json` overlays only that candidate file inside the disposable scaffold and records it. The runner uses the real scaffold command, frozen installs, a local Git identity and installed Husky hooks. It retains sanitized command output, exit codes, durations, exact failure diagnostics and Turbo task summaries, then removes the disposable checkout.

The first Git baseline is committed before Husky is installed in the new repository. Both acceptance commits execute the installed pre-commit hook. Timings use fresh CLI processes and ordinary warm filesystem caches. The selected-file quick gate is narrower than affected checks. These probes verify the listed failure paths and partial-stage recovery, and make no claim about live WorkOS, a deployed backend, installed ChatGPT, remote caching, every lint rule, or every possible Git recovery scenario.

## Provisional local feedback budget

Use these thresholds to investigate slower feedback on this measured local setup. They are provisional budgets derived from the candidate observations above, with ordinary warm filesystem caches and fresh CLI processes. They are neither new measurements nor percentile guarantees, and do not transfer to CI or other hosts without measurement. “Cold” below means the embedded MCP resource is initially missing; no filesystem caches were flushed.

| Local case | Investigation threshold | Supporting observation |
| --- | --- | --- |
| Selected-file quick check with prepared outputs | 2 seconds | 1227 ms valid repeat; 1262 ms rejected promise |
| First selected-file quick check requiring embedded-resource preparation | 5 seconds | 3289 ms first run |
| Actual installed pre-commit check | 3 seconds | 2175 ms partial-stage commit; 1650 ms rejected commit |
| Affected checks after a shared-package change | 15 seconds | 11117 ms shared-UI consumer check |
| Unchanged repeated Turbo lint/typecheck with a populated local cache | 500 ms | 83 ms, all 11 tasks hit |

When a threshold is exceeded, inspect selection, output preparation and cache inputs, retain the observation, and revise the host-specific budget if evidence warrants it. Preserve correctness, consumer coverage and partially staged protection. The affected pre-push hook remains deferred; run affected checks before handoff and require integration checks in CI. Measure a small edit, shared change and configuration change again after tooling, package graph or host changes.
