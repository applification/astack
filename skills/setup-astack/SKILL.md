---
name: setup-astack
description: Create and check astack's project model settings using the live host catalog, preserving existing choices and supporting a single reviewer or a two-provider panel.
metadata:
  short-description: "Choose project models for astack's engineering roles"
---

# Configure the agent

Read project instructions and existing `.astack/models.json`. Setup finishes with a saved, checked preference file. Preserve prior choices on reruns; change only choices the user requests.

1. Discover runnable providers, models and options. In T3 use `orchestrator_capabilities`, not the native tool's narrower list. Without a catalog, inherited settings can be checked; saved pins leave setup incomplete until the catalog is supplied or the user explicitly changes them. Do not invent IDs or translate aliases.
2. Use supplied preferences; ask only about unresolved model, reasoning or cost choices. Offer `inherit`, a single reviewer or a panel of two pinned providers, including Codex and Claude when available. Use only live catalog IDs/options and preserve saved choices without another confirmation. Do not guess prices or hard-code a roster.
3. Read [model selection](references/models.md). Put only requested changes in a temporary choices file; `{ "roles": {} }` preserves all existing choices. Run the packaged `--setup` command with the live catalog. It fills omitted roles with explicit `inherit`, validates all saved targets, writes atomically and checks the saved file. A failure leaves prior settings intact and setup incomplete; report the exact prerequisite without substituting a target.
4. Report the saved path and resolved roles/panel. Ensure project instructions tell agents to read this file. Preserve unrelated guidance and store no credentials. Check a small read-only contribution through the actual host for newly selected pinned providers; retain task handles, compare returned provider/model identities with resolved targets and report results or execution gaps. Validation alone does not prove delegation.

Work can begin without saved settings and inherit the current session. Setup records those choices explicitly when invoked; it never changes the main chat's provider. Application scaffolding uses the [new-project playbook](../astack/playbooks/new-project.md); persistent modes and host settings stay with the host.
