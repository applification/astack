# Claude Code host adapter

Read this when a step depends on Claude Code's file locations, configuration, or companion plugins. Third-party plugin names here were current when written; the installed plugin is the authority.

## Invocation and instructions

- Start astack with `/applification:astack <task>`. Claude Code can also load the skill on its own when a request matches its description.
- Claude Code 2.1.277 and later reads `AGENTS.md` directly when there is no `CLAUDE.md`, `.claude/CLAUDE.md`, or `CLAUDE.local.md` in the working directory or above it. Once any of those exists, Claude Code reads it instead, so start `CLAUDE.md` with an `@AGENTS.md` import to keep the shared instructions. Older versions always need that import. Keep `AGENTS.md` as the shared source and put only Claude-specific additions below the import.
- Enable astack for a project as described in the [project installation guide](https://github.com/applification/astack/blob/main/docs/project-install.md#claude-code). Plugins declared in a repository's `.claude/settings.json` load in local sessions after the folder is trusted; Claude Code cloud sessions do not load them, although they do load project skills committed under `.claude/skills/`.

## Project skills

Claude Code discovers project skills in `.claude/skills/<name>/SKILL.md`, from the working directory up to the repository root. It does not read `.agents/skills/` or `.codex/skills/`. Put the thin `astack-<app>` operating skill there; the control CLI itself follows the host-neutral layout in [app control](../app-control.md).

Do not add `allowed-tools` to a project control skill. Claude Code applies a project skill's `allowed-tools` whenever the skill is invoked, including in folders that were never trusted, and a wildcard covers every future subcommand. Keep normal permission prompts until the command set has been reviewed; a reviewed allow rule belongs in `.claude/settings.json` under `permissions.allow`.

## Run and verify

Claude Code bundles `/run`, `/verify`, and `/run-skill-generator`. They record their own launch recipes in `.claude/skills/run-<name>/` or `.claude/skills/verify/SKILL.md`; they do not consume an `astack-<app>` skill automatically. Use the `astack-<app>` CLI as the project's proof command for astack work and record that in `.astack/project.md`. If the project wants `/verify` to use the same CLI, treat that as an explicit integration: a `verify` skill at the repository root replaces the bundled one, so write it to call the CLI, then prove it runs a mapped path before relying on it. Do not keep two recipes that start the app differently.

## MCP servers

Configure project MCP servers in `.mcp.json` at the repository root, for example with `claude mcp add --scope project next-devtools -- bunx next-devtools-mcp`, which writes an entry like:

```json
{
  "mcpServers": {
    "next-devtools": { "command": "bunx", "args": ["next-devtools-mcp"] }
  }
}
```

Claude Code asks each user to approve a project MCP server before first use.

## Convex

Install Convex's Claude Code plugin following [Convex's Claude Code guide](https://docs.convex.dev/ai/using-claude-code). At the time of writing it is `convex@claude-plugins-official`; astack does not install it. Resolve each role that [the Convex path](../database.md) needs from the installed plugin, using `claude plugin details convex`, `/agents`, and the `/` menu: setup and new-app guidance, the quickstart scaffold, the `add` capability catalog, the `convex-expert` backend specialist, and the `convex-reviewer` review. At the time of writing the expert and reviewer are subagents; delegate to them through the Agent tool. If the reviewer cannot run, the Convex review gate in [PR and review](../pr.md) has not passed.

## Checks

Validate changes to astack itself with `claude plugin validate .` from the repository root. Confirm a local install with `claude plugin details applification`. Use a subagent for an independent review when the change warrants it.
