# Tester Army e2e proof loop

Use [Tester Army e2e](https://e2e.tester.army/docs) for repeatable running-app verification in new astack web projects, or when an existing project adopts it. Existing projects keep working runners unless a migration is requested. The shared loop is discover → reproduce → fix → retain regression; e2e implements the web checks, live inspection and exploration. Backend, MCP, native mobile and installed-host proof retain their own boundaries. A phone-sized Chromium viewport does not prove a native phone app.

## Set up from the installed version

Inspect scripts, auth, fixtures, app control and existing tests first. Install exact compatible `e2e`, `@e2e-dev/web` and Playwright versions with the project's package manager and commit the lockfile. The [runnable reference](https://github.com/applification/astack/tree/main/examples/e2e-proof) pins the versions proven here; check current compatibility before selecting versions for a new product. The reference helpers are project-owned examples, not a universal astack runner.

Run the installed `e2e init` or `e2e guide` through the project's package manager. Keep `.agents/skills/e2e` matched to the pinned package and refresh it on upgrades. Point `AGENTS.md` to it. Use upstream guidance for APIs and astack for acceptance, evidence and review policy. Do not copy the entire upstream skill into the astack plugin. Installed guides or bundled docs are the first source for flags and report fields; current online docs may describe a newer release.

Configure `e2e mcp` for the actual coding client. `init` does not establish Codex configuration loading. For Codex, use a trusted project `.codex/config.toml` launcher that resolves this checkout, invokes the installed CLI, and allocates distinct evidence/run IDs. Prove a stdio client can initialize, open, observe, locate and close; separately prove the restarted host loads it. Report an unavailable host check as skipped.

Establish working project commands for regressions, isolated probes, fresh-directory reruns, exploration and triage where applicable. Record them in `.astack/project.md` with targets, fixtures, model/budget policy, CI checks and evidence retention. Example command names are conventions, not commands to assume exist.

## Map acceptance and inspect

Give material acceptance cases stable IDs. For each, name the observable expectation, test/check, target, actor, fixture and independent read required for side effects. Keep acceptance in the behavior contract. The feature map gives entry points and prerequisites; test helpers implement navigation.

Before acting, verify checkout/run and build or deployment identity. A path hash or open port alone does not prove the served revision. For dirty local work, capture a digest of the source/build inputs alongside the full Git commit. Use disposable data and isolated actors. Wrong instance, missing fixtures or rejected credentials make the check inconclusive, not a confirmed product failure.

With e2e MCP, open the intended target, observe, validate locators with `locate`, try the interaction, then close the session. It needs no model. Prefer accessible roles/names and exact user actions. Use the [app-control ownership rules](../../app-control/references/control-contract.md#share-ownership-with-the-test-runner): either e2e owns an isolated server, or it connects through a URL-only config to a CLI-owned verified instance. Tests never stop a stack they did not start.

## Verify known behavior

Use `screen` and `expect` for known actions and exact outcomes. Run a focused case while editing and the affected regressions at the checkpoint. Final web proof should use the production build when available; record dev-only coverage as such. Keep unit, component and protocol checks for failures they catch more cheaply.

Allow `agent.act` when choosing the path adds value, followed by an exact check of its outcome. A locator/engine assertion can verify a replay recording; a plain value assertion or `expect.poll` does not make it cache-eligible in the reference version. Model judgments can answer semantic or visual questions, but record that the observation was model-judged. A displayed success message cannot establish persistence or authorization; confirm material writes through a fresh independent read.

Record whether an action ran live, replayed, or handed off. A cached action proves only its observed outcome on this run, not current model tool choice. Use `--no-cache` for claims about agent behavior. `assert`, `waitFor` and `extract` remain live model judgments. Review shared cache actions as executable test code; do not edit recordings to make a failure pass.

## Explore and confirm

Select a bounded charter when exploration can expose gaps in a meaningful behavior change. Derive it from the contract, feature map, diff and affected dependencies, including indirect backend effects. Give it one area and hypothesis/posture. Record why exploration was selected or skipped. Copy-only or documentation-only work normally needs no exploration. Larger bug bashes are deliberately selected work, not a full sweep on every PR.

Give personas product facts and environment limitations in `context`; put testing posture in `system`. Prefer the production build so compilation delays do not become findings. Use one seeded actor/fixture per charter. Keep model and reasoning settings project-configurable; Loami's model and Otis runner are not portable defaults.

Bound wall-clock time, planning steps, actions/model calls per invocation and concurrency. A per-call input-token ceiling is not a total-run budget. Record actual calls, tokens, cache use, duration, termination reason and incomplete steps. Start with a small charter and tune against known defects and rejected findings before increasing its budget.

Every issue or warning starts as a candidate. Keep its source report, expected/observed behavior, exact steps and artifact references. Group only demonstrably equivalent claims and retain each source. Inspect the contract and evidence before triage; intended behavior, automation blind spots and missing integration fixtures can explain a claim.

For confirmation, write an isolated probe using exact actions and assertions of the expected behavior. Check its locators live first. Require one selected test failing in its body with `ASSERTION_FAILED`, no run-level/setup errors, and evidence that the assertion encodes this finding. A model-generated failure, locator error, timeout or exhausted budget cannot confirm it. Reject with evidence and a reason; leave unreproduced candidates unresolved. Where exact reproduction is unavailable, retain an explicit visual/host verification gap rather than inventing confirmation.

Keep failing probes outside the passing suite. A confirmed defect affecting the change's acceptance cases blocks delivery completion unless the owner explicitly accepts the limitation; moving it outside the suite does not waive it. After the fix, rerun the original probe, then retain the passing repro in the regression suite. Record the linked lifecycle as candidate → confirmed/rejected → fixed → regression. Do not weaken acceptance or an assertion to remove a finding.

## Interpret and retain evidence

Use [astack proof outcomes](../../verify/references/proof-policy.md#run). Read `run.errors`, selected results, attempts, error phase/source, exploration steps, assessment and termination reason. Validate the report format against the pinned version. Missing reports, empty selection and unknown report formats are inconclusive.

| Observation | astack interpretation |
| --- | --- |
| Exact check observed its expectation on the identified target | Pass for that case only |
| Exact body assertion observed contrary behavior | Fail; confirm a candidate only after the isolated repro checks above |
| Setup, locator, provider, unsupported action or budget failure | Inconclusive about product behavior |
| Applicable case explicitly not run | Skipped with its reason |
| Retry passes after a failure | Latest observation passes; preserve the flaky result and first failure |
| Exploration is green or has no findings | No acceptance proof; review steps and assessment |
| Exploration ends at a limit or contains incomplete/failed steps | Inconclusive charter, even with exit zero |
| Exploration reports an issue | Candidate pending reproduction, not a confirmed defect |

Even a completed clean exploration does not establish exhaustive coverage. Link only independently checked observations to acceptance cases. For an affected case, unresolved flaky behavior needs investigation or explicit owner acceptance before claiming completion.

Each invocation gets a new output directory. Preserve raw reports and artifacts, link reruns with `rerunOf`, and distinguish the prior report used for selection from fresh observations if startup fails. Cleanup removes disposable state and owned processes, not evidence. Keep raw run files ignored under `.e2e/`; retain selected sanitized proof under `.astack/<feature>/evidence/` or a durable approved artifact store.

A concise proof result records acceptance ID, full revision, dirty source/build digest when needed, environment/build identity, target URL, actor/fixture, command/check, expected and actual observation, outcome, gaps, artifact references and rerun lineage. For exploration also record charter, persona/model/reasoning, usage, termination and candidate triage. Preserve the raw report alongside the summary. Retain evidence supporting lasting PR claims beyond short CI expiry.

## CI and readiness

Keep required deterministic checks separate from advisory exploration. Run production regressions on affected targets, reject focused-only tests in CI, and preserve first failures and retries. Configure required checks where the repository supports them; report a missing enforceable merge gate instead of claiming it exists.

Use locked dependencies, pinned Actions, read-only tokens and per-run reports. A selected automatic charter is bounded and advisory; broader bug bashes need an explicit selection. Advisory status does not excuse a confirmed relevant defect or an unverified acceptance case. Return case results, flaky tests, candidates and incomplete charters separately to the caller. Include them in the PR summary when PR preparation is part of the requested delivery. The [PR readiness rules](../../pr/SKILL.md) still apply.

Framework test/config code runs with OS permissions. Untrusted PRs use externally isolated runners without secrets or subscription credentials. Subscription-backed exploration uses explicitly trusted runners with a separate framework login under the service account. Preflight provider access; a Codex login alone is insufficient. Do not copy Loami's runner name or credentials into another project.

Use least-privilege disposable accounts. e2e redaction is not an isolation boundary, exploration can access all configured credentials, and navigation has no origin allowlist. Keep logs, media and authentication state out of shared evidence unless inspected for secrets; video and process logs are not fully redacted. Apply the project's telemetry policy and document it.

## Proven scope

The [reference](https://github.com/applification/astack/tree/main/examples/e2e-proof) exercises real Chromium checks, isolated confirmation, failure-preserving reruns, wrong-instance rejection and conservative report interpretation without model calls. Its exploration fixture is sanitized recorded evidence, not a fresh exploration. Authenticated persistence, native mobile, live model quality and a restarted Codex host require separate project trials before claiming those capabilities verified.

Primary guidance: [writing tests](https://e2e.tester.army/docs/writing-tests), [coding agents](https://e2e.tester.army/docs/coding-agents), [exploration verdicts](https://e2e.tester.army/docs/explore), [bug bashes](https://e2e.tester.army/docs/bug-bash), [cache](https://e2e.tester.army/docs/cache), [security](https://e2e.tester.army/docs/security), [CI](https://e2e.tester.army/docs/ci).
