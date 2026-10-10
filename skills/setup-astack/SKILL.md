---
name: setup-astack
description: Configure astack's research, design, implementation and review models for this project using the current host's available providers and reasoning options.
metadata:
  short-description: "Choose project models for astack's engineering roles"
---

# Configure the agent

This configures model roles, not application technology. Read project instructions and `.astack/models.json` when present. Preserve existing choices on a rerun.

1. Discover the current host's runnable providers, models and model options. In T3 use `orchestrator_capabilities`; do not treat a native tool's list as the complete T3 catalog. Pins require the host catalog described in [model selection](references/models.md). If it is unavailable, offer `inherit` and report saved pins as unsupported; do not invent provider IDs or translate model aliases.
2. Ask about reasoning/cost preferences and any preferred models. Propose a short table for `research`, `design`, `implementation` and `review`, using only available choices and supported options. `inherit` uses the current session model/settings. Do not guess prices or hard-code a model roster. No configured model changes the main chat's provider.
3. Confirm the proposed choices as product preferences, or use choices already explicitly supplied by the user. Read [model selection](references/models.md) for the config format and host boundaries. Validate the proposed object with the resolver's exported `resolveRole(config, role, catalog)` for every role before writing `.astack/models.json` atomically. Preserve unrelated project guidance. Store no credentials; track the preferences with the project.
4. Read the saved file and resolve each role again. Ensure the project instructions tell the agent to read this file for astack work. Report the resolved table, project scope and any host limitation. A successful config check does not prove a delegated model actually ran.

Missing configuration defaults to `inherit` for every role. Setup is optional. Do not install an application framework, change host-global settings or create a control CLI as part of model setup. To build a new product, use astack's [new-project playbook](../astack/playbooks/new-project.md).
