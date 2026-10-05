# Install astack for a project

The Applification plugin remains in the [astack repository](https://github.com/applification/astack). A project controls when to take an update through its marketplace entry and keeps only its own workflow profile locally. This avoids copied skill files and lets project changes review a new astack version alongside any revised guidance.

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

Ask Codex to use `$applification:astack` to set up the project. It inspects the repository and writes `.astack/project.md` for project-specific proof paths and decision locations. For a runnable product that needs repeatable app driving, setup creates or adopts a project-owned `astack-<app>` control CLI in `.codex/skills/astack-<app>/` and feature map in `.astack/feature-map/<app>/`, then proves the script runs directly by path and drives one mapped user path. A package script can be a convenience alias; global `PATH` setup is left to the user. Behavior contracts, selected Pencil files, and retained evidence go into tracked `.astack/<feature>/` folders. An existing project's framework, package manager, and working tools remain in place unless a migration is requested. Check that `.astack/` and the project control skill are visible to Git when present. Keep any `AGENTS.md` pointer short; it should opt into the workflow rather than duplicate it.

For a project that uses Convex, also install and enable `convex@openai-curated-remote` in Codex. astack calls on its `@Convex` app and `convex:*` skills for setup, backend changes, and the required Convex PR review. Check that the plugin is available in a new task before starting Convex work; astack's plugin installation does not install companion plugins.

```sh
codex plugin add convex@openai-curated-remote
```

## Portable package

The repository root is the plugin root. astack uses root `plugin.json` and `mcp.json` with the Agent Plugins schemas. OpenAI-specific presentation lives in `extensions.com.openai`; skills are discovered under `skills/`. The empty MCP server map is deliberate. A project using astack adds its own runtime plugin/server, guided by [ChatGPT plugin engineering](../skills/chatgpt-plugin/SKILL.md) and [local installation](../skills/chatgpt-plugin/references/plugin-local-install.md). No fallback manifest is needed.

When adopting the root layout from an older astack revision, change the marketplace source path from `./plugins/applification` to `./` along with its ref or SHA. Older pinned revisions still use their original path. The plugin ID and `$applification:<skill>` invocations are unchanged.

## Update

Change the marketplace `ref` or `sha` to the astack revision the project will adopt. Refresh the marketplace and reinstall the plugin, then start a new Codex task and exercise a representative project route. Update `.astack/project.md` only when the project's own commands or policies changed. Do not edit installed plugin cache files.
