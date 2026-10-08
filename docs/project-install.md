# Install astack for a project

The Applification plugin remains in the [astack repository](https://github.com/applification/astack). A project controls when to take an update through its marketplace entry and keeps its own workflow profile and concise host instructions locally. This avoids copied skill files and lets project changes review a new astack version alongside any revised guidance.

## Project files

Create `.agents/plugins/marketplace.json` in the project, using a marketplace name unique to that project. The source can follow `main` while trying astack; use a release tag or commit SHA when repeatability matters.

```json
{
  "name": "my-project-applification",
  "interface": { "displayName": "My Project Plugins" },
  "plugins": [
    {
      "name": "applification",
      "source": {
        "source": "git-subdir",
        "url": "https://github.com/applification/astack.git",
        "path": "./",
        "ref": "main"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Developer Tools"
    }
  ]
}
```

In a trusted project, `.codex/config.toml` enables the matching plugin ID:

```toml
[plugins."applification@my-project-applification"]
enabled = true
```

Register the local project marketplace and install astack:

```sh
codex plugin marketplace add /absolute/path/to/my-project
codex plugin add applification@my-project-applification
```

The CLI installation also enables the plugin at user level. If astack should run only in this project, set the same plugin ID to `enabled = false` in the user Codex configuration and keep `enabled = true` in this project's configuration. Project settings take precedence in trusted projects. Confirm the effective state with `codex plugin list --marketplace my-project-applification --json` from the project and from another directory.

## Establish or upgrade the project loop

Invoke setup directly after installation, or ask the coordinator for the same outcome:

```text
$applification:project-setup Set up this new project for astack
$applification:project-setup Integrate and upgrade this existing project for astack
```

Setup inspects the product and runs a safe baseline where available. It applies astack's [new-product defaults](../skills/project-setup/references/profile.md) or upgrades existing development, control and verification tooling through [runtime loop setup](../skills/project-setup/references/runtime-loop.md). Routine defaults are inferred; questions resolve material product, data or scope decisions. Working drivers and regressions can become part of the loop. Framework, database and auth migrations need a concrete scope and recovery; setup is not restricted to preserving the status quo.

The resulting project owns:

- Tracked `.astack/project.md` with actual runtime, control and verification commands, selected defaults, upgrades, observed evidence and gaps.
- Root host instructions establishing [main-thread orchestration](../skills/astack/references/orchestration.md), plus the profile pointer. Codex uses `AGENTS.md`; Claude Code needs `CLAUDE.md` with the same instructions or an explicit pointer. Setup/upgrades reconcile existing clauses in place, preserve custom text, and keep additions outside framework-managed blocks. Re-runs leave unchanged guidance unchanged.
- A project-owned `astack-<app>` control skill/CLI in `.codex/skills/astack-<app>/` and feature map in `.astack/feature-map/<app>/` for runnable user surfaces, reusing an existing driver where sound.
- A meaningful regression and a demonstrated loop: start/connect, identify the intended instance, drive a mapped action, inspect its result, check, capture evidence and clean up owned resources.

Prove direct CLI invocation and one safe real user path; retain evidence through cleanup. For a library, exercise a consumer/example and appropriate checks. Record missing prerequisites and untested surfaces honestly; generated configuration alone does not complete setup. Keep runtime and credentials in the project, and keep secrets out of tracked guidance. Use GitHub Issues when deferred work needs tracking and no established tracker applies; no issue-tracker or model-role questionnaire is required.

## Use the coordinator or a focused skill

```text
$applification:astack Fix edits disappearing after save and reopen
$applification:bug-fix Fix edits disappearing after save and reopen
$applification:verify Check this change without repairing it
$applification:principle-boundary-discipline Review this adapter's validation boundary
```

The coordinator selects workflows, platform skills and applicable principle leaves. Every skill is independently callable and can compose other relevant skills without returning to astack. Both paths read project guidance when it applies. A missing project profile does not force a setup pass for a narrow job. Keep project-specific CLI skills in the project and reusable engineering instructions in this plugin.

The main session owns the user's task without a separate orchestrator prompt, including direct focused-skill requests. Delegate when useful through the available host; T3 is optional. The parent reviews contributions, integrates them and verifies the result before completion. Installing the plugin does not install this source repository's root `AGENTS.md` into other projects; setup establishes project-owned instructions.

For a project that uses Convex, also install and enable `convex@openai-curated-remote` in Codex. astack calls on its `@Convex` app and `convex:*` skills for setup, backend changes, and the required Convex PR review. Check that the plugin is available in a new task before starting Convex work; astack's plugin installation does not install companion plugins.

```sh
codex plugin add convex@openai-curated-remote
```

## Portable package

The repository root is the plugin root. astack uses root `plugin.json` and `mcp.json` with the Agent Plugins schemas. OpenAI-specific presentation lives in `extensions.com.openai`; skills are discovered under `skills/`. The empty MCP server map is deliberate. A project using astack adds its own runtime plugin/server, guided by [ChatGPT plugin engineering](../skills/chatgpt-plugin/SKILL.md) and [local installation](../skills/chatgpt-plugin/references/plugin-local-install.md). No fallback manifest is needed.

When adopting the root layout from an older astack revision, change the marketplace source path from `./plugins/applification` to `./` along with its ref or SHA. Older pinned revisions still use their original path. The plugin ID and `$applification:<skill>` invocations are unchanged.

## Update

Change the marketplace `ref` or `sha` to the astack revision the project will adopt. Refresh the marketplace and reinstall the plugin, then start a new Codex task and exercise a representative project route. Run project-setup for an adoption upgrade to establish missing main-thread instructions and reconcile the profile pointer without replacing custom or managed text. Update `.astack/project.md` when the project's commands or policies changed. Inspect reachable project guidance separately from observing the actual host load it. Do not edit installed plugin cache files.
