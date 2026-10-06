# Observatory evaluations: first delivery

The owner wants to assess original intent, skill application/output and engineering outcome using captured agent work and the project's verification loop.

An evaluation is an immutable snapshot of declared intent, acceptance cases, relevant captured runs and a structured verification report. It references existing work; it does not own tasks or dispatch agents. A later scope/proof revision creates a new evaluation. Reports are supplied observations, not independent certificates. Owner-authenticated assessments cite evidence and remain separate from machine capture and run completion.

## Acceptance

- A1: Import a versioned JSON evaluation through `agentlog`; preserve redaction, offline durability, retry idempotency and enrolled-project/machine boundaries. Reference multiple captured turns without changing their outcomes or traces. Reject altered reuse of an evaluation ID.
- A2: Distinguish a reported passing repair, failed repair and missing proof. Missing cases, setup failure, skipped checks, missing required independent observations and retry passes cannot become a clean pass. Reports name revision, dirty/source identity, target, actor, fixture and retained artifact references.
- A3: The owner can assess intent, declared skill criteria and outcome with reasons and valid evidence references. A skill read alone never establishes application; machine ingestion cannot impersonate an owner assessment. A passing outcome requires sufficient reported proof plus owner review. Preserve immutable review history and captured evidence snapshots.
- A4: Observatory lists evaluations within project scope and shows request/clarifications, acceptance results, declared skill criteria, captured-run links, proof references and assessments. Loading, empty, pending, failed and inconclusive states remain distinct. Support narrow/light/dark views.
- A5: A disposable saved-edit fixture drives the same save/reopen/fresh-read path for defective, repaired and unavailable variants and emits genuine verification reports. Use those reports in domain, ingestion and browser checks; no model calls or production telemetry in retained media.

## Design and proof

Pencil skipped: reuse existing Observatory navigation, table/detail layout and design tokens; no new visual direction is required. Storybook selected: synthetic success/failure/inconclusive and review interaction states exercise the production presentation component. Real data claims require native Convex permitted/denied tests and a local backend/browser path, separate from stories. Retain selected synthetic screenshots.

Apply the existing TypeScript, React, Convex, verification and reviewer skills. Checks: strict types/domain/collector/backend regressions, UI lint, production/Storybook builds and deterministic e2e. Exercise a disposable local Convex deployment; no Otis deployment or merge is authorized. Controlled agent trials, model grading and aggregate skill comparisons follow after this slice.

## Results

Implemented and verified locally. Feature code is retained at `24e178fa8790e5482f5fd28d9e46805b06e2b31b`; the checks ran on the corresponding feature sources before commit. Fixture reports name the then-current base revision `255971c256d8bb967daffcdc53b540b9ef0ceb69`, dirty state and a source digest. [Evidence and review](evidence/README.md) records the observations, first failures, retained artifact mapping and limits.

| Case | Result | Observed proof                                                                                                                                                                                                  |
| ---- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1   | Pass   | Queue restart/redaction, immutable-ID and capture-policy regressions; dependency ordering before upload; local SQLite → HTTP → Convex import of two captured turns.                                             |
| A2   | Pass   | Genuine defective/fixed/unavailable reports yield fail/pass/inconclusive; domain checks cover absent cases/artifacts/independent observations, skipped checks and retry passes.                                 |
| A3   | Pass   | Native Convex permitted/denied, evidence existence, version, immutable snapshot and request-ID regressions; authenticated browser assessment survives reload.                                                   |
| A4   | Pass   | 25 synthetic component/browser checks, including evaluation states and rejected-write drafts; local browser verifies real persisted detail, original-request expansion and narrow context/form layout.          |
| A5   | Pass   | All three disposable services run save/reopen/fresh-disk assertions; reports and observations survive scratch cleanup and are retained here. Source CLI commands also generate all three variants successfully. |

Strict types and 85 unit/integration tests pass. UI lint, production build, Storybook build, root checks and CLI compilation pass. The final browser runs have no failures, retries, skips or flaky cases: 25 Storybook and 3 authenticated local tests. The Convex reviewer checklist was applied; confirmed findings are fixed with regression proof. No known unresolved defect affects A1–A5.

The owner subsequently authorized Otis deployment. Revision `37a3c0c` is live with the backend upgraded before the UI and signed collector. [Otis proof](evidence/otis-deployment.json) records successful signed CLI check/import, live owner/anonymous/project-boundary checks, exact served build bytes, healthy source/forwarding status and six deployed browser journeys. The review item uses three actual captured turns and retained proof; deployment added no owner assessment. The earlier compiled-runtime gap is resolved by the signed build. The disposable proof demo remains a source-checkout command.

Remaining limits: explicit manifests and human assessments are the delivered workflow; no autonomous agent trial or model judge. T3 preview failed during the initial local proof, but opened and inspected the actual Otis deployment successfully in the authorized follow-up. Authenticated runner screenshots were denied by its secret policy, so retained media uses synthetic Storybook data. No merge was performed.
