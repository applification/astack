# 0006: Compose independently callable engineering skills

Status: accepted. Date: 2026-10-05. Scope: Applification plugin skills and astack delivery.

## Context and decision

The owner identified that reusable workflows had been absorbed into references behind one entry. In particular, show-me became PR explanation policy instead of a directly usable visual explanation skill. Retain `$applification:astack` as the coordinating entry and the seven delivery routes, while giving distinct engineering jobs their own discoverable `SKILL.md`, trigger, instructions and result.

Delivery skills own feature implementation, bug repair, refactoring, performance work and investigation. Focused capabilities own explanation, domain modeling, setup, app control, verification and PR review/preparation. Platform workflows own web UI, MCP, ChatGPT plugins and authorized cloud transitions. astack selects and composes them, carrying intent, scope, acceptance, authority and completed results; composition can be sequential and does not require delegation.

Keep the existing Applification opinions and procedures: local-first Bun/Turbo, React/Vite with shared UI, Convex/WorkOS/MCP, proportionate Pen/Storybook selection and layered proof. Existing projects preserve their accepted tools. Technical references and examples live under their owning skill; astack retains only the optional delegation and COS handoff guidance. Worked profiles and historical proof belong to project documentation. A skill is not merely a wrapper that sends every request back to astack.

The repository distributes one plugin. Keep its `skills/`, `assets/`, `plugin.json` and `mcp.json` at the repository root rather than under `plugins/applification/`. The manifest retains the `applification` identity and invocation namespace. Marketplace sources select the root; repository development records, examples and the site remain outside the skills directory.

## Alternatives and consequences

A single entry with all workflows hidden in references minimizes the skill list but loses separate discovery, direct invocation and clear workflow ownership. Making every reference a skill would inflate the catalog with background policy and API details. Split by recognizable job, input and result instead; companion platform skills retain specialized responsibilities.

PR preparation composes show-me without restricting it to PRs. Direct verification returns observed results and may finish with a failure report; it does not implicitly publish to an existing PR or perform unrequested repairs. A bounded contribution returns to its lead when the lead owns integration. One writer per worktree and existing authority apply across skill composition.

Maintained callers use canonical skill/policy paths; obsolete reference redirects are removed. Changed skill names, moved references, discovery and direct/composed delivery require checking the actual installed candidate, not only source routing tables or builds. Evidence is tied to the tested source and host.

## Sources

Structure was compared with [Matt Pocock engineering skills](https://github.com/mattpocock/skills/tree/4588b32ecab9ecc9fc8cc6b6c5e7d675b6004b0d/skills/engineering), [pstack skills](https://github.com/cursor/plugins/tree/4e5b1cf2ccb0ea3716f08c8ee0a5856b5ab93536/pstack/skills), [HumanLayer plugins](https://github.com/humanlayer/skills/tree/ca7c8088db69e315a8b2deea43820270457f8f3c/plugins) and [OpenAI skill boundaries](https://developers.openai.com/plugins/build/skills). Upstream operational assumptions are not imported wholesale. Source-specific attribution remains in NOTICE.
