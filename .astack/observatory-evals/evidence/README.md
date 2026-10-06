# Evaluation evidence and review

Feature sources: `24e178fa8790e5482f5fd28d9e46805b06e2b31b`. Observed on 2026-10-06 in the isolated `t3/observatory-evals-viability` worktree on macOS, Bun 1.4.0, e2e 0.15.1 and Chromium. The backend was an anonymous, disposable local Convex deployment on loopback ports 3210/3211; Vite used port 7410. No production telemetry or Otis credentials were used. Owned dev processes were stopped after verification.

The owner later requested deployment to Otis. [Deployment proof](otis-deployment.json) supersedes the initial rollout/runtime gaps below. Revision `37a3c0c` is deployed; the backend was pushed before the UI and signed collector. Recovery files and a private database export were preserved. The signed compiled CLI checks/imports a review manifest successfully; owner/scope/evidence reads and anonymous assessment denial pass. Served HTML/JavaScript match the build. All six deployed browser journeys pass, including the evaluation review form, exact original-request trace expansion and narrow layout. The eligible queue was empty at the final observation, and project/source/forwarding health was good. T3 collaborative preview also inspected the live page successfully.

One review item references the actual three captured planning/implementation turns and their original request. Its supplied report is assembled from the retained local observations, with that provenance explicit. Evidence bytes live independently of the worktree in the private runtime review directory. No synthetic runs or owner judgments were added. Only sanitized deployment facts are retained here; live raw reports and credentials remain private.

## Observed results

- `observatory:check`: strict types; 85 tests passed, zero failed (domain, collector and native Convex integration).
- `observatory:lint`, production build, Storybook build and root `check`: passed. Storybook reports its existing large preview-bundle advisory.
- CLI compile: passed. Compiled runtime smoke checks are unverified: this Mac killed both `--help` and the fixture command with exit 137 before output. All three documented Bun source CLI demo commands exited zero and produced actual fail/pass/inconclusive reports; these are repository fixtures, not agent trials.
- Final Storybook e2e: 25 passed; final authenticated local e2e: 3 passed. Neither run retried, skipped or classified a case as flaky. [Browser summaries](browser-runs.json) retain runner IDs and counts; full reports remain ignored.
- Local backend proof: real fixture reports imported through the SQLite queue and authenticated HTTP ingestion; owner assessments persisted, fresh reads matched, and anonymous reads were denied. [Local proof index](local-proof.json) maps each report's original artifact reference to retained identical bytes. These reports predate the feature commit and declare their dirty source identity rather than pretending to be clean-commit proof.

## Selected synthetic captures

[Desktop evaluation](evaluation-failed-light.png) shows intent linked to captured work with separate verification and assessment labels. [Narrow dark proof context](evaluation-failed-narrow-dark.png) shows long revision/digest values wrapping within 390px. [Owner assessment](evaluation-owner-assessment.png) shows a saved review with explicit reasons and citations. These captures use synthetic stories; they do not establish authentication or persistence. The local browser assertions establish those separately.

## Review and first failures

Intent review: A1–A5 are covered, capture/run outcomes remain unchanged, and evaluations neither dispatch agents nor own task lifecycle. Skill assessments are explicit owner judgments of declared criteria; synthetic skill traces cannot establish real skill effectiveness. Automatic judging, capture handoffs, hosted artifacts and controlled trials remain later work.

Applied the `convex:convex-reviewer` security, performance, schema and type-safety checklist to the completed change. Public operations require the sole owner; ingestion remains machine-authenticated/internal; portable IDs follow the existing collector identity contract. Indexed reads, bounded pages/snapshots and deterministic queries preserve native Convex reactivity. No independent reviewer agent was used.

Confirmed findings fixed:

- Recent-first queue order could upload an evaluation before an older referenced turn. Evaluations now wait for acknowledged turns and original prompt; both ordering policies are covered.
- Stored enrollment alone could outlive a project folder-policy change. Import/forwarding and backend ingestion recheck current policy; the stale-policy regression is green.
- Strict assessment-input parsing rejected an idempotent saved review containing stored metadata. Replay compares only the original input fields; identical and altered retries are tested.
- Expanded proof context overflowed a narrow viewport. Values now wrap; the exact context and assessment-form checks pass at 390px.
- Request trimming could break an exact captured-prompt reference. The original text, including surrounding whitespace, is preserved through queue/backend snapshots.
- A detail read could accumulate large cited-event snapshots across reviews. Each assessment is bounded to 128 KiB, input to 64 KiB, history to the latest 20, and evaluation/run-source snapshots to 128/512 KiB. Oversized evidence is rejected atomically.

[First failures](first-failures.json) preserves the original narrow-width and locator failures plus the authenticated-capture policy denial. The original raw runner directory was overwritten by reruns; only these decisive sanitized observations survive here. Later passes do not erase those failures. No unresolved confirmed defect remains in the delivered cases.

## Boundaries and gaps

Reports are supplied observations, not authenticated certificates. Artifact bytes are retained by verification and referenced by Observatory. Assessment history is immutable, with the latest 20 shown. Every declared case is material; missing proof stays inconclusive and a retry pass stays flagged flaky. A revised manifest/proof needs a new UUID.

Upgrade the backend before using evaluation records and retain the upgraded collector for queue replay. The first implementation pass performed no deployment; the subsequent owner-authorized Otis rollout is recorded above. No merge was performed. The initial local T3 preview gap and compiled runtime smoke gap are superseded by the observed Otis preview and signed CLI checks. Authenticated captures were disallowed by runner secret policy; retained captures remain synthetic.
