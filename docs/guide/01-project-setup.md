# Establish the project loop

Install the Codex plugin:

```sh
codex plugin marketplace add applification/astack
codex plugin add applification@applification
```

Use the [project installation guide](../project-install.md) when the repository should pin a version. Then invoke setup for the project you actually have:

```text
$applification:project-setup Build a new local reading-list app that retains saved items.
```

```text
$applification:project-setup Integrate and upgrade this app for astack. Keep our database and auth provider.
```

Setup inspects the repository and a safe existing baseline. New projects use astack's [defaults](../../skills/project-setup/references/profile.md) where no choice has been supplied. Existing projects gain useful upgrades to development, control and verification. Sound tools become part of the loop; larger framework, database or auth migrations need a concrete scope and recovery.

The loop must work: start or connect, identify this checkout's instance, perform a mapped action, independently inspect the result, run meaningful checks, retain evidence and clean up owned resources. A pure library uses an executable consumer/example and assertions instead of an app session.

Expect project-owned control instructions and a feature map, plus `.astack/project.md` with actual commands, observations and gaps. Setup installs [main-thread orchestration](../../skills/astack/references/orchestration.md) and a profile pointer in the actual host's root instructions: `AGENTS.md` for Codex and `CLAUDE.md` or its explicit pointer for Claude Code. The main agent owns the request through integrated proof; useful delegation uses available tools and does not require T3. Model choices remain host settings; GitHub Issues can track deferred work without a tracker questionnaire.

Check the reported path and evidence. If login, startup or another prerequisite blocked it, the setup remains partial and names the next action. Re-run setup to resume that gap or refresh changed commands and missing instructions; it updates the existing loop in place, preserving custom text and framework-managed blocks. Repeating unchanged setup must not duplicate or alter the guidance. Inspecting instruction files establishes reachability; observed host loading and runtime behavior need their own evidence.

Next: [Give astack work](02-give-it-work.md).
