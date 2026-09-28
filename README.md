# AStack

AStack is a Codex workflow for moving from an intended change to a verified result. It supplies task routing and engineering habits; each project supplies its own commands, environments, and product decisions.

The first version contains one entry skill, [`apf-mode`](skills/apf-mode/SKILL.md). Give it the task and it routes feature work, bug fixes, refactors, performance work, investigations, and pull requests. It uses a short change contract for substantial behavior changes, chooses verification by affected behavior, and reports proof against the exact revision. Example Mapping, Gherkin, a separate story tracker, and a universal proof runner are not required.

## Install in Codex

The [AStack marketplace](.agents/plugins/marketplace.json) points to this repository's plugin. To try it directly after the first release is on `main`:

```sh
codex plugin marketplace add applification/astack
codex plugin add astack@astack
```

For a project-controlled version, use the [project installation guide](docs/project-install.md). Start a task with `$apf-mode`, for example, `$apf-mode Fix the save button that loses edits after reopening`. In Codex CLI or the IDE extension, `/skills` can select the same skill. Plugin skills do not create a literal `/apf-mode` slash command; [Codex's custom prompt commands are deprecated](https://learn.chatgpt.com/docs/custom-prompts). A short pointer in the project's `AGENTS.md` can opt in without a manual mention. During project setup, AStack inspects the repository and creates `.astack/project.md` with local proof routes and decision locations. The plugin stays sourced from this repository; project-specific details stay in the project.

For local development of this plugin, use `codex plugin marketplace add /absolute/path/to/astack` and `codex plugin add astack@astack` in a test Codex installation. The desktop app may need a restart to load an updated installed copy.

## Working contract

For a substantial behavior change, AStack records an outcome, a few observable acceptance cases, affected surfaces, and unresolved product decisions. A design sprint, when useful, produces the visual direction and component states before this contract is finalized. The contract is carried into the PR description alongside proof results; long-lived domain concepts belong in the project's own documentation.

Proof distinguishes an automated check from a running-product observation. A passing test or a screenshot supports only the behavior it actually exercised. Applicable but untested surfaces remain visible as gaps.

## Development

Validate the skill and plugin with Codex's bundled `skill-creator` and `plugin-creator` validators before publishing. See [evaluation cases](evals/routing.md) for behavior to exercise when changing routing or proof selection.

## Sources

AStack draws on [pstack](https://github.com/cursor/plugins/tree/main/pstack) and [Matt Pocock's skills](https://github.com/mattpocock/skills). Their ideas are adapted for a project-independent, Codex-first workflow. See [NOTICE](NOTICE.md).

## License

MIT. See [LICENSE](LICENSE).
