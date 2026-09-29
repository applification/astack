# Codex host adapter

Read this when astack runs in Codex and a step depends on where Codex looks for files, how it is configured, or which companion plugins it has. The method in the rest of astack does not change by host. Names of third-party plugins and their components were current when this adapter was written; the installed plugin is the authority, so check it before relying on a name.

## Invocation and instructions

- Start astack with `$applification:astack <task>`, or pick it from `/skills`. Plugin skills do not create a literal slash command in Codex.
- Codex reads `AGENTS.md` for project instructions. Keep any astack pointer there short.
- Enable astack for a project as described in the [project installation guide](https://github.com/applification/astack/blob/main/docs/project-install.md#codex).

## Project skills

Current Codex documentation lists `.agents/skills/<name>/SKILL.md`, searched from the working directory up to the repository root, as the repository skill location. Projects set up by earlier astack versions keep their control skill in `.codex/skills/astack-<app>/`. Before relying on either location, confirm in `/skills` that Codex discovers the project's `astack-<app>` skill; do not move a working skill only to match this note. The control CLI itself follows the host-neutral layout in [app control](../app-control.md).

## MCP servers

Configure project MCP servers in the trusted project's `.codex/config.toml`. For Next DevTools:

```toml
[mcp_servers.next-devtools]
command = "bunx"
args = ["next-devtools-mcp"]
```

## Convex

Install Convex's Codex plugin following [Convex's Codex guide](https://docs.convex.dev/ai/using-codex). At the time of writing it is `convex@openai-curated` from the reviewed directory, or Convex's own marketplace for newer features; astack does not install it. Resolve each role that [the Convex path](../database.md) needs from the installed plugin: setup and new-app guidance, the quickstart scaffold, the `add` capability catalog, the `convex-expert` backend specialist, and the `convex-reviewer` review. Depending on plugin version these arrive as skills, subagents, or both. Use whatever form is installed; if the reviewer cannot run, the Convex review gate in [PR and review](../pr.md) has not passed.

## Checks

Validate changes to astack itself with Codex's bundled `skill-creator` and `plugin-creator` validators. Use a subagent for an independent review when the host provides one and the change warrants it.
