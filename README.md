# astack

Reusable engineering skills, feedback and loops for coding agents. The project chooses its stack; astack helps reason, implement and verify within it.

| Part | What it gives an agent |
| --- | --- |
| [`skills/`](skills/) | Instructions for how to do the work |
| [`lint/`](lint/) | Mechanical feedback when the work breaks a rule |
| [`loops/`](loops/) | Prompts that compose skills on a schedule or a mention |

**[astack.applification.net](https://astack.applification.net/)** explains the same thing visually.

## Install the skills

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

Give `$applification:astack` in Codex, or `/applification:astack` in Claude Code, a request with:

- The product and who uses it.
- Fixed choices: language/version, runtime, package manager, framework, database, hosting and checks.
- Open choices where you want judgment and trade-offs.
- The smallest milestone that runs end to end, and what would prove it.

Fixed choices are honoured. Open choices are evaluated against product constraints; the agent recommends a choice or decides within delegated authority. Observable questions are settled by running things. Platform skills apply only after their technology is selected. Each skill is also callable directly.

| Group | Skills |
| --- | --- |
| Entry | `astack` |
| Workflows | `implement`, `bug-fix`, `refactor`, `performance`, `investigate`, `pr`, `verify` |
| Project | `project-setup`, `app-control`, `cloud-transition`, `web-feature` |
| Platform | `typescript-best-practices`, `react`, `convex`, `workos-auth`, `mcp-server`, `chatgpt-plugin`, `testing` |
| Craft | `architect`, `code-review`, `correct`, `domain-modeling`, `show-me`, `agent-evaluation` |
| Principles | `principle-type-system-discipline`, `principle-boundary-discipline`, `principle-encode-lessons-in-structure`, `principle-prove-it-works`, `principle-test-behavior-not-implementation`, `principle-fix-root-causes`, `principle-sequence-verifiable-units` |

Keep chosen tools and working commands in project instructions. Use `.astack/project.md` when a separate reference helps; the skills read it when present. Setup establishes one verified milestone. Add control tools, feature maps and shared packages when the work needs them.

## Optional TypeScript lint

Use your project's package manager. This npm example installs the shared rules with their supported ESLint 9 and TypeScript 6 API:

```sh
npm add -D github:applification/astack eslint@^9.39.0 typescript@npm:@typescript/typescript6@^6.0.2
```

For a project using the TypeScript 7 compiler, keep its `tsc` alongside that API using [TypeScript's documented aliases](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6-0):

```sh
npm add -D @typescript/native@npm:typescript@^7.0.2
```

`typescript-eslint` currently requires the older API; this does not change the chosen compiler. Projects using TypeScript 5.9 can keep that supported API. Preserve framework configuration and other compiler settings.

```js
// eslint.config.mjs
import astack from 'astack/eslint';

export default astack();
```

The base applies strict type-checked TypeScript rules, including promise handling, unsafe access and exhaustive switches. React hooks/accessibility and portable UI boundaries are explicit opt-ins:

```js
import astack, { react, portableUi } from 'astack/eslint';

export default [
  ...astack(),
  react(), // Only for a React project.
  ...portableUi({ ui: 'src/views', domain: 'src/model', backend: 'src/server' }),
];
```

Choose the paths from your architecture; none are required by astack. `portableUi` keeps those UI/domain directories free of backend, Node and direct network access, and keeps browser/presentation dependencies out of domain code. Omit an unused directory.

```jsonc
// tsconfig.json: optional strictness settings, leaving runtime/module/JSX choices to the project.
{ "extends": "astack/tsconfig" }
```

## Loops

A loop is one prompt file. Run it with your host's scheduler, cron, CI or mention trigger; astack supplies no scheduler.

| Loop | Trigger | Work |
| --- | --- | --- |
| [`lint-debt`](loops/lint-debt.md) | Weekly | Fix one diagnostic's findings with the project's existing checks |
| [`pr-review`](loops/pr-review.md) | Hourly, or on PR | Review new PR heads and report observed checks |
| [`bug-fix`](loops/bug-fix.md) | Daily | Reproduce and fix one eligible unassigned bug |
| [`mention`](loops/mention.md) | Bot mention | Answer the question or make the requested change |

From a project with the skills and lint package installed:

```sh
claude -p < node_modules/astack/loops/lint-debt.md
```

For plugin-only use, copy the selected prompt from an astack checkout into your project and pass that local file instead. Installation does not create a project `loops/` directory. For mentions, append the comment and its thread to the prompt. Runs preserve the selected stack and never merge.

## Contributing

[AGENTS.md](AGENTS.md) keeps this repository focused. Run `bun run check` to validate the site, plugin manifests, skill links and lint/loop tests. Keep evidence in the PR description.

The plain HTML/CSS/JavaScript [`site/`](site/) publishes to astack.applification.net through GitHub Pages on merge to `main`. Preview it with `python3 -m http.server 8000 --directory site`.

## Sources and license

astack adapts guidance from [pstack](https://github.com/cursor/plugins/tree/main/pstack), [Matt Pocock's skills](https://github.com/mattpocock/skills) and [HumanLayer's show-me](https://github.com/humanlayer/skills). See [NOTICE](NOTICE.md) for revisions and attribution. MIT licensed; see [LICENSE](LICENSE).
