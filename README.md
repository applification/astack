# astack

Engineering playbooks, focused skills and feedback for coding agents. Install once, choose model roles if useful, then describe the task and what would prove it done. The project owns its application technologies.

| Part | What it does |
| --- | --- |
| [`skills/`](skills/) | One entry point, model setup, eight ordered playbooks and focused engineering skills |
| [`lint/`](lint/) | Mechanical checks for astack's plugin, skill/playbook composition and model resolver |
| [`loops/`](loops/) | Prompts that run the same playbooks on a host schedule or mention |

**[astack.applification.net](https://astack.applification.net/)** explains the same three parts.

## 1. Install the plugin

**Codex**

```sh
codex plugin marketplace add applification/astack
codex plugin add applification@applification
```

**Claude Code**

```text
/plugin marketplace add applification/astack
/plugin install applification@applification
```

Both hosts install the Applification plugin from this repository's `skills/`. No server or application toolchain is installed. In T3, make the plugin available to each provider you use; one provider's installation does not establish the other's installation. Delegated briefs include exact skill paths and project context.

## 2. Choose models (optional)

Use `$applification:setup-astack` in Codex or `/applification:setup-astack` in Claude Code. This configures the agent, not the application.

Setup discovers available providers/models and supported reasoning options, asks about your budget/preferences, and saves a confirmed table for four roles in the consuming project's `.astack/models.json`:

| Role | Work |
| --- | --- |
| `research` | Understand code, reproduce symptoms and gather evidence |
| `design` | Compare approaches and settle consequential boundaries |
| `implementation` | Make the authorized changes |
| `review` | Challenge the diff and assess proof |

Missing configuration or omitted roles inherit the current session's model/settings. A pinned role contains a provider/model target with supported options and requires a host catalog exposing that exact target. T3 supplies this through `orchestrator_capabilities`, and selected targets can run through `delegate_task` across Claude/Codex providers. An unsupported saved pin stops its contribution with a reported gap. Model IDs and aliases are not universal across hosts. Setup does not switch the main thread's model or alter host-global settings.

See [model selection](skills/setup-astack/references/models.md) for the small JSON format and validation command. Commit the preference file with the project and point existing project instructions to it so worktrees and hosts read the same choices.

## 3. Give it a task

```text
$applification:astack Fix the save bug.
Done means an edited record survives reopening.
```

Claude Code uses `/applification:astack`. The entry skill chooses a playbook from the outcome. A playbook is an ordered procedure: which skills to use, what each step must establish and which model role performs that contribution. A skill supplies the expertise for a step. You do not need to name the internal skills.

| Task | Playbook |
| --- | --- |
| New or changed behavior | [feature](skills/astack/playbooks/feature.md) |
| Improve the agent's environment or prevent repeated agent mistakes | [feature](skills/astack/playbooks/feature.md) with [correct](skills/correct/SKILL.md); tooling and checks only |
| Reported defect | [bug fix](skills/astack/playbooks/bug-fix.md) |
| Structure change preserving behavior | [refactor](skills/astack/playbooks/refactor.md) |
| Measured slowness | [performance](skills/astack/playbooks/performance.md) |
| Read-only question | [investigation](skills/astack/playbooks/investigation.md) |
| Assess a diff or fix its findings | [review](skills/astack/playbooks/review.md) |
| Add or repair product-driving tools | [app control](skills/astack/playbooks/app-control.md) |
| Empty repo or first working milestone | [new project](skills/astack/playbooks/new-project.md) |

For a new product, describe the users, fixed choices, open decisions and smallest real milestone. Fixed choices are honoured; open choices are compared against product constraints; observable questions are settled by running things. New-project work is a playbook, separate from model setup.

The lead owns integration and final proof. Inherited roles can work directly; selected targets use the actual host's dispatch capabilities. Independent reviews need a fresh reviewer even when the model is the same. Plans record skipped steps with reasons. A read-only task ends with its answer; changed code follows the project's delivery policy.

These are callable skills, not a host-specific persistent mode. Start new tasks with astack; the host owns mode persistence, the parent model and scheduling.

## Project feedback

Engineering principles guide judgment. The project's types, lint rules, tests and runtime checks enforce its concrete rules. astack supplies no application compiler/linter presets.

Ask astack to improve the agent's codebase environment. It uses the feature playbook with `correct` to change deterministic tooling, lint/compiler configuration, structural checks, verification tools, hooks and CI. Application source and runtime behavior stay unchanged; product defects are returned as findings for separate work. Prove that bad contributions are rejected and valid ones pass, wire the command into local verification and CI, and record it in existing project guidance. Reminders alone do not complete correction work. You can also call `$applification:correct` directly.

```text
$applification:astack Agents keep bypassing our validation helper.
Use the failures in this PR to improve our development checks.
Done means the bypass fails a check and valid usage passes,
with application source and behavior unchanged.
```

Keep actual commands in existing project instructions. `.astack/project.md` is optional. A project-specific verification/control skill is useful when existing tools cannot drive a real user path; it earns its place through an observed run.

## Loops

The four prompts are [lint debt](loops/lint-debt.md), [PR review](loops/pr-review.md), [bug fix](loops/bug-fix.md) and [mention](loops/mention.md). Each uses astack's playbooks and existing checks. Pins require a matching host catalog; an unsupported pinned contribution stops with a reported gap. The host owns scheduling, credentials, triggers and retained run state; installing the plugin starts no jobs. Runs avoid duplicate work and never merge.

Copy the selected prompt into your project and give it to your host's scheduler. For a standalone Claude Code run with inherited roles and the plugin installed:

```sh
claude -p < agent-prompts/lint-debt.md
```

For mentions, append the comment and its thread. Installation does not create a project prompt directory.

## Contributing

There are 25 callable skills, including seven principle leaves. Playbooks live under `skills/astack/playbooks/`; they are task procedures, not additional slash commands. Keep step expertise in focused skills and model selection in setup/orchestration.

Run `bun install --frozen-lockfile`, then `bun run check`. Bun is this repository's authoring tool. The checks validate package identities, metadata, contained links, playbook role labels, model-resolution behavior, loops and site references. Keep proof in the PR description, following [AGENTS.md](AGENTS.md).

The plain HTML/CSS/JavaScript [site](site/) publishes to astack.applification.net through GitHub Pages on merge to `main`. Preview with `python3 -m http.server 8000 --directory site`.

## Sources and license

astack adapts guidance from [pstack](https://github.com/cursor/plugins/tree/main/pstack), [Matt Pocock's skills](https://github.com/mattpocock/skills) and [HumanLayer's show-me](https://github.com/humanlayer/skills). See [NOTICE](NOTICE.md) for revisions and attribution. MIT licensed; see [LICENSE](LICENSE).
