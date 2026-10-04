# Foundation iteration evidence

Initial implementation candidate: `baa74729f5c2b120be549d82177a92ca0ee9d41e`. Later repairs change scaffold path protection, hook setup, source identity and trial orchestration/retention; application/backend behavior remains the same. The repaired candidate is validated and recorded separately. The original baseline is `f29f52dc5ee5b73feb1b24d301cb61f1a578549f`.

## Observed checks

| Contract | Observation |
| --- | --- |
| F1 — repeatable scaffold | The scaffold installs from its frozen lock, excludes credentials/local databases/generated output, and refuses existing destinations. Three root scaffold tests passed on repaired candidate `fd05fc1`; they were added after the initial `baa7472` implementation. |
| F2 — enforcement | Fifteen representative compiler/lint probes passed, including intentional promise, unsafe-type, accessibility, hook and resolved-import boundary violations. These probes cover adopted detectable rules; semantic composition and test quality require review. |
| F3 — feedback and hooks | Quick and affected checks, real installed Husky hooks, partial-stage preservation, rejected invalid commits, warm Turbo cache and compiler-config invalidation passed. [Feedback observations](feedback-proof.md) and [eight hook repair cases](hook-repair-evidence/README.md) identify their separate source snapshots and retained first failures. |
| F4–F6 — running product | Independent disposable Convex + Chromium proof passed R1–R8: web create, fresh persistence reads, done/reopen through web and MCP, owner/authentication denials, MCP contracts, host styles, teardown/remount and no uncaught App errors. This is local AppBridge evidence. |
| F7 — WorkOS | Official web and MCP provider wiring is implemented. The [dedicated WorkOS sandbox](workos-sandbox.md) has verified redirects, CORS, CIMD/DCR and public discovery. Live login, consent, refresh and exact-resource tokens remain unverified. |
| F8 — fresh-agent delivery | The [first creation attempt](delivery-evidence/README.md) was partial and scored 10/12; its trusted product acceptance passed. The remaining stages were interrupted by an initial-commit hook failure. Two concurrent repeat rounds started against repaired candidate `fd05fc1` with the unchanged [predeclared rubric](trial-rubric.md). Results are pending; no delivery-trust claim is established yet. |
| F9 — compatibility | Root plugin/site checks passed all 70 routing cases. Existing ChatGPT-plugin checks passed typecheck/build and 15 tests/90 assertions after building required assets. Existing e2e-proof checks passed typecheck and 20 policy tests/45 assertions. |

`examples/foundation` passed `bun run check:ci` on the implementation candidate: formatting, typed lint, strict types, 18 tests/43 assertions, and web, MCP UI and Storybook builds. The independent final review found no actionable findings at that candidate. [Portable readiness records](readiness-evidence/README.md) preserve its original reports, screenshots and runtime log with checksums. Local evidence also remains under `examples/foundation/.proof/independent-review-baa7472` in the implementation worktree.

The repaired trial candidate is `fd05fc1b3c2f0f7aafbc638efc37f20f6d5b3105`, with profile source digest `e73435915cd35743e8fd06baf7fddaf3d9d32626d93a9d7e826f3468da2bc617`. Its full foundation check passed formatting, typed lint, strict types, 28 tests/1103 assertions and all three builds. Root checks passed six tests/24 assertions and all 70 routing cases. Assertion totals include artifact-dependent hash checks. Fresh review found no remaining actionable repair defects after correcting diff-byte acquisition, final JSON sanitization, binary omissions, hook setup and scaffold path protection. These observations are separate from the initial implementation and do not change its trial score.

The independent readiness build identity is `baa74729f5c2b120be549d82177a92ca0ee9d41e@sha256-ab3aad4cc7d5b3bb23c64748abbe1d649efd50ffcfd4aee2fdf521662fc72e6e`. It uses disposable signed identities, separate web/MCP audiences and a real local Convex deployment. Cleanup completed. Initial and updated host fonts/colors, two teardown acknowledgements, four closed owned connections and a fresh remount were observed. Unsupported SSE GET requests returned the intended 405; no uncaught App errors were observed.

## Delivery-trial identity

The first runner used Codex CLI `0.160.0`, configured model `gpt-6.1-sol` with `ultra` reasoning, Bun `1.4.0` and Node `24.19.0`. It installed an exact committed plugin snapshot with installed-files digest `b35a05602dac11476d6c8b9df067fabfaef2b02d5ecb8b497ee2ff4c3e82ea6a`. The delivery shell selected Node `24.21.0`; both satisfy the profile's Node 24 requirement. Rubric digest: `8aa129b3809a7e2da895c0d51fb16e3dac8194b2f57d59290974a41068ea6bdb`.

Each task and reviewer is a fresh ephemeral process with a separate disposable project, a 20-minute deadline and 80-action cap. Trusted acceptance runs the committed verifier against delivered source before independent scoring. The feature contract includes web/MCP title editing, persistence, empty-title denial and cross-owner denial. The bug seed must first fail the persisted status check. Prompts, JSONL events/observed token usage, delivered source and diffs, acceptance, independent scores and interventions are retained. Monetary cost is unavailable and remains null. Original records remain in `examples/foundation/.proof/delivery-baa7472`.

The first creation agent accurately returned partial because workspace-write denied Chromium, process inspection and Git metadata operations. A separate trusted verifier subsequently passed R1–R8 against the exact delivered input digest. The independent reviewer found no authorization defect, but identified nested-hook routing, unavailable-process-enumeration handling and source-retention corruption. The next-stage initial commit also reproduced ignored generated-file warnings and missing embedded-resource preparation. The runner retained the interrupted project, removed its temporary plugin and deleted its disposable directory. Those observations are retained rather than relabelled as a pass. A repaired candidate and explicit delivery permissions will be recorded for the repeat; it cannot be directly compared with this different environment/candidate.

## Remaining external proof

Live WorkOS sign-in/refresh/subject continuity and installed ChatGPT OAuth/tool/UI behavior were skipped, explicitly recorded as G1 and G2. A real public HTTPS MCP endpoint is still needed before configuring its exact WorkOS Resource Indicator and testing the provider flow. Sandbox configuration and local JWT boundary checks do not establish those outcomes.

The branch is intended for owner review as a draft PR. No merge, release, production deployment, COS, Slack or PostHog integration is included.
