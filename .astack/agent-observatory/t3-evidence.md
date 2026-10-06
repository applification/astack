# T3 capture evidence, 2026-10-06

Implementation revision: `c77cc2cab9f5fd81f1002ab1b258964ee030496d`. Environment: Otis, macOS `27.0.1`, arm64, Bun `1.4.0`; dependencies installed from the frozen lockfile. Later proof-only documentation does not change the tested implementation. The [contract](behavior-contract.md#t3-provider-capture-2026-10-06), [source research](research.md#t3-multi-provider-source-2026-10-06) and [operator setup](../../docs/agent-observatory.md#optional-multi-provider-t3-capture) distinguish fixture proof from installed-host proof.

| Case         | Observed result                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T3-READ      | PASS against real loopback HTTP/WebSocket fixtures: bearer authentication, protocol header, ticketed read RPC, archived enumeration and full-item output recovery. An environment mismatch makes only the public descriptor request before failing. Unsafe origins, exposed credential files and private HTTP error bodies are rejected/sanitized.               |
| T3-PROVIDERS | PASS: Claude, Codex and another driver normalize into the shared envelope; account/environment scope separates non-Codex identities. The complete collector forwards native Codex and T3 Claude through the existing native Convex HTTP handlers in `convex-test`. Fresh owner queries return Claude runs and both agent filter choices.                         |
| T3-NATIVE    | PASS: both capture orders retain one canonical Codex run, the original event set, work association and assessed outcome. Multiple provider turns do not repeat the run-scoped prompt. Weak native identity produces no provisional run, reports deferral, and retries an unchanged completed thread. A missing T3 credential leaves native capture healthy.      |
| T3-POLICY    | PASS: empty/paused policies make no T3 connection; unmatched threads are not read in full. Archives are collected through their separate read. Removed worktrees can match reported repository identity, and a fork does not inherit upstream enrollment. Checkpoints advance after durable persistence, and replay deduplicates observations.                   |
| T3-PRIVACY   | PASS: synthetic bearer values disappear before queueing/forwarding; metadata-only replay removes readable content with stable IDs and first-observation times. Reasoning and secret-request records remain absent. Completion leaves outcome unknown. Failed `Read` tools, including completed tools returning `isError`, do not create capability-use evidence. |
| T3-SETUP     | PASS against the OAuth fixture: pairing requests exactly `orchestration:read`, validates reads and saves a mode-`0600` bearer file. Fresh config/checkpoint reads preserve native homes, credentials, capture settings and checkpoints. Legacy configurations default to no T3 sources.                                                                          |
| PORTABLE     | PASS: compiled and ad-hoc-signed macOS executable performs the same two-source capture, native Convex forwarding/query and source-outage assertions. It runs independently of source modules. Binary SHA-256: `0ad803e28f99c49601f7fb571693651f2afa32234c2c52575f523991fc3df6bf`.                                                                                |

`bun run observatory:check` passed typechecking and **66 tests / 408 assertions**. `bun run check` passed site and portable-plugin checks. The compiled route passed **13 T3 tests / 94 assertions**:

```sh
bun run --cwd packages/agentlog build
codesign --force --sign - packages/agentlog/dist/agentlog
AGENTLOG_PORTABLE_BINARY="$PWD/packages/agentlog/dist/agentlog" \
  bun test packages/agentlog/src/t3.test.ts
```

The unsigned macOS binary initially exited `137`; applying the same ad-hoc signing step used by the existing installer resolved that host prerequisite. Early test failures came from incomplete native fixtures and an oversized facet-query page; those fixtures were corrected. No product failure or flaky regression remains in the final checks. Raw final logs stay ignored under `.proof/`; the decisive assertions are retained in [t3.test.ts](../../packages/agentlog/src/t3.test.ts).

## Installed-host boundary and remaining proof

The installed T3 public descriptor reports `0.0.46-nightly.20261005.2702`, protocol `2`. A read-only, in-memory probe of this task's stored projection passed the adapter schema: **5 runs, 5 provider turns, 208 items, Codex driver**. No message/tool content was retained in reports, and the production collector does not access T3's database. This probe establishes stored-shape compatibility only; it does not establish authenticated HTTP/RPC delivery.

Authenticated capture from the installed T3 server and a real Claude session are **inconclusive** because an owner-issued read grant is not available. No grant was created, runtime configuration changed, collector deployed or provider execution modified. Keep the PR in draft until an owner grants `orchestration:read`, configures the source, and a real T3 Claude turn is freshly read from Observatory with native Codex still capturing. Protocol fixtures, the compiled executable and in-memory Convex observations do not replace that installed-host check.

UI media, Pencil, Storybook and browser tests are not applicable to this collector/configuration-only change. No UI layout, client subscription, backend schema or Convex implementation changed. Existing provider-neutral query/facet behavior was exercised through a fresh backend read. Coverage remains limited to T3-recorded supported items; standalone Claude history, provider-native facts absent from T3, token accounting and histories exceeding the 32 MiB response budget are not claimed.
