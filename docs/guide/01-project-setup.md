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

Expect project-owned control instructions and a feature map, plus `.astack/project.md` with actual commands, observations and gaps. A short pointer in the project's agent instructions lets the coordinator and direct skills find that profile. Model choices remain host settings; GitHub Issues can track deferred work without a tracker questionnaire.

Check the reported path and evidence. If login, startup or another prerequisite blocked it, the setup remains partial and names the next action. Re-run setup to resume that gap or refresh changed commands; it updates the existing loop in place.

Next: [Give astack work](02-give-it-work.md).
