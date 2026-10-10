---
name: cloud-transition
description: Move an app to the chosen cloud environment while preserving development, validating data and retaining recovery.
metadata:
  short-description: "Move an app to an owner-selected host with recovery proof"
---

# Move an app to cloud

Use this for a requested deployment or hosting transition. Read the project's instructions, chosen stack, current deployment and commands, including `.astack/project.md` when present. A feature request or a need for a public test URL does not select a host or authorize an unrelated migration.

## Establish the transition

Identify source and target environments, their owners, existing data, deployed revision, runtime requirements and credentials. Honour fixed hosting choices. For open choices, compare providers against the product's constraints, explain trade-offs and decide within delegated authority. Ask only about unresolved product, preference or access decisions.

Record the intended behavior, data policy, configuration mapping, acceptance and recovery in the project's existing decision record or the PR. Complete reversible implementation and checks before any required final approval. Existing authority still applies; a transition does not authorize unrelated spending or replacing another deployment's data.

## Preserve development and data

Keep development commands and state separate from release targets and credentials. Verify the actual environment before each write. Preserve the last working release, configuration and existing target data before changing them. Store backups and secrets outside Git.

Use an agreed data policy: start empty, transfer selected data or migrate existing target records. Validate snapshots, identity mappings, references and stored files with the selected provider's tools. Pause writes for a consistent export when required. An occupied target needs an explicit merge or replacement decision. Check counts and fresh authorized reads after migration; disposable proof identities must not become production users.

## Deploy and verify the selected surfaces

Use the chosen providers' installed CLI help and current documentation. Scope release commands to the verified target and revision. Deploy only the surfaces the product has: backend, frontend, authentication, protocols and integrations. Update their resource URLs, origins, callbacks, build variables and secrets without retargeting development. Apply platform skills only for technologies already selected.

Exercise the real hosted behavior with an authorized fixture: startup, the changed user path, a fresh read after a material write and relevant access denials. Check protocol discovery, credentials and installed-host behavior when those surfaces are part of the transition. Local tests and component stories do not establish hosted behavior; report unavailable provider or host checks as gaps.

Recheck preserved development. Document rollback and restoration, including writes made after cutover, and retain a recoverable release. Stop only owned temporary resources. Use [verify](../verify/SKILL.md) for observed outcomes and [pr](../pr/SKILL.md) for kept changes. Report the target, revision, data decisions, actual observations and recovery limits; do not merge or release beyond the user's authority.
