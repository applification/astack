# App control and feature map

Use this when a project needs a repeatable way for an agent to launch, drive, inspect, and debug its running product. The result is a project-owned `astack-<app>` CLI and a small feature map. astack supplies the creation and upkeep method; the project owns its runtime commands and product knowledge.

## Inspect before building

Read the project's user entry points, startup scripts, existing test and browser tools, auth and fixture setup, and any current proof route in `.astack/project.md`. Run a working path before replacing it. For an existing web app, reuse its working browser driver; `agent-browser` is the default for astack's greenfield web path when installed, following its version-matched `agent-browser skills get core` guidance. For a new Next.js web app using the greenfield default, start through [Portless](https://portless.sh/) and use its actual URL; use the configured [Next DevTools MCP](https://nextjs.org/docs/app/guides/mcp) for framework diagnostics when available. For a CLI, service, iOS app, or desktop app, use its existing PTY, HTTP, simulator, or debugging tools. Build only the commands the actual product needs.

Identify what the agent must do repeatedly: start or connect to the right instance, reach a feature through a user path, act, observe the result, capture useful evidence, and clean up. A wrapper around `lint` and `test` alone does not meet this goal. Keep those checks in the project's normal scripts.

## Create the project skill and CLI

Use a short lowercase hyphenated app name. Keep the executable at a host-neutral path in the project, a thin operating skill for each agent host the project uses, and the product map in tracked `.astack/` project knowledge:

```text
tools/astack-<app>.ts              # or another host-neutral path
<host project skill directory>/astack-<app>/SKILL.md
.astack/feature-map/<app>/
    README.md
    <feature-area>.md
```

The host adapters ([Codex](hosts/codex.md), [Claude Code](hosts/claude-code.md)) name each host's project skill directory. Each host's skill says the same thing: how to invoke the CLI, where the feature map is, and where evidence goes. Keep the copies short and identical in substance; the executable and the map are the single source. Create a skill only for hosts the project actually uses. An existing project whose script already lives inside a host skill folder can keep it there while only that host uses it; when a second host needs it, move the script to the neutral path and update every reference (package script, feature map, project profile, skills, and the CLI's own help and error text) in the same change, then rerun a mapped path.

Do not pre-approve the CLI in a project skill's tool permissions. A project skill can grant itself command access when it is invoked, and a wildcard over a growing command set widens that grant silently. Use the host's normal permission prompts until the command set and approval boundary have been reviewed; a reviewed allow rule belongs in the project's permission settings, not the skill.

In a new astack-default product, make the script an executable Bun TypeScript CLI with a `#!/usr/bin/env bun` shebang and Git executable mode (`100755`). Use Commander as the default parser for its subcommands, arguments, options, help, and usage errors; add it as a project dependency. Document the direct checkout-local invocation, such as `./tools/astack-<app>.ts doctor`, as the primary command. A root `astack-<app>` package script may provide a shorter `bun run astack-<app> doctor` alias. In an existing project, use its installed language, package manager, executable convention, and working parser; do not replace a sound CLI just to use Commander. Its `--help` lists real subcommands, arguments, examples, and evidence locations. Each skill points to `.astack/feature-map/<app>/README.md`. Do not require a global install or modify the user's `PATH`; that is an optional user choice.

Implement a small command set around the product. Include `doctor` and commands to drive and observe at least one real user path. Add `start` and `stop` when the CLI owns a long-lived instance; a short-lived CLI or service may need a different launch model. Expose app-specific actions such as `new-session`, `send`, or `select-state` when they hide repeated navigation or interaction. Add `snapshot`, `screenshot`, `console`, `network`, `record`, or `trace` only when the underlying driver and product support them. Avoid a large pass-through copy of another tool's command tree. Prefer accessible names and stable user-visible handles to coordinates or private component state.

Use the project's runtime to dispatch commands and start subprocesses with argument arrays, an explicit working directory, and inherited or captured output as appropriate. Keep project selectors, URLs, readiness checks, and fixture rules in the project CLI. Do not parse `.astack/project.md` as executable configuration. Give commands useful failures and nonzero exit codes; add `--json` for results an agent needs to parse. Command success means the command ran and observed what it claims. It does not certify every acceptance case.

`doctor` is read-only. It reports the checkout, full Git commit and dirty state, target URL or process, build or deployment identity when available, browser or simulator session, and whether the target is ready and belongs to this run. For a Portless web app, inspect the actual route and upstream process (for example with `portless list` and the app's startup record), check that the proxy, DNS, and TLS work with `portless doctor`, and confirm the returned page belongs to this checkout. Print the resolved URL, including any worktree prefix, in text and `--json` output. Do not assume `localhost:3000`, infer the URL from a branch name, or treat an open port or responsive hostname as proof of identity. For final proof, use a named revision and recheck after code changes that could affect the behavior.

When the CLI launches a Portless-backed web instance, invoke the project's `dev` script and let Portless assign the upstream port and worktree-specific hostname. Capture its actual URL from startup or `PORTLESS_URL` in the child environment, and associate the route with the launched process. For other web apps and surfaces, use their existing launch model and derive an isolated port or equivalent target per checkout or explicit run ID. Keep browser profile, session, and disposable data isolated per run. Track what the CLI starts. Refuse to drive an unrelated shared instance by default, and stop only processes and sessions it owns. Do not use Portless `--force`, `prune`, or a global proxy stop as routine cleanup; these can affect other checkouts. Preserve screenshots, recordings, logs, and the first failure through cleanup. Keep credentials and private user data out of recorded evidence.

For a Next.js app, let the agent inspect routes, compilation issues, and server logs through Next DevTools MCP after confirming it is attached to the same running app. Keep the CLI's browser actions and observations as the user-path proof. If Portless first-run proxy or certificate setup is blocked in a headless session, report that prerequisite clearly instead of silently connecting to a different local server.

## Map user behavior

The feature map is an index plus one short file per real feature area, sized to the product. `.astack/feature-map/<app>/README.md` links the areas and gives a useful broad-sweep order. Each feature file answers:

- What users can do and which entry points reach it.
- The exact `astack-<app>` commands that drive those entry points through the running product.
- The observable end state and side effect that would support a proof claim.
- Prerequisites and known traps, such as auth, flags, timing, or another surface.

Write from the user's point of view. Derive the initial map from routes, commands, menus, stories, and existing product documentation; inspect source to resolve gaps. Do not invent features or copy the whole repository into the map. Keep acceptance decisions in the behavior contract. The map describes how to exercise behavior; a proof result records what this run actually observed.

## Prove and maintain the result

Run the documented direct command and `--help` from a fresh checkout to confirm the executable bit, shebang, dependency resolution, and command help work without `bun run` or a `PATH` change. Then run the new instructions end to end: launch or connect, `doctor`, drive one mapped user path, observe its end state and any material side effect, capture evidence, and clean up. Confirm the evidence survives cleanup. If the checkout cannot run, report the exact missing prerequisite and leave the skill marked as a draft rather than claiming a working control route.

Record the CLI invocation, feature map location, safe fixture route, and evidence location in `.astack/project.md`. When a change alters a user path, control handle, or prerequisite, update the CLI and affected map entry in the same PR and rerun that path. A separate map audit can catch drift later; it should compare source with a live pass and distinguish stale guidance from a product regression.
