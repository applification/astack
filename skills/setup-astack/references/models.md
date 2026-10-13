# Model selection

The consuming project owns and commits `.astack/models.json` so its worktrees and agents read the same preferences. Store no secrets.

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

An optional `reviewPanel` holds two pinned targets from different providers, including Codex and Claude when selected. The rule is: an explicit task choice overrides saved preferences; otherwise use the panel when configured, or `roles.review` when absent or `null`. Setting the panel to `null` restores the preserved single reviewer. A failed member blocks the whole panel; no partial dispatch or fallback.

Use the packaged resolver from the project checkout:

```sh
node <plugin-path>/skills/setup-astack/scripts/models.mjs <project-dir> <role> <catalog.json>
node <plugin-path>/skills/setup-astack/scripts/models.mjs <project-dir> --check <catalog.json>
```

`resolveRole(config, role, catalog)` and the role command return `null` for inheritance, one target for a single reviewer, or both targets as an array for a panel. Existing single-reviewer results are unchanged. `resolveConfig(config, catalog)` and `--check` validate all saved pins, including the preserved single reviewer, and return the role map. Resolution performs no dispatch or writes. File errors identify the input path; unavailable targets/options identify the role/panel index and target.

For checked setup, write a temporary choices object with a `roles` map and optional `reviewPanel`, then run:

```sh
node <plugin-path>/skills/setup-astack/scripts/models.mjs --setup <project-dir> <choices.json> <catalog.json>
```

`setupProject(project, choices, catalog)` merges supplied choices and fills missing roles with `inherit`. Use `{ "roles": {} }` for a preserving rerun or new inherited settings; an undefined panel update preserves the panel. It validates, writes atomically, reads back and returns `{ config, resolved }`. Invalid files and unresolved saved pins stop setup before replacement. Setup rejects symlinked settings without changing the link or its target. Keep drafts/catalogs outside commits. Use Node or a Node-compatible runtime; an unavailable helper leaves setup incomplete and blocks pinned dispatch.

The catalog has a `providers` array with `providerInstanceId`, `canRunChildTask` and `models`. Models have `id` and optional `options` with `id` and `type`; selects supply allowed `options[].id`. Pins support select and boolean options. Other catalog option types remain valid but cannot be pinned by this resolver. T3 supplies the catalog through `orchestrator_capabilities`, plus `inheritedProviderInstanceId`, provider `canRunCrossProviderChildTask` and diagnostic `constraints`. Cross-provider pins require that capability. Refresh the catalog at setup and before dispatch; never commit a roster or invent IDs. Without a catalog, only inheritance resolves.

Validate task overrides with `resolveRole` using a temporary config containing the chosen role or panel; report the override without rewriting saved preferences. Use [role orchestration](../../astack/references/orchestration.md) for actual dispatch, complete briefs, retained handles and identity checks. Config validation alone proves no execution.
