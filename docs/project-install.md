# Install AStack for a project

The Applification plugin remains in the [AStack repository](https://github.com/applification/astack). A project controls when to take an update through its marketplace entry and keeps only its own workflow profile locally. This avoids copied skill files and lets project changes review a new AStack version alongside any revised guidance.

## Project files

Create `.agents/plugins/marketplace.json` in the project, using a marketplace name unique to that project. The source can follow `main` while trying AStack; use a release tag or commit SHA when repeatability matters.

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
        "path": "./plugins/applification",
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

Register the local project marketplace and install AStack:

```sh
codex plugin marketplace add /absolute/path/to/my-project
codex plugin add applification@my-project-applification
```

The CLI installation also enables the plugin at user level. If AStack should run only in this project, set the same plugin ID to `enabled = false` in the user Codex configuration and keep `enabled = true` in this project's configuration. Project settings take precedence in trusted projects. Confirm the effective state with `codex plugin list --marketplace my-project-applification --json` from the project and from another directory.

Ask Codex to use `$applification` to set up the project. It inspects the repository and writes `.astack/project.md` for project-specific proof paths and decision locations. For a runnable product, setup also creates or adopts a project-owned `astack-<app>` control CLI and feature map, then drives one mapped path to validate them. Design sprint contracts, Pencil files, and retained evidence go into tracked `.astack/<feature>/` folders. Check that `.astack/` and the project control skill are visible to Git. Keep any `AGENTS.md` pointer short; it should opt into the workflow rather than duplicate it.

For a project that uses Convex, also install and enable `convex@openai-curated-remote` in Codex. AStack calls on its `@Convex` app and `convex:*` skills for setup, backend changes, and the required Convex PR review. Check that the plugin is available in a new task before starting Convex work; AStack's plugin installation does not install companion plugins.

```sh
codex plugin add convex@openai-curated-remote
```

## Update

Change the marketplace `ref` or `sha` to the AStack revision the project will adopt. Refresh the marketplace and reinstall the plugin, then start a new Codex task and exercise a representative project route. Update `.astack/project.md` only when the project's own commands or policies changed. Do not edit installed plugin cache files.
