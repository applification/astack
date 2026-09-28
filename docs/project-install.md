# Install AStack for a project

AStack's plugin remains in the [AStack repository](https://github.com/applification/astack). A project controls when to take an update through its marketplace entry and keeps only its own workflow profile locally. This avoids copied skill files and lets project changes review a new AStack version alongside any revised guidance.

## Project files

Create `.agents/plugins/marketplace.json` in the project, using a marketplace name unique to that project. The source can follow `main` while trying AStack; use a release tag or commit SHA when repeatability matters.

```json
{
  "name": "my-project-astack",
  "interface": { "displayName": "My Project Plugins" },
  "plugins": [
    {
      "name": "astack",
      "source": {
        "source": "url",
        "url": "https://github.com/applification/astack.git",
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
[plugins."astack@my-project-astack"]
enabled = true
```

Register the local project marketplace and install AStack:

```sh
codex plugin marketplace add /absolute/path/to/my-project
codex plugin add astack@my-project-astack
```

The CLI installation also enables the plugin at user level. If AStack should run only in this project, set the same plugin ID to `enabled = false` in the user Codex configuration and keep `enabled = true` in this project's configuration. Project settings take precedence in trusted projects. Confirm the effective state with `codex plugin list --marketplace my-project-astack --json` from the project and from another directory.

Ask Codex to use `$apf-mode` to set up the project. It inspects the repository and writes `.astack/project.md` for project-specific proof paths and decision locations. Keep any `AGENTS.md` pointer short; it should opt into the workflow rather than duplicate it.

## Update

Change the marketplace `ref` or `sha` to the AStack revision the project will adopt. Refresh the marketplace and reinstall the plugin, then start a new Codex task and exercise a representative project route. Update `.astack/project.md` only when the project's own commands or policies changed. Do not edit installed plugin cache files.
