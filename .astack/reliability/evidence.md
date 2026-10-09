# Reliability implementation evidence

Starting revision: `0ff54b0a15ab58fe5353f55175d5a9a62a28bbc5`. Scope and acceptance: [behavior contract](behavior-contract.md). Owner pilot: [new-repository validation](../../docs/agent-validation.md).

## Guidance and package checks

- `bun run check` passed with 122 declared routing examples, portable manifests, skill identities/UI metadata and local links. These are consistency checks, not 122 executed agent evaluations.
- `bun test scripts` passed: 15 tests and 56 assertions.
- Codex skill-creator `quick_validate.py` passed for architect, code-review, correct and agent-evaluation. The first attempt lacked PyYAML; a disposable Python environment supplied it, with no repository dependency changes.
- At final code revision `15205678043fa1883128a329480dd53faff415bc`, `bun run agent-evals:check` passed strict foundation and notebook types plus 34 tests / 694 assertions. Full foundation tests at the preceding `4278d37` passed: 60 tests / 789 assertions; the final focused run includes the added repeated-edit regression. Targeted ESLint and Prettier checks passed; the source and copied quality rubric match exactly. A whitespace-sensitive rubric test was corrected after formatting; the final checks passed.
- Deterministic CI covers package integrity, strict types and evaluator/process regressions without model calls. Existing foundation checks remain separate from root Observatory checks. The existing Vite warning about a future native configuration loader did not fail compilation.

## Independent guidance contribution

T3 task `astack-reliability-guidance-forward-review-20261009-r1` performed a read-only review and four forward exercises. The scoped bytes stayed fixed across HEAD advancing to `619860a`; the child recorded aggregate SHA-256 `cf7c3f79d7358c02527d57bcbed301f83e760f567ba8b25332602fb5e87d9843`.

- Retryable-export design: proposed durable operation identity, fenced attempts, atomic cancellation/publication and reconciliation, with product assumptions explicit. This was a design exercise, not implemented runtime proof.
- Save review: identified the missing persistent effect of returning an immutable changed snapshot; did not invent surrounding authorization or runtime behavior.
- Tiny CLI label: selected a narrow route, same-command observation and self-review without architecture, evaluation or extra tests.
- Experiment interpretation: retained 10/12 planned outcomes, activation failure and timeout, and kept uncalibrated quality unassessed.

The parent confirmed both findings: G1 needed a predeclared reviewer qualification rule, now in the rubric/protocol/calibration recipe; G2 linked a mutable external recipe, now a package-relative guide with a recorded-source requirement. Structural package checks passed after the corrections. This contribution establishes practical instruction use on these exercises, not an accuracy score or general software-quality improvement.

## Runner and fresh-repo observations

Before integration, the draft CLI created `/private/tmp/notebook-maintainer-seed-20261009` as its own Git repository. The parent opened its actual loopback app through T3 preview, created two Alice notes, clicked Done on the first, reloaded and restarted the owned service. The first record remained `done: false`, and the adjacent note remained unchanged. [The retained initial screenshot](evidence/seed-done-rejected.png) shows the still-open note; disk inspection confirmed the persisted value. The fixture is deliberately defective, so this is an expected baseline failure, not a harness completion claim. The draft external bug check also returned the expected failure (exit 1). This draft fixture observation is separate from the final pinned suite below.

## Independent integrated review and corrections

Read-only rounds at `542f8e19c1e2551d067de54f9c7849ee1ecbd194` confirmed four concrete issues. Parent adjudication and final regression results:

- P1: Editing only an open note let a status-resetting title implementation pass. The checker now edits a completed neighbor, checks response/fresh read/disk/restart and restores its title. The preserved wrong repair fails; the corrected implementation passes.
- P2: Manual feature/archive prompts omitted the checker's exact API semantics. The guide now specifies the PATCH alternatives and `?includeArchived=true`, with independent and sequential repository paths.
- R2-A: Create retry identity was untested after title edits. Legacy and newly created records now receive original-input retries and changed-input conflicts before/after restart. A mutable-title comparator fails; durable original-input metadata passes.
- R2-B: Whole-object disk equality rejected compatible internal metadata. The checker validates and compares every required persisted field/record while retaining raw bytes and hashes. The README declares compatible extensions and six-field legacy support. The positive metadata implementation passes; ownership, neighboring values and malformed required fields remain checked.

Round r3 at `4278d37` independently cleared G1/G2/P1/P2/R2-B and exercised compatible note-level and top-level metadata. Corruption of each required field, omitted fields and dropped/duplicated records failed. It confirmed R3-A: assigning original create title on every edit still passed the 59-case oracle, but two edits/restart made the original request return 409 and the intermediate input 200. [The literal counterexample](evidence/r3-repeated-title-counterexample.json) is retained. The parent independently reproduced this mutation on actual saved candidate source.

At `1520567`, final legacy original-input retries/conflicts and restored-completed-note retries run after the second edit/restore and final restart. The overwrite-identity regression fails and its corrected control passes. The manual guide repeats the original-input check after a second rename. A temporary isolated-worktree attempt could not resolve `react-dom/client` through reused dependency links; no check result was inferred from that setup failure. The integrated root checks above passed.

The bounded fresh independent recheck is T3 task `astack-reliability-integrated-review-20261009-r4-repeat-fix`, pinned to `15205678043fa1883128a329480dd53faff415bc`; its result remains pending during preparation of this record.

## First real controlled smoke and diagnostic replay

[The retained summary](evidence/smoke-summary.json) records all four planned attempts, hashes, observed usage, exact candidate installation and cleanup. Original raw evidence: `/tmp/astack-notebook-real-smoke-20261009-r1`. Environment: macOS arm64, Bun 1.4.0, Codex CLI 0.161.0, `gpt-6.1-sol`, `xhigh`, workspace-write. Each condition used the same neutral fixture, goals and 300,000 ms / 40-action limits; candidate `542f8e1` explicitly invoked astack, while the baseline disabled plugins. Residual system/managed/personal skills are not proven excluded.

| Attempt          | Agent result          | Elapsed / actions | Original HTTP check | Corrected diagnostic HTTP check |
| ---------------- | --------------------- | ----------------- | ------------------- | ------------------------------- |
| Bug / plain      | pass, completed       | 250,097 ms / 15   | pass                | pass (41 cases)                 |
| Bug / astack     | inconclusive, timeout | 300,065 ms / 24   | pass                | pass (41 cases)                 |
| Feature / plain  | inconclusive, timeout | 300,053 ms / 21   | fail                | pass (62 cases)                 |
| Feature / astack | inconclusive, timeout | 300,053 ms / 18   | fail                | pass (62 cases)                 |

The original denominator stays **1 pass / 4 planned, 3 inconclusive**, with no omitted attempts or model substitution. The feature failures were exact-disk false rejections of additive `creationTitle` metadata; neither output failed the corrected interactions. Diagnostic replay v2 at `4278d37` and final v3 checked the exact saved source bytes against original file/deliverable hashes in separate replay repositories. Final v3 used suite `60137a9b767554aaa2932b8047ae1cb1e16aea5c5d62af31cf4c168c42715fdd` at `1520567`; v2 remains in the raw history. Neither replay made new agent calls. Replay repositories have different Git/workspace identities; the rechecks do not change the original experiment or convert timeouts into passes. Original, diagnostic and committed diagnostic report/observation bytes were inspected with `verifyEvidence`.

Observed completed usage exists for the plain bug run; timeouts emitted no completed-turn usage. Missing usage and monetary cost remain unknown. Candidate installed bytes were verified, and command traces attempted astack/relevant skill-file reads; native skill selection or faithful instruction use is not established by the event schema. Craftsmanship stays unassessed. These results establish a working evaluation path and reveal a completion-budget concern; they do **not** demonstrate increased agent reliability, pstack parity or better code quality.

Compact delivery patches and four diagnostic report/observation pairs are retained beside the summary. Raw model streams remain in the disposable run directory. Exact originals are preserved; none were reformatted into different hashed artifacts.

## Running browser observation after agent delivery

The parent replayed byte-verified saved `1-bug-candidate` code in a separate Git repository. Through T3's actual browser it created two Alice notes, clicked Done, reloaded and restarted the owned loopback service: the target was completed and the neighbor stayed open. [The retained after screenshot](evidence/candidate-done-after-restart.png) shows that state. Clicking Reopen, reloading and restarting persisted `done: false`. A Bob PATCH returned 404 and a fresh Alice read was unchanged; repeated creates returned 201 then 200 with the same ID and one additional row. [Literal observations](evidence/browser-bug-observation.json) retain the responses and source provenance. All owned app processes were stopped.

The same browser also exercised byte-verified `1-feature-candidate` source: Tab/Enter opened the editor, whitespace submission showed a validation error without changing data, and Enter saved a trimmed title on a completed note. Reload/restart preserved its completed status and the neighbor. Original create input returned 200 with the same ID/current title, conflicting input returned 409, and Bob title edit returned 404 with a fresh unchanged Alice read. [The title screenshot](evidence/candidate-title-after-restart.png) and [literal keyboard/HTTP observations](evidence/browser-feature-observation.json) retain this focused path. The independent feature seed intentionally retains its unrelated status inversion; the observation records how the completed control was established. This is not a full accessibility audit.

This manual maintainer observation proves the saved bug delivery's browser path; it does not erase its agent timeout or establish owner acceptance of the intervention.

## Owner acceptance still to run

The owner follows the manual guide in a newly initialized repository, records their own browser/keyboard and direct HTTP results, and assesses supervision/usefulness. Human-adjudicated calibration, blinded craftsmanship grading, actual sequential fresh-agent maintenance and repeated comparisons are required before a broad improvement claim. Simulated actor ownership does not establish live authentication.
