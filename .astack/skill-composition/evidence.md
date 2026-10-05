# Independently callable skills: observed evidence

On 5 October 2026, PR 18 replaced reference-only workflow packaging with 16 independently callable skills and an astack coordinator. The [predeclared contract](behavior-contract.md) defines C1–C7. [Machine-readable observations](observations.json) retain source, installed bytes, fixture revisions, selected output hashes, usage and elapsed time. Raw events, prompts, workspaces and full checks remain ignored under `.proof/skill-composition/`.

## Candidate and environment

The tested source is `7d9adc97629ded1bac9cd9ea94d6de07bf9709c1`. A `git archive` snapshot supplied a unique local marketplace; native `codex plugin add` and list succeeded. Every installed plugin file hash matched the snapshot. The installed manifest digest is `60369ff7820f22f1fe988e9b5cc1765cec5e4c11f41a19c343fa83c81e52dd08`; its algorithm and component hashes are in observations.json. No adapter or uncommitted plugin change was used.

Fresh ephemeral Codex CLI 0.160.0 processes used the owner's configured `gpt-6.1-sol` with high reasoning, explicit candidate-only plugin configuration, and no subagent delegation. Parent tooling used Bun 1.4.0 and Node 22.14.0; the agent's login shell reported Node 24.21.0. Fixtures ran locally on Darwin arm64, without providers or remotes. Each had one writer, a five-minute/30-tool-action limit, and at most two processes ran concurrently. All six processes completed normally without candidate loading errors. A state-database discrepancy warning appeared in startup output; no delivery interruption was observed. Token usage is recorded; monetary cost was unavailable.

After inspection, the owned marketplace plugin was removed; its config entry and installed cache were confirmed absent. Existing installed plugins were preserved. Local fixtures and raw evidence remain ignored for inspection.

## Actual delivery observations

The common fixture has two reservations on the same visit, owned by Alice and Bob. Cancellation first checks the selected reservation's owner, then incorrectly filters by visit. Existing tests require cancellation to retain the other reservation and reject another owner's attempt. The [selected fixture and output](trial-excerpts.md) makes the failure and correction inspectable.

| Case | Invocation and observed result | Time / tool actions |
| --- | --- | --- |
| C1 | A fresh catalog request advertised all 16 candidate skill names/descriptions without reading files. Installed bytes matched source. | 22.2s / 0 |
| C2 | Direct show-me read its installed skill and real source, returned a four-line text flow showing the visit-wide removal, and reported 1 failing/1 passing test. Git remained clean. | 22.1s / 4 |
| C3 | Direct domain-modeling read its installed skill, added only the agreed Guest definition to the existing glossary, identified the single-reservation/whole-visit contradiction, and returned the product choice unresolved as requested. Runtime and test expectations were unchanged; the existing failure remained visible. | 37.8s / 6 |
| C4 | Direct verify read the installed skill and proof policy, ran the specified tests, reported 1 pass/1 fail with revision/environment and limits, and made no changes. A completed verification result honestly contained failing product proof. | 32.5s / 4 |
| C5 | Direct pr inspected the supplied one-predicate diff, observed parent 1 pass/1 fail and current 2 passes, and wrote only the authorized local PR-DRAFT.md. It explained the owner boundary, caller-supplied identity, absent persistence/integration and unverified duplicate IDs. | 79.5s / 6 |
| C6 | An astack request selected the bug-fix route and explicitly read installed bug-fix, verify, pr and capability/proof guidance. It observed the original failure, changed only the filter predicate, reran unchanged tests to 2 passes, and wrote a local PR description. Additional owner/preservation assertions passed. No delegation or remote publication was needed. | 98.0s / 8 |

These are passes for the named rubric cases. The evaluator inspected actual diffs and reports, confirmed unchanged test expectations, and independently reran the C6 tests: 2 passed, 0 failed. Each task excluded remote creation, publication and external messages; the retained traces contain no such actions. The local PR descriptions explicitly label proof limits and non-independent review. There was no delivery retry or intervening candidate change.

## Source assessment and packaging

C7 has source assessment, not live platform delivery proof. An independent read-only assessment compared the relocated setup, control, web, MCP, ChatGPT and cloud procedures with the previous source and checked 149 local Markdown links/anchors. It found no unresolved actionable issue after fixes. Earlier findings were material: direct verification could inherit automatic PR publication from nested proof policy, failure completion wording was ambiguous, and one moved control ownership anchor was wrong. Those were corrected before freezing the installed candidate. Direct change skills also select affected platform guidance before edits; bounded contributions return when their caller owns integration.

All 16 skills passed the skill-creator validator. Six packaging regression tests passed, including distinct matching identities, missing composition targets and links escaping the portable package. `bun run check` passed with 89 site/routing examples and seven routes. These establish package and source consistency, separately from the delivery observations above. The website's skills catalog was inspected rendered at desktop size; this was a focused readability observation, not a cross-device product trial. Pen/Storybook were unnecessary for instruction relocation and the existing site's catalog change.

Later commits change reports, source links, the ADR register and site documentation only; the installed plugin bytes remain those tested above. CI status belongs to the submitted PR revision and is reported separately at the PR destination.

## Remaining milestones and limits

Only these focused direct/composed cases ran. Advertising 16 skills does not prove delivery through all 16, and the small in-memory Node fixture does not establish the full React/Vite/Convex/WorkOS/MCP foundation loop. PR 17's specialist roles, COS-shaped assignments, portable contracts, findings resolution and host integration still require reconciliation and delivery trials after this architectural correction. Composition can be sequential; subagent behavior was not exercised here.

Repeat the foundation feature/bug trials with corrected verified activation. Manual G1 Hosted AuthKit, G2 real MCP OAuth/same-user continuity, H1 installed ChatGPT, the initial unexplained typed-lint failure, image-inspection traceability and actual cloud transition remain recorded gaps. Emulate, disposable real WorkOS Staging and installed/manual host acceptance remain distinct. Apps remain local until the owner chooses hosting; no shared test account was created.

The later host/durable-work choice remains hand-rolled Codex or T3 Code, subject to capability investigation and agreement. Slack is excluded, Dots unavailable, and Loami is one possible adopting project among many, with no astack dependency on its readiness. PostHog and scheduled gardening remain deferred. PR 18 remains unmerged pending owner approval.

## Later consolidation and metadata revision

The owner subsequently directed migration of PR 17 into PR 18 and complete metadata for every skill. The trial source above is retained as historical evidence; new plugin bytes and consolidated handoffs require their own activation/assessment. See [consolidation evidence](../consolidation/evidence.md) for that later revision.
