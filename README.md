# astack

astack by Applification is a workflow for Codex and Claude Code that moves from an intended change to a verified result. Install the **Applification** plugin and give its `astack` skill an engineering task. The skill chooses a route, uses the relevant guidance, and checks the outcome. Each project supplies its own commands, environments, and product decisions.

**[Explore the astack site](https://astack.applification.net/)** for a visual route map and searchable routing examples. This README and the [skill source](plugins/applification/skills/astack/SKILL.md) hold the detail. The site lives in [`site/`](site/) in this repository.

## How it works

| You want to… | astack's route |
| --- | --- |
| Add or change user behavior | Feature |
| Fix a reported defect | Bug fix |
| Change structure while preserving behavior | Refactor |
| Improve measured slowness | Performance |
| Answer a question from evidence | Investigation |
| Review or finish an existing change | Pull request |
| Make a running app controllable for verification | App control |

The route is a decision guide, not a checklist. astack picks checks that can catch the relevant failure and records what was actually observed. Kept repository changes end in a pull request; a read-only investigation ends with an answer. See the [work routes](plugins/applification/skills/astack/references/routes.md), [proof guidance](plugins/applification/skills/astack/references/proof.md), and [routing examples](evals/routing.md).

The plugin has one entry skill, [`astack`](plugins/applification/skills/astack/SKILL.md). For web UI work, it decides whether Pencil, Storybook, or both would help with the change and records why. Proof names the affected behavior, revision, environment, and observed result. Example Mapping, Gherkin, a separate story tracker, and a universal proof runner are not required.

## Install

The same plugin directory, [`plugins/applification`](plugins/applification/), carries a manifest for each host, and both hosts load the same [`astack` skill](plugins/applification/skills/astack/SKILL.md). Where a step depends on the host, the skill reads a short adapter for [Codex](plugins/applification/skills/astack/references/hosts/codex.md) or [Claude Code](plugins/applification/skills/astack/references/hosts/claude-code.md). For a project-controlled version in either host, use the [project installation guide](docs/project-install.md).

During project setup, astack inspects the repository and creates `.astack/project.md` with local proof routes and decision locations. For a runnable product, it also creates or adopts a project-owned `astack-<app>` control CLI and feature map. The plugin stays sourced from this repository; project-specific details stay in the project. A short pointer in the project's `AGENTS.md` can opt in without a manual mention; both hosts read that file.

### Codex

The [Codex marketplace](.agents/plugins/marketplace.json) points to the plugin in this repository:

```sh
codex plugin marketplace add applification/astack
codex plugin add applification@applification
```

Start a task with `$applification:astack`, for example, `$applification:astack Fix the save button that loses edits after reopening`. In Codex CLI or the IDE extension, `/skills` can select the same skill. Plugin skills do not create a literal `/astack` slash command; [Codex's custom prompt commands are deprecated](https://learn.chatgpt.com/docs/custom-prompts).

For local development, use `codex plugin marketplace add /absolute/path/to/astack` and `codex plugin add applification@applification` in a test Codex installation. The desktop app may need a restart to load an updated installed copy.

### Claude Code

The [Claude Code marketplace](.claude-plugin/marketplace.json) points to the same plugin directory:

```sh
claude plugin marketplace add applification/astack
claude plugin install applification@applification
```

Start a task with `/applification:astack`, for example, `/applification:astack Fix the save button that loses edits after reopening`. Claude Code can also load the skill on its own when a request matches its description. For how Claude Code reads a project's `AGENTS.md`, see the [Claude Code adapter](plugins/applification/skills/astack/references/hosts/claude-code.md).

For local development, start Claude Code with `claude --plugin-dir /absolute/path/to/astack/plugins/applification` to load the working copy directly. An installed copy is cached; after committing, refresh it with `claude plugin marketplace update applification` and `claude plugin update applification@applification`.

## Behavior contract

For a substantial behavior change, astack keeps one contract with an outcome, a few observable acceptance cases, affected surfaces, and unresolved product decisions. Given/When/Then can express a case but is not required. For web UI work, record the Pencil and Storybook decisions; when used, link the chosen frames and story IDs beside the cases they support, with what each actually demonstrated. Implementation follows that contract, and running-product proof records the results for the same cases. The PR links the tracked contract and summarizes its evidence.

When a design sprint uses Pencil, its artifacts live together in `.astack/`, which must be visible to Git:

```text
.astack/
  project.md
  presence/
    behavior-contract.md
    loami-chat.pen
    embedded-image.png
    evidence/
```

When used, Storybook stories stay with their components in `apps/` or `packages/` and are referenced from the contract. astack does not create separate root `design/` and `docs/` folders for feature work.

## App control

The [app control route](plugins/applification/skills/astack/references/app-control.md) creates a project-local `astack-<app>` CLI that can launch or connect to a running product, check its identity, exercise user actions, inspect results, and capture evidence. The executable lives at a host-neutral path such as `tools/astack-<app>.ts`, with a thin `astack-<app>` skill in the project skill directory of each host the project uses; a short feature map in `.astack/feature-map/<app>/` records how users reach each feature and which CLI commands drive it. Agents can invoke the script directly by path from the checkout; a package script is optional convenience, and global `PATH` setup belongs to the user. New Bun CLIs use Commander for command parsing. The CLI is built from the project's existing browser, simulator, terminal, or protocol tools; astack does not bundle one driver for every product. Setup proves the direct invocation and one mapped path end to end, and later changes update the command and map when that path changes.

For new products without a chosen stack, astack's default is a Bun workspace monorepo with Turborepo: deployable surfaces in `apps/`, reusable code in `packages/`. A new web UI uses Next.js App Router + TypeScript and shadcn/ui with Tailwind CSS from `packages/ui`. Local web development uses [Portless](https://portless.sh/) for stable, worktree-specific URLs; Portless currently requires Node.js 24+ alongside Bun. Next.js's version-matched agent docs and separately configured DevTools MCP support runtime inspection. The [shadcn lint workflow](plugins/applification/skills/astack/references/shadcn-lint.md) adds design-system checks when shadcn/ui is used. New products needing a database use Convex in `packages/backend`, starting with a named development deployment. Existing projects keep their working stack and tools unless a migration is requested.

For Convex work, install Convex's plugin for your host ([Codex](https://docs.convex.dev/ai/using-codex), [Claude Code](https://docs.convex.dev/ai/using-claude-code)). astack uses its guidance for setup, its quickstart scaffold where that fits, its `convex-expert` for backend edits, and its `add` catalog for capabilities in an existing Convex app. [Convex PR review](plugins/applification/skills/astack/references/pr.md) requires the plugin's `convex-reviewer` before the PR is ready. Component names and forms (skill or subagent) change between plugin versions, so astack resolves them from the installed plugin. astack itself does not bundle the Convex plugin.

Proof distinguishes an automated check from a running-product observation. Agent-browser is the greenfield default web driver beneath a project's control CLI; existing apps can use their working driver. A passing test or a screenshot supports only the behavior it actually exercised. Applicable but untested surfaces remain visible as gaps. Before a PR is ready, attach any media captured during proof or explain why media was unnecessary; video is optional.

For MCP servers, astack has a separate [server and proof path](plugins/applification/skills/astack/references/mcp-server.md). It uses the project's transport and authentication requirements, tests tool contracts through an MCP client, and checks the running endpoint and agent behavior when those boundaries matter. Agent evaluations are selected for changes to tool discovery or model use; a mock server does not establish that the real server works.

## Development

Validate the skill and plugin in both hosts before publishing: Codex's bundled `skill-creator` and `plugin-creator` validators, and `claude plugin validate .` from the repository root. The Claude Code manifest omits `version`, so installs track commits; the validator's missing-version warning is expected. See [evaluation cases](evals/routing.md) for behavior to exercise when changing routing or proof selection.

The site is plain HTML, CSS, and JavaScript in [`site/`](site/). Preview it with `python3 -m http.server 8000 --directory site`. Run `node site/check.mjs` to catch route, eval, or source-link drift. GitHub Pages publishes the folder after a merge to `main` at `astack.applification.net`. When changing astack behavior, update the site and README in the same PR; the Pages workflow checks that routes, eval copy, and source links stay current.

## Sources

astack draws on [pstack](https://github.com/cursor/plugins/tree/main/pstack), [FetchUpstream's ChatGPT port](https://github.com/FetchUpstream/pstack-plugin), and [Matt Pocock's skills](https://github.com/mattpocock/skills). Their ideas are adapted for a project-independent workflow that runs in Codex and Claude Code. See [NOTICE](NOTICE.md).

## License

MIT. See [LICENSE](LICENSE).
