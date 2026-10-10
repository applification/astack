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

Omitted roles inherit. A pinned role uses a target object with `providerInstanceId`, `model`, and optional `options` (a map of option IDs to string or boolean values). Pins apply only where the host exposes that exact target; provider IDs, model IDs and options are not universal across T3 and standalone hosts.

Use the packaged resolver from the project checkout:

```sh
node <plugin-path>/skills/setup-astack/scripts/models.mjs <project-dir> <role> <catalog.json>
```

It returns `null` for inheritance or the validated target to pass to the host. A missing project directory, invalid syntax, disabled providers, unavailable models and unsupported options fail with a diagnostic. It performs no dispatch or writes. To validate a proposed object before saving, import its exported `resolveRole(config, role, catalog)` and call it for each role. Node is a helper runtime, not the consuming application's stack; use a supported Node-compatible runtime if Node is unavailable. If the helper cannot run, report the validation gap before dispatching a pin.

The host catalog has `providers`, each with `providerInstanceId`, `canRunChildTask` and `models`. Models have `id` and optional `options`, whose entries have `id`, `type` (`select` or `boolean`), and a select's allowed `options[].id`. T3's `orchestrator_capabilities` returns this shape. If a standalone host exposes no such catalog, setup offers `inherit` and reports saved pins as unsupported. Do not invent IDs or translate aliases to make validation pass. Keep temporary catalogs outside source commits.

In T3, the target goes to `delegate_task`. Honor the host's native-delegation preference when it can express the same provider, model and options. Retain the task ID and inspect the returned provider/model and result. Dispatch only through capabilities that preserve the exact target. A cross-provider target requires a host that supports it. A loop follows the same rule: report an unsupported pinned contribution and stop it; do not silently inherit or translate a T3 pin into a standalone alias.

Inheritance permits direct work in the current session. A pinned target requires actual host dispatch; saying which model you would use is not switching models. A same-model independent review still needs a fresh reviewer. Host/user permission, budgets and one-writer ownership apply regardless of the selected model.
