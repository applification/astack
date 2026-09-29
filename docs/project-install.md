# Install astack for a project

The Applification plugin remains in the [astack repository](https://github.com/applification/astack). A project controls when to take an update through its marketplace entry and keeps only its own workflow profile locally. This avoids copied skill files and lets project changes review a new astack version alongside any revised guidance.

astack runs in Codex and Claude Code from the same plugin directory. Set up whichever hosts the project's contributors use; the [shared project setup](#set-up-the-project) is the same for both.

## Codex

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

Register the local project marketplace and install astack:

```sh
codex plugin marketplace add /absolute/path/to/my-project
codex plugin add applification@my-project-applification
```

The CLI installation also enables the plugin at user level. If astack should run only in this project, set the same plugin ID to `enabled = false` in the user Codex configuration and keep `enabled = true` in this project's configuration. Project settings take precedence in trusted projects. Confirm the effective state with `codex plugin list --marketplace my-project-applification --json` from the project and from another directory.

For a project that uses Convex, also install Convex's Codex plugin following [Convex's Codex guide](https://docs.convex.dev/ai/using-codex). At the time of writing that is:

```sh
codex plugin add convex@openai-curated
```

astack uses the installed plugin's guidance, scaffold, capability catalog, expert, and reviewer for setup, backend changes, and the required Convex PR review. Check that the plugin is available in a new task before starting Convex work; astack's plugin installation does not install companion plugins.

## Claude Code

Register the astack marketplace at project scope from the project root, then install the plugin at the same scope:

```sh
claude plugin marketplace add applification/astack --scope project
claude plugin install applification@applification --scope project
```

Commit the `.claude/settings.json` these write. It declares the marketplace under `extraKnownMarketplaces` and enables `applification@applification` under `enabledPlugins`, so each contributor who trusts the folder is offered the same plugin. To pin a version, add the marketplace with a branch or tag, such as `applification/astack#<tag>`; Claude Code's add command accepts a branch or tag here, not a commit SHA. Confirm the result with `claude plugin details applification` from the project. Plugins declared in a repository's `.claude/settings.json` do not load in Claude Code cloud sessions; project skills committed under `.claude/skills/` do.

Claude Code 2.1.277 and later reads `AGENTS.md` directly when the project has no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md`. If the project adds one of those, start `CLAUDE.md` with an `@AGENTS.md` import so the shared instructions still load, and put only Claude-specific additions below it. Older versions need that import.

For a project that uses Convex, also install Convex's Claude Code plugin following [Convex's Claude Code guide](https://docs.convex.dev/ai/using-claude-code). At the time of writing that is:

```sh
claude plugin install convex@claude-plugins-official
```

astack resolves the plugin's guidance, scaffold, capability catalog, `convex-expert`, and `convex-reviewer` from what is installed; in current versions the expert and reviewer are subagents. Check `claude plugin details convex` before starting Convex work.

## Set up the project

Ask astack to set up the project (`$applification:astack set up this project` in Codex, `/applification:astack set up this project` in Claude Code). It inspects the repository and writes `.astack/project.md` for project-specific proof paths and decision locations. For a runnable product that needs repeatable app driving, setup creates or adopts a project-owned `astack-<app>` control CLI at a host-neutral path such as `tools/astack-<app>.ts`, a thin `astack-<app>` skill for each host the project uses, and a feature map in `.astack/feature-map/<app>/`, then proves the script runs directly by path and drives one mapped user path. A package script can be a convenience alias; global `PATH` setup is left to the user. Behavior contracts, selected Pencil files, and retained evidence go into tracked `.astack/<feature>/` folders. An existing project's framework, package manager, and working tools remain in place unless a migration is requested. Check that `.astack/` and the project control skill are visible to Git when present. Keep any `AGENTS.md` pointer short; it should opt into the workflow rather than duplicate it. Both hosts read `AGENTS.md`; see the [Claude Code](#claude-code) section if the project also has a `CLAUDE.md`.

## Update

Change the pinned astack revision: the marketplace `ref` or `sha` in Codex, or the branch or tag on the Claude Code marketplace. Refresh the marketplace and reinstall or update the plugin (`claude plugin marketplace update applification` in Claude Code), then start a new task in each host the project uses and exercise a representative project route. Update `.astack/project.md` only when the project's own commands or policies changed. Do not edit installed plugin cache files.
