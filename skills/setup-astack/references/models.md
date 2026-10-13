# Model selection

The consuming project owns and commits `.astack/models.json` so its worktrees and agents read the same preferences. Store no secrets. Explicit task instructions take precedence; report a task override without silently rewriting saved preferences.

```json
{
  "roles": {
    "research": "inherit",
    "design": "inherit",
    "implementation": "inherit",
    "review": "inherit"
  }
}
```

Omitted roles inherit for compatibility. Setup saves all four roles explicitly. A pinned role uses a target object with `providerInstanceId`, `model`, and optional `options` (a map of option IDs to string or boolean values). Pins apply only where the host exposes that exact target; provider IDs, model IDs and options are not universal across hosts.

An optional `reviewPanel` holds exactly two pinned targets from different provider instances. Populate these targets from the live catalog, including Codex and Claude when selected. Existing `roles.review` settings remain valid and are preserved as the single-reviewer choice. The selection rule is: an explicit task choice overrides saved preferences; otherwise use `reviewPanel` when present, or `roles.review` when absent or `null`. A task override is reported without saving it. Set `reviewPanel` to `null` to return to the saved single reviewer. A failed panel member blocks the panel; never dispatch a partial panel or silently fall back to `roles.review`.

Use the packaged resolver from the project checkout:

```sh
node <plugin-path>/skills/setup-astack/scripts/models.mjs <project-dir> <role> <catalog.json>
node <plugin-path>/skills/setup-astack/scripts/models.mjs <project-dir> --check <catalog.json>
```

`resolveRole(config, role, catalog)` and the role command return `null` for inheritance or one validated target. For `review` with a configured panel they return an array of both targets. This leaves every existing single-reviewer result unchanged. Resolve the complete panel before dispatching either member. `resolveConfig(config, catalog)` and `--check` validate all saved pins, including a preserved `roles.review`, and return the resolved role map. Resolution performs no dispatch or writes. A missing project directory, invalid syntax, disabled providers, unavailable models, cross-provider restrictions and unsupported options fail with the role/panel index and target in the diagnostic.

For checked setup, write a temporary choices object with a `roles` map and optional `reviewPanel`, then run:

```sh
node <plugin-path>/skills/setup-astack/scripts/models.mjs --setup <project-dir> <choices.json> <catalog.json>
```

The exported `setupProject(project, choices, catalog)` merges only supplied choices over saved preferences and fills missing roles with `inherit`. Use `{ "roles": {} }` for a preserving rerun or new inherited settings. It validates before writing, atomically replaces `.astack/models.json`, reads it back and returns `{ config, resolved }`. Invalid saved files are reported rather than replaced with defaults. All saved pins must resolve; unavailable choices require an explicit user change. Catalogs and choice drafts stay outside source commits. Node is a helper runtime, not the consuming application's stack; use a supported Node-compatible runtime if Node is unavailable. If the helper cannot run, report setup as incomplete and stop pinned dispatch.

The host catalog has `providers`, each with `providerInstanceId`, `canRunChildTask` and `models`. Models have `id` and optional `options`, whose entries have `id`, `type` (`select` or `boolean`), and a select's allowed `options[].id`. T3's `orchestrator_capabilities` returns this shape, plus `inheritedProviderInstanceId`, provider `canRunCrossProviderChildTask` and diagnostic `constraints`. Cross-provider T3 pins require that capability. Refresh the catalog at setup and before dispatch; never use a committed roster. If a standalone host exposes no such catalog, setup offers `inherit` and reports saved pins as unsupported. Do not invent IDs or translate aliases to make validation pass.

In T3, each resolved target goes to `delegate_task`. Honor the host's native-delegation preference only when it can express the same provider, model and options. Retain each `taskId` and compare returned `providerInstanceId` and `model` with the resolved target at acceptance and completion. A mismatch or missing identity invalidates that contribution's proof. Use [role orchestration](../../astack/references/orchestration.md) for briefs and completion handling. A loop follows the same rule: report an unsupported pinned contribution and stop it; do not silently inherit or translate a T3 pin into a standalone alias.

Inheritance permits direct work in the current session. A pinned target requires actual host dispatch; saying which model you would use is not switching models. A same-model independent review still needs a fresh reviewer. Host/user permission, budgets and one-writer ownership apply regardless of the selected model.
