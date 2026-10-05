---
name: app-control
description: Create or repair a project-owned control CLI and feature map for driving and observing its running product.
metadata:
  short-description: "Build product-driving commands and feature maps"
---

# Make the app controllable

Use this directly to build, repair or assess a product's control route, or when astack delivery needs repeatable product driving. The result is a working project control skill/CLI plus a small feature map, not a wrapper around lint and tests.

Inspect the real user entry points, existing drivers, startup, auth/fixtures and `.astack/project.md`. Reuse a working route before building another. Follow the [control contract](references/control-contract.md) for the executable, identity checks, instance/test ownership and map format.

Build only the commands needed to launch or connect, diagnose identity, perform a real user action, observe its result and clean up. Use the project's installed runtime and package manager. Put the project-specific skill and executable under `.codex/skills/astack-<app>/`, and the user-facing map under `.astack/feature-map/<app>/`. Keep selectors and runtime knowledge in the project, not this plugin.

Prove the documented direct invocation and help from a fresh checkout, then use [verify](../verify/SKILL.md) for one mapped path through the actual product. Establish the correct build and fixture, independently read material side effects, and confirm evidence remains after cleanup. Stop only owned processes; an open port alone does not establish checkout identity.

Return the executable path, commands, map, observed case/evidence and remaining coverage or prerequisite gaps. Kept changes finish through [pr](../pr/SKILL.md). For a read-only assessment, report missing capabilities without generating files. A blocked driver remains draft; do not claim a working route from scaffolding.
