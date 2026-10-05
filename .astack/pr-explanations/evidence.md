# PR explanation integration

The owner requested HumanLayer's show-me approach as part of astack PR creation. The source skill was read at [upstream commit ca7c8088db69e315a8b2deea43820270457f8f3c](https://github.com/humanlayer/skills/blob/ca7c8088db69e315a8b2deea43820270457f8f3c/plugins/show-me/skills/show-me/SKILL.md); its repository uses MIT. astack's reference and examples are written for this workflow, with attribution in root and packaged NOTICE files. No upstream plugin installation is required.

Candidate: `184001e857c360283f790fc14f542c069ccbd389`, based on foundation `400e0c38eb7c11df3a6cbdb41195d90436c39223`. Environment: Darwin arm64, Bun `1.4.0`, Node `24.21.0`. Tests ran on 5 October 2026. Later evidence-only commits do not change the tested plugin/site content.

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

Posted explanation inspection is pending before marking the PR ready. Record whether the diagram renders, its labels/links remain readable, and the text equivalent is present. This destination check establishes only that the selected view is usable on the PR.
