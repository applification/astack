# Portable orchestration/setup guidance

Implementation: `fadc4c10c7780129b95d634060081374a0216be1`, based on `611e4ef`, in the isolated `t3/orchestration-setup-guidance` worktree. Parent owns integration and PR32. Owner evaluation task ID was not supplied; this contribution began/finished no evaluation and did not infer an ID from its host child handle.

The portable package now carries main-thread ownership, useful delegation, host-specific child lifecycle, complete briefs, one writer per worktree and integrated verification. Setup/new-product guidance establishes concise project-owned host instructions on new setup and upgrades, preserving custom text and framework-managed blocks. Foundation generation carries root Codex instructions, a Claude pointer and its existing runtime profile. Installation/adoption docs, site claims and mirrored routing cases reflect the same default.

Evaluation ownership remains with the main owner. Active follow-ups reuse its evaluation ID; materially revised proof after immutable delivery needs a new ID while preserving external work identity. Evaluation IDs, host child IDs/handles, external work IDs and workflow IDs remain distinct. Parent joins require actual result use and trusted captured delegation/result references. Typed root/child correlation is guidance here, with runtime grouping implemented separately by the parent.

## Observed checks

All final checks ran at the implementation revision; [raw command results](evidence/checks.json) retain commands, exit codes, outputs and earlier setup failures.

| Check | Observed result and scope |
| --- | --- |
| `bun run check` | Pass: site routes, all 118 mirrored routing cases, guide links, portable plugin schemas/assets/skills/identity. |
| `bun test scripts/create-foundation.test.ts scripts/check-plugins.test.ts examples/foundation/tests/setup.test.ts` | 18 pass, 0 fail; 77 assertions. Includes real foundation generation/move and project-guidance link containment, relocated portable-package validation and existing setup/auth contracts. |
| Targeted `tsc6` check of `scripts/create-foundation.test.ts` | Pass with strict checking and checked indexed access; exact command uses TypeScript 6 `--ignoreConfig`. |
| Skill-creator `quick_validate.py` for `astack` and `project-setup` | Both pass using a temporary PyYAML virtual environment. |
| Diff whitespace check | Pass before implementation commit. |

Initial test attempts lacked isolated dependencies; root/foundation frozen-lockfile installs with scripts disabled and a temporary cache resolved them. The Python validator initially lacked PyYAML, and the first explicit-file TypeScript invocation lacked `--ignoreConfig`. These were setup failures before the final passing observations; no expectations were weakened. No dependency, lockfile or production-source changes were committed.

## Independent forward trial

A fresh native child used the updated project-setup skill to adopt two scratch standalone Bun libraries: one without host guidance and one with custom Codex/Claude text, an existing astack section, a stale profile pointer and framework-managed markers. It could write only those scratch projects and could perform no external/config/deployment/evaluation actions. [Retained trial evidence](evidence/forward-trial.json) contains the request, source-read provenance, child result/audit, before/after contents, source manifests and actual consumer outputs.

Both real consumers passed before adoption, after adoption and on repeat; direct invocation also passed after adoption/repeat. The new library gained root instructions and a profile. The upgrade preserved custom text within the astack section, the managed block, existing Claude instructions and release guidance while reconciling missing clauses and stale commands. The child's fixture-specific reconciliation helper ran a second time without changing guidance or the project file set. Parent inspection verified snapshot digests, first/repeat byte identity, unchanged runtime files, the managed block, existing Claude instructions and release guidance. The helper was trial tooling, not a general installer or a fresh second autonomous session.

The runtime-loop example's evaluation sentence was clarified during the trial to make readable capture explicit; the retained source-read manifest labels its reconstructed initial version. Generated trial guidance already carried that condition from the surrounding skill/reference. This does not change the trial's observed preservation or consumer outputs.

## Limits and handoff

Fresh Codex/Claude instruction loading and default orchestration behavior were not exercised; file reachability and generated guidance were checked. The scratch libraries have no Git or CI and exercise one parser consumer case, so they establish neither project publication nor broader product coverage. T3/native runtime correlation, capture delivery, cross-provider execution and immutable evaluation behavior were not tested by this docs/scaffold contribution. No deployment, installed plugin cache mutation, main-worktree edit or PR creation/update occurred.

The parent must inspect/cherry-pick the implementation and evidence commits, verify the integrated revision and finish the owner evaluation/PR. Retained trial statements and routing examples are bounded evidence; they do not establish the separately implemented runtime's outcome.
