# Domain language and PR explanation integration

The owner requested HumanLayer's show-me approach as part of astack PR creation. The source skill was read at [upstream commit ca7c8088db69e315a8b2deea43820270457f8f3c](https://github.com/humanlayer/skills/blob/ca7c8088db69e315a8b2deea43820270457f8f3c/plugins/show-me/skills/show-me/SKILL.md); its repository uses MIT. astack's reference and examples are written for this workflow, with attribution in root and packaged NOTICE files. No upstream plugin installation is required.

Candidate: `184001e857c360283f790fc14f542c069ccbd389`, based on foundation `400e0c38eb7c11df3a6cbdb41195d90436c39223`. Environment: Darwin arm64, Bun `1.4.0`, Node `24.21.0`. Tests ran on 5 October 2026. The results in this section apply to that PR explanation candidate; the subsequent domain language addition is reported separately below.

## Scope and checks

The public entry now makes explanation selection part of PR preparation. The PR guide links a focused reference covering pseudocode, call/component/file trees, before/after sketches, Mermaid and HTML illustrations. The view is grounded in actual code and refreshed with the diff; proof retains its separate outcomes and targets. Simple fixes can remain concise. README, site and five interpretation cases are updated together.

| Check | Observation | Limit |
| --- | --- | --- |
| `bun run check` | Pass: seven routes and all 77 site/routing examples match; manifests, packaged paths and marketplace identities validate. | Packaging/source consistency, not observed model behavior. |
| `bun test scripts/check-plugins.test.ts` | 3 pass, 0 fail. | Existing package identity/fallback/asset checks. |
| Bundled skill-creator validator | Pass: skill valid, using the existing ignored PyYAML environment. | Frontmatter/placeholder validation, not semantic delivery proof. |
| Local skill/reference links and whitespace | Resolve; `git diff --check` passes. | Documentation structure only. |
| Completed-diff self-review | Entry → PR guidance → explanation reference is reachable; real proof, media and merge requirements remain explicit. | Lead self-review; no independent review claimed. |

No application behavior changed, so no foundation readiness/provider/installed-host run was needed locally. No candidate installation or fresh-agent delivery trial is claimed. Existing foundation proof gaps are unchanged. Raw installation/generation output stays ignored under `.proof/pr-explanations/`; no full runner tree is committed.

## Application to this PR

The PR body uses one Mermaid flow of the changed preparation method, with a short text equivalent and source/reference links. This is an explanation of the guidance, not an execution trace or product screenshot. A large HTML artifact would add no useful detail here.

Posted-view check on [PR 18](https://github.com/applification/astack/pull/18) passed in the Codex in-app browser: GitHub rendered all six nodes and both branches; the source/reference/evidence links and text equivalent were present. The initial horizontal diagram rendered but its labels were too small and the final node overlapped the pan/zoom controls. The PR body was changed to a vertical flow and rechecked: labels are readable and the remaining flow is reachable by ordinary page scroll. That initial presentation problem is retained here rather than treating the first render as adequate. No separate media attachment is needed because the explanatory diagram is already in the PR body; browser screenshots are redundant observations of that artifact. This destination check establishes only that the selected view is usable on this PR, not fresh-agent behavior or product execution.

## Domain language addition

The owner subsequently requested Matt Pocock's domain-modeling approach in the same PR. The skill, glossary/ADR formats and MIT license were inspected at [upstream commit 4588b32ecab9ecc9fc8cc6b6c5e7d675b6004b0d](https://github.com/mattpocock/skills/tree/4588b32ecab9ecc9fc8cc6b6c5e7d675b6004b0d/skills/engineering/domain-modeling). Root and packaged NOTICE files credit this source; the guidance and booking example are written for astack rather than bundling upstream templates.

Combined guidance candidate: `ebbfa2971680db756a398d70031774a91c55b78d`, with the same foundation base and local environment above, checked on 5 October 2026. The entry links a focused domain language reference; setup discovers existing glossaries/maps, contracts link agreed meanings, and PR review checks terminology consistency. Glossaries hold definitions, contracts hold acceptance and open choices, and decision registers hold consequential rationale. Existing paths and formats win; files are created lazily, small fixes stay lightweight, and terminology agreement alone does not authorize a broad migration.

Six added interpretation cases cover a glossary/code contradiction, the first agreed term, multiple contexts, a punctuation fix, scope after terminology agreement, and implementation detail misplaced in a glossary. Self-review corrected one case that initially phrased a broad rename as an explicit request while expecting it to be treated as unauthorized: the final case supplies terminology agreement during a one-screen fix. Explicit user instructions take precedence over astack defaults.

| Check | Observation | Limit |
| --- | --- | --- |
| `bun run check` | Pass: seven routes, 83 matching examples, packaged schemas/assets and marketplace identity. | Source and package consistency only. |
| `bun test scripts/check-plugins.test.ts` | 3 pass, 0 fail. | Existing packaging regressions. |
| Bundled skill-creator validator | Skill valid. | Frontmatter and structural validation. |
| Local Markdown links and `git diff --check` | All file targets resolve; whitespace check passes. | Documentation structure only. |
| Completed-diff self-review | Definitions, acceptance, decisions and proof have distinct homes; custom conventions, read-only work and task authority are preserved. | Lead review of guidance; no observed agent delivery claimed. |

No application runtime changed. These checks do not close foundation activation or delivery gaps, and no candidate plugin activation is claimed here. No empty project glossary or ADR was added: this change establishes the method, without resolving a new adopting project's term. The PR preparation diagram remains the already-inspected vertical view; the PR description additionally links this reference and explains document ownership.
