# astack

A reusable engineering stack for coding agents. It has three parts:

| Part | What it gives an agent |
| --- | --- |
| [`skills/`](skills/) | Instructions for how to do the work |
| [`lint/`](lint/) | Mechanical feedback when the work breaks a rule |
| [`loops/`](loops/) | Prompts that run the skills on a schedule or a mention |

## Install

**Codex**

```sh
codex plugin marketplace add applification/astack
codex plugin add applification@applification
```

**Claude Code**

```
/plugin marketplace add applification/astack
/plugin install applification@applification
```

**Lint rules**, in any Bun or Node project:

```sh
bun add -d github:applification/astack eslint typescript
```

## Skills

Give the entry skill a request and it picks the rest: `$applification:astack <request>` in Codex, `/applification:astack <request>` in Claude Code. Every skill can also be called directly by name.

| Group | Skills |
| --- | --- |
| Entry | `astack` |
| Workflows | `implement`, `bug-fix`, `refactor`, `performance`, `investigate`, `pr`, `verify` |
| Project | `project-setup`, `app-control`, `cloud-transition`, `web-feature` |
| Platform | `typescript-best-practices`, `react`, `convex`, `workos-auth`, `mcp-server`, `chatgpt-plugin`, `testing` |
| Craft | `architect`, `code-review`, `correct`, `domain-modeling`, `show-me`, `agent-evaluation` |
| Principles | `principle-type-system-discipline`, `principle-boundary-discipline`, `principle-encode-lessons-in-structure`, `principle-prove-it-works`, `principle-test-behavior-not-implementation`, `principle-fix-root-causes`, `principle-sequence-verifiable-units` |

Each skill is one directory with a `SKILL.md`. A consuming project keeps its own commands and product knowledge in `.astack/project.md`, which the skills read when it exists.

## Lint

```js
// eslint.config.mjs
import astack from 'astack/eslint';

export default astack({ scope: '@acme' });
```

```json
// tsconfig.json
{ "extends": "astack/tsconfig" }
```

`scope` is your workspace package scope. The config expects the astack layout: apps in `apps/*`, shared presentation in `packages/ui`, pure rules in `packages/domain`, server code in `packages/backend`.

It enforces:

- Strict type-checked TypeScript rules, including no floating promises and no unsafe `any` access.
- React hooks and accessibility rules for `.tsx` files.
- `astack/portable-ui`: UI and domain packages cannot import the backend, Node builtins, network clients or another package's private files, and cannot call `fetch` directly.
- No `window` or `document` in the domain package.

Error messages say what to do instead, so an agent can act on them without reading the skill. [`lint/eslint.test.ts`](lint/eslint.test.ts) has one case per rule.

## Loops

A loop is a prompt file that names a trigger and the skills it composes. astack has no scheduler: run a loop with whatever your host provides.

| Loop | Trigger | What it does |
| --- | --- | --- |
| [`lint-debt`](loops/lint-debt.md) | Weekly | Fixes one lint rule's findings and opens a pull request |
| [`pr-review`](loops/pr-review.md) | Hourly, or on pull request | Reviews open pull requests and reports check results |
| [`bug-fix`](loops/bug-fix.md) | Daily | Reproduces and fixes the oldest unassigned bug |
| [`mention`](loops/mention.md) | A comment that mentions the bot | Answers the question or makes the requested change |

Run one from a project that has the plugin installed, passing the file on stdin:

```sh
claude -p < loops/lint-debt.md
```

Put that command in cron, a CI schedule or your host's scheduled tasks. For `mention`, have the trigger append the comment and its thread to the prompt.

## Contributing

[AGENTS.md](AGENTS.md) holds the rules that keep this repository small. `bun run check` validates the plugin manifests and skill links, and runs the lint and loop tests.

## Sources and license

astack adapts guidance from [pstack](https://github.com/cursor/plugins/tree/main/pstack), [Matt Pocock's skills](https://github.com/mattpocock/skills) and [HumanLayer's show-me](https://github.com/humanlayer/skills). See [NOTICE](NOTICE.md) for revisions and attribution. MIT licensed; see [LICENSE](LICENSE).
