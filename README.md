# astack

Reusable engineering skills, mechanical feedback and loops for coding agents. The consuming project owns its languages, frameworks, providers and checks.

| Part | What it does |
| --- | --- |
| [`skills/`](skills/) | Engineering principles and workflows from intent to proof |
| [`lint/`](lint/) | Validate astack's skill identities, links, plugin schemas and packaged assets |
| [`loops/`](loops/) | Compose the skills on a host schedule or mention |

**[astack.applification.net](https://astack.applification.net/)** explains the same three parts.

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

Give `$applification:astack` in Codex, or `/applification:astack` in Claude Code, a request with the product, fixed choices, open decisions and smallest useful milestone.

Fixed choices are honoured. Open choices are compared against product constraints; the agent recommends or decides within delegated authority. Observable questions are settled by running things.

The project supplies its technology skills, vendor documentation, lint and compiler configuration. astack uses that guidance and the existing check commands. Its plugin ships engineering method, with no application stack dependencies or compiler/linter presets.

| Group | Skills |
| --- | --- |
| Entry | `astack` |
| Delivery | `implement`, `bug-fix`, `refactor`, `performance`, `investigate`, `pr` |
| Project | `project-setup`, `app-control`, `cloud-transition` |
| Checks | `testing`, `verify`, `code-review`, `correct`, `agent-evaluation` |
| Design | `architect`, `domain-modeling`, `show-me` |
| Principles | `principle-type-system-discipline`, `principle-boundary-discipline`, `principle-encode-lessons-in-structure`, `principle-prove-it-works`, `principle-test-behavior-not-implementation`, `principle-fix-root-causes`, `principle-sequence-verifiable-units` |

Keep choices and working commands in existing project instructions. Use `.astack/project.md` when a separate reference helps. Setup establishes one verified milestone; control tools and feature maps earn their place when needed.

## Loops

A loop is one prompt file. Your host owns scheduling, credentials and mentions.

| Loop | Trigger | Work |
| --- | --- | --- |
| [`lint-debt`](loops/lint-debt.md) | Weekly | Fix one diagnostic using the project's chosen guidance and checks |
| [`pr-review`](loops/pr-review.md) | Hourly, or on PR | Review new PR heads and report observed checks |
| [`bug-fix`](loops/bug-fix.md) | Daily | Reproduce and fix one eligible unassigned bug |
| [`mention`](loops/mention.md) | Bot mention | Answer the question or make the requested change |

Copy the selected prompt from an astack checkout into your project. For example, after copying `lint-debt.md` to `agent-prompts/lint-debt.md`, run it from that project with the plugin installed:

```sh
claude -p < agent-prompts/lint-debt.md
```

For mentions, append the comment and its thread. Runs use existing project tools, check for prior work and never merge. Installing the plugin does not create a project prompt directory.

## Contributing

Run `bun install --frozen-lockfile`, then `bun run check`. The repository uses Bun for authoring checks; consuming projects keep their own tools. [`lint/plugins.mjs`](lint/plugins.mjs) checks the portable package, and its tests reject malformed identities, missing assets and broken composition links. Site and loop checks keep their references current. Keep proof in the PR description, following [AGENTS.md](AGENTS.md).

The plain HTML/CSS/JavaScript [`site/`](site/) publishes to astack.applification.net through GitHub Pages on merge to `main`. Preview it with `python3 -m http.server 8000 --directory site`.

## Sources and license

astack adapts guidance from [pstack](https://github.com/cursor/plugins/tree/main/pstack), [Matt Pocock's skills](https://github.com/mattpocock/skills) and [HumanLayer's show-me](https://github.com/humanlayer/skills). See [NOTICE](NOTICE.md) for revisions and attribution. MIT licensed; see [LICENSE](LICENSE).
