# Consolidated PR and complete skill metadata

Owner direction on 5 October 2026 is recorded in the [contract](behavior-contract.md). The tested combined candidate is `c23ea5e6ec0236f241c8db03f6a1b326b7cd9fbc`. [Observations](observations.json) retain exact plugin bytes, host/model, fixture revisions, elapsed time, usage and selected output hashes. Raw traces, workspaces, install diagnostics and runner output remain ignored under `.proof/consolidation/`.

## Migration

M1 passed. The candidate merge has parents `0a7c22ded6856f5928fa5ab61ec09650bb32700a` (PR 18) and `8101fbf6758714b8c3c4070f65053703d8ae9ba6` (PR 17). After push, GitHub confirmed that head and both parents, and the PR diff contained the specialist briefs, handoffs, examples, assessment and milestones. PR 17 was then closed under the owner's explicit direction; it was not merged. Its description points to PR 18, which remains open as the review target. Neither branch was deleted.

All twelve paths changed in PR 17 remain present. The worked handoff examples are byte-identical to its source. Every original contract field and specialist role was retained. README, entry instructions, site and all seven specialist interpretation cases were combined with the callable architecture; current role links point to the owning skills. Original assessment identities, the corrected exhausted-retry finding and foundation gaps remain explicit. Role briefs support callable workflows instead of recreating a second workflow catalog.

The core and PR skills now preserve the owner's chosen PR across additions. Coherent slices may be separate commits within it. The assignment context carries that target through handoffs. astack still owns engineering method and result meanings; the external host owns durable records, dispatch, deduplication and follow-up.

## Metadata and checks

M2 passed. All 16 Applification skills, plus the separate packaged reference setup skill, have:

- YAML `name`, a discriminating `description`, and `metadata.short-description` in SKILL.md.
- `agents/openai.yaml` with `interface.display_name`, matching `short_description`, an owning-skill `default_prompt` and explicit `policy.allow_implicit_invocation: true`.

The [official skill format](https://developers.openai.com/plugins/build/skills) requires identity frontmatter; the [Codex metadata guide](https://learn.chatgpt.com/docs/build-skills) describes the optional UI/policy file. Complete uniform metadata is this repository's owner-requested authoring convention. Frontmatter metadata does not replace the UI mapping. No invented dependencies, icons or runtime guarantees were added.

All 17 skill-creator validations passed. Parsed-YAML package checks and site consistency passed with 96 examples and seven routes. All 12 root tests passed, including three new packaging regressions for missing UI metadata, mistyped identity and a prompt selecting the wrong skill. The initial mistyped-identity test had an assertion capitalization mismatch (the validator correctly rejected the data); its assertion was corrected before the final pass. The whitespace check passed. These checks establish source/package consistency separately from native activation and agent observations.

## Exact installed candidate and fresh observations

The first install attempt found no plugin under the unique test name because the copied marketplace catalog still named itself `applification`. The diagnostic listing exposed that collision. Only the ignored test catalog's name was changed to the unique marketplace name; plugin bytes were unchanged. The initial failure remains retained. Native install/list then succeeded and every installed plugin file hash equaled candidate source. The installed digest is `5436172eaaaf37ee7813c90aba20fda5c854f3c10cf33f760e6d30e92e3d6273`; its components/algorithm are in observations.json. No skill or manifest adapter was used.

M3 passed for these named scenarios. Fresh ephemeral Codex CLI 0.160.0 sessions used the owner's configured gpt-6.1-sol with high reasoning, one writer per disposable fixture, no delegation and declared time/action limits. Local tooling used Bun 1.4.0; the COS-shaped agent observed Node 22.14.0 on Darwin arm64. All three sessions completed normally without candidate loading errors.

| Request | Observation | Elapsed / counted command actions |
| --- | --- | --- |
| Advertised catalog | All 16 names/descriptions returned from runtime metadata with no file-reading actions. | 24.6s / 0 |
| Direct show-me | Read installed skill/source; returned a four-line flow showing selected-owner checking followed by visit-wide removal. Named failing cancellation/passing owner-denial tests and left the fixture clean. | 19.7s / 3 |
| COS-shaped astack continuation | Read specialist/handoff guidance and focused skills; preserved Q-901/asg-2/run-1 and the supplied PR 18 target. Observed 1 failing/1 passing Node test plus collateral effects from either owner. Returned only RESULT.md, with `blocked` on the unresolved product choice, useful partial findings and skipped MCP/host observations. No policy decision, repair, retry, new PR or external delivery was invented. | 219.1s / 11 |

The runner counts command/MCP/web actions; the last task also wrote its local report. The agent's own broader accounting includes orchestration and file operations and is labeled separately in its report. Neither count exceeded 30; elapsed time was instrumented by the runner, and monetary cost remains unknown. After completion the evaluator confirmed byte-identical implementation, tests, glossary, package and instructions. The report carries candidate/confirmed findings F1–F3, their open dispositions, owner decision D1, exact fixture revision and proof limits. Local actor strings were not treated as actual authentication. Zero remaining MCP retries caused no setup attempt. Delivery receipt remained unverified.

Selected result: `status: blocked`; `work_id: Q-901`; `assignment_id: asg-2`; `attempt_id: run-1`; `delivery_target: https://github.com/applification/astack/pull/18`. F1 records the glossary/test versus implementation disagreement; F2 distinguishes direct owner denial from collateral effects on another owner's reservation; F3 names missing MCP/host proof. The owner must settle single-reservation behavior versus explicit visit-wide privilege before dependent edits.

The uniquely owned installed plugin, config entry and cache were removed and their absence confirmed. Existing plugins were preserved. The full result and traces remain ignored with their original hashes; only concise observations are committed.

## Limits and continuing work

These are focused activation/direct explanation/COS-shaped investigation observations. They do not establish a connected COS host, replay/deduplication, result receipt, subagent concurrency or the full foundation feature/bug delivery repeat. Earlier direct/composed delivery evidence remains tied to `7d9adc...`; it was not relabeled as this candidate. Manual G1 Hosted AuthKit, G2 real MCP OAuth/same-user continuity, H1 installed ChatGPT, initial typed-lint diagnosis, image-inspection traceability and actual cloud transition remain open. Emulate, disposable WorkOS Staging and installed/manual acceptance remain distinct; no shared test account was created.

The [milestones](../specialists/milestones.md) preserve the later Codex/T3 Code host/work-record choice and bounded pilot. Slack is excluded, Dots unavailable, Loami one possible adopter among many, and PostHog/gardening deferred. PR 18 is unmerged and no release is authorized. CI observations at the PR destination name their exact submitted revision; later report-only commits do not alter the installed plugin bytes tested above.
