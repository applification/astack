# AStack

AStack is a Codex workflow for moving from an intended change to a verified result. The installable plugin is named **Applification**. It supplies task routing and engineering habits; each project supplies its own commands, environments, and product decisions.

The first version contains one entry skill, [`applification`](plugins/applification/skills/applification/SKILL.md). Give it the task and it routes feature work, bug fixes, refactors, performance work, investigations, and pull requests. A web UI feature uses a Pencil and Storybook design sprint to develop one behavior contract for implementation and validation. Repository changes meant to be kept end in a PR, with proof of affected behavior on the exact revision. Example Mapping, Gherkin, a separate story tracker, and a universal proof runner are not required.

## Install in Codex

The [Applification marketplace](.agents/plugins/marketplace.json) points to the plugin in this repository. To try it directly after the first release is on `main`:

```sh
codex plugin marketplace add applification/astack
codex plugin add applification@applification
```

For a project-controlled version, use the [project installation guide](docs/project-install.md). Start a task with `$applification`, for example, `$applification Fix the save button that loses edits after reopening`. In Codex CLI or the IDE extension, `/skills` can select the same skill. Plugin skills do not create a literal `/applification` slash command; [Codex's custom prompt commands are deprecated](https://learn.chatgpt.com/docs/custom-prompts). A short pointer in the project's `AGENTS.md` can opt in without a manual mention. During project setup, AStack inspects the repository and creates `.astack/project.md` with local proof routes and decision locations. The plugin stays sourced from this repository; project-specific details stay in the project.

For local development of this plugin, use `codex plugin marketplace add /absolute/path/to/astack` and `codex plugin add applification@applification` in a test Codex installation. The desktop app may need a restart to load an updated installed copy.

## Behavior contract

For a substantial behavior change, AStack keeps one contract with an outcome, a few observable acceptance cases, affected surfaces, and unresolved product decisions. Given/When/Then can express a case but is not required. For a web UI feature, the sprint adds the chosen Pencil frames and Storybook story IDs beside the cases they support, with what each actually demonstrated. Implementation follows that contract, and running-product proof records the results for the same cases. The PR links the tracked contract and summarizes its evidence.

The sprint artifacts live together in `.astack/`, which must be visible to Git:

```text
.astack/
  project.md
  presence/
    behavior-contract.md
    loami-chat.pen
    embedded-image.png
    evidence/
```

Storybook stories stay with their components in `apps/` or `packages/` and are referenced from the contract. AStack does not create separate root `design/` and `docs/` folders for feature work.

New products use a Bun workspace monorepo with Turborepo: deployable surfaces in `apps/`, reusable code in `packages/`. A web UI uses shadcn/ui and Tailwind CSS from `packages/ui`, with Vite + React + TypeScript by default or Next.js when server rendering or server routes are needed. The [shadcn lint workflow](plugins/applification/skills/applification/references/shadcn-lint.md) adds design-system checks for web and Storybook files, with editor feedback where supported and a command agents can run after edits. Apps needing a database use Convex in `packages/backend`, starting with a named development deployment.

For Convex work, install the companion `convex@openai-curated-remote` plugin. AStack uses `@Convex` for general guidance, `$convex:quickstart` where its new-app scaffold fits, `$convex:convex-expert` for backend edits, and `$convex:add` for capabilities in an existing Convex + Next.js app. [Convex PR review](plugins/applification/skills/applification/references/pr.md) requires `$convex:convex-reviewer` before the PR is ready. AStack itself does not bundle the Convex plugin.

Proof distinguishes an automated check from a running-product observation. Agent-browser is the default web driver for real-app checks and useful screenshots or short recordings. A passing test or a screenshot supports only the behavior it actually exercised. Applicable but untested surfaces remain visible as gaps. Before a PR is ready, attach any media captured during proof or explain why media was unnecessary; video is optional.

## Development

Validate the skill and plugin with Codex's bundled `skill-creator` and `plugin-creator` validators before publishing. See [evaluation cases](evals/routing.md) for behavior to exercise when changing routing or proof selection.

## Sources

AStack draws on [pstack](https://github.com/cursor/plugins/tree/main/pstack), [FetchUpstream's ChatGPT port](https://github.com/FetchUpstream/pstack-plugin), and [Matt Pocock's skills](https://github.com/mattpocock/skills). Their ideas are adapted for a project-independent, Codex-first workflow. See [NOTICE](NOTICE.md).

## License

MIT. See [LICENSE](LICENSE).
