# Guidance and handoff assessment

Tested candidate: `e0affe93258a4ac5c46ab070b394b353a2a1209d`, based on merged foundation `400e0c38eb7c11df3a6cbdb41195d90436c39223`. Observed on 5 October 2026, Darwin arm64, Bun `1.4.0`, Node `24.21.0`, Python `3.13.0`. The later evidence commit does not change the tested plugin, site or routing examples.

## Mechanical checks

| Check | Observed result | Claim and limit |
| --- | --- | --- |
| `bun run check` | Pass: seven routes, 79 routing examples and source links match; portable manifests/assets/skills/marketplace identities validate. | Package/site consistency, not observed agent routing or delivery. |
| `bun test scripts/check-plugins.test.ts` | 3 pass, 0 fail. | Existing tests cover publisher identity, forbidden legacy fallback and missing executable package assets. |
| Bundled skill-creator `quick_validate.py` | Pass: skill valid. | Frontmatter/name/unfinished-placeholder validation only. Default and bundled Python first failed importing YAML; an ignored local venv with PyYAML `6.0.3` resolved the validator dependency. No product source changed to accommodate it. |
| Local Markdown link inspection and `git diff --check` | Final local links resolve and whitespace check passes. | The initial link inspection identified the not-yet-created evidence file; final record closes that documentation gap. No browser/layout check claimed. |

Raw command logs and validator environment are ignored under `.proof/specialists/` and `.proof/specialists-validator/`. No full runner tree is committed. Media is unnecessary for this guidance/contract review; there is no changed product interaction or visual design to demonstrate.

## Independent assessment and finding resolution

Fresh read-only assessor `/root/assess_handoffs` received the candidate entry, tracked behavior contract and a COS-shaped assignment Q-901/asg-2/run-1: browser/MCP read permissions, intentional sharing awaiting an owner decision, no delegation, conditional repair authority, no external messaging/merge/release, 20-minute budget and exhausted setup retry. Supplied browser evidence used placeholder revision `abc`; MCP setup failed. The assessor read the guidance and changed diff without write authority.

It selected Bug fix with sequential backend/data and security guidance, lead-only worktree ownership and disclosed self-review. It preserved identity and conditional authority, separated candidate unauthorized-read reports from facts, and returned `blocked` with useful partial browser evidence. It required the sharing decision and renewed MCP retry authority before dependent execution, allowing only remaining authorised read-only investigation. The final recheck identified A4's proof as `skipped` pending policy; `blocked` is an engineering status, not a proof outcome. Unknown source, target and receipt remained unknown. This supports S1–S6 at the text-assessment level; it is not a real host or running-product observation.

| Finding | Original observation | Resolution and recheck |
| --- | --- | --- |
| F-REVIEW-1, P2; S3/S4 | A partial example consumed its only setup retry but still directed another setup/check. It also described all unavailable proof as partial despite blocked decisions/limits. | Example now has one authorised retry remaining and explains exhaustion → blocked. Handoff status precedence retains partial work under a blocked required next step. Assessor rechecked pinned `e0affe93258a4ac5c46ab070b394b353a2a1209d`: resolved, no new material issue. |
| Routing formatting; S1 | New interpretation cases lacked their own Markdown table header. | Added a specialist table/header and explicit interpretation-only limit. Assessor verified the formatting correction. |

The initial assessment inspected a changing working tree and retained its original example digest `5747fda75cde43e11575c31bbe6676d20bd64e3adb4fda4518ddcd8236e1504e`. Its initial final report still referenced the old retry wording; the lead requested a fresh pinned recheck rather than treating that stale report as clearance.

Final candidate reference SHA-256 identities:

- `handoff-examples.md`: `a9a6388d785170453bec4a1adb360fec18c2ff6e14ec34fe974ebbc5a0ba0522`
- `handoffs.md`: `8f29ced1bef32abc44b72ec5220ed674cca9b7ce4d83d7934551a62670cc07a3`
- `specialists.md`: `95dab26fba4405fd8292a56fcbdc4165e0ef309c6e46d9bf5ac481b67762ec65`

## Remaining gates

No candidate plugin was installed/activated for this assessment: the assessor read source files explicitly. No fresh agent delivered a feature or bug fix, no running product was exercised, and no host dispatch/receipt/restart/replay was tested in this slice. Routing examples and passing builds do not substitute for those observations. The [next milestones](milestones.md) require actual delivery trials with verified candidate activation and retain all foundation manual/provider/installed-host/cloud gaps. Owner steering excludes Slack and unavailable Dots. Hand-rolled Codex/T3 Code and the durable work arrangement remain unresolved; Loami is one possible adopting project among many; its readiness is project-specific and does not gate astack development. The readable contract convention follows the original plan; a machine schema is not claimed.

## Migration

PR 17 source `8101fbf6758714b8c3c4070f65053703d8ae9ba6` is incorporated into PR 18 under owner direction of 5 October 2026. These original assessment identities and failures remain historical evidence. Current specialist links point to the callable skills; new validation is recorded with the consolidated revision rather than relabeling these earlier observations.
