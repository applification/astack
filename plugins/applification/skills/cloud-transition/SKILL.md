---
name: cloud-transition
description: Move an app to the chosen cloud environment while preserving local development, validating data and retaining recovery.
metadata:
  short-description: "Move an app to an owner-selected host with recovery proof"
---

# Move an app to cloud

Before editing, apply [affected-capability selection](../astack/references/capability-selection.md) for the boundaries this task reaches. Reuse a selected skill already in progress; do not restart through astack.

New astack apps start with local development. A user request such as “move this app to cloud” initiates this delivery workflow; building an app, provisioning an auth sandbox or finding an integration that needs a public URL does not initiate it. Preserve an existing app's accepted deployment until its user requests a transition. Cloud delivery belongs inside astack, including configuration, data decisions, deployment, actual hosted proof and recovery.

## Establish the transition

Inspect the working local app, its deployment identity, schema, ownership, local state, frontend build and auth/MCP configuration. Read `.astack/project.md` and current provider guidance. Identify the actual team, project and named cloud deployment, its type (development, preview or production), frontend host/domain and release revision. Ask only for missing user choices or credentials. A request to move authorizes the transition within those choices; it does not authorize unrelated spending, replacing an occupied deployment's data or changing someone else's auth environment.

Record a short transition contract under `.astack/cloud/`: source and target identities, user decisions, data policy, configuration mapping, deployment commands, acceptance and recovery. Finish reversible implementation, local checks, backups and reviewable configuration before any still-required final approval. Use existing owner authority; do not add a second confirmation when already authorized.

## Preserve local development and choose data

Keep local `.convex` state and ignored local environment files. Use a separate release checkout or explicitly separate deployment files so a cloud command cannot silently retarget `bun run dev`. Record how to return to the same local deployment and prove it still starts. Preserve the last working release, cloud configuration and any existing target data before changes. Backups contain private data and credentials: store them outside tracked evidence and record paths and checksums without exposing contents.

Ask whether the cloud app starts empty or transfers selected local data. Do not infer “transfer everything” from “move”. Temporary proof users must not become hosted users. For real data, decide how WorkOS subjects, memberships, document IDs, references and stored files survive or are mapped. Validate the schema and selected snapshot; pause writes for a consistent export when necessary. Use [Convex export](https://docs.convex.dev/cli/reference/export) with file storage when relevant and [import](https://docs.convex.dev/cli/reference/import) against the explicit target. An occupied target needs an agreed merge/replacement policy. Do not bypass that choice with replacement or skip-confirmation flags. Verify counts, references, files and authorized fresh reads after transfer. If transfer is declined, verify the hosted app starts empty.

## Configure and deploy the chosen surfaces

Use installed CLI help and current [deployment selection](https://docs.convex.dev/cli/reference/deployment) and [deploy](https://docs.convex.dev/cli/reference/deploy) documentation. Authenticate through the supported provider flow; create/select the chosen project and deployment. Verify identity before each write. `convex deploy` normally targets the project's default production deployment, even if development selected another deployment. Scope releases to an exact deployment key or verified explicit target. Store keys privately, use per-target environment files and keep deploy keys out of browser variables. Report the actual target and deployed revision.

| Surface | Required transition |
| --- | --- |
| Convex | Set server variables, build identifier and actual resource URL; push schema/functions and check indexes and migration results. Remove local proof issuer, JWKS and token settings; explicitly disable proof mode where the auth configuration requires a mode value. |
| Frontend | Set the chosen cloud client URL in the platform's public build variable, configure hosted origin/router, build and deploy through the chosen host. Preserve local values separately. A backend deployment alone does not host a Vite frontend. |
| WorkOS | Select the intended environment; register hosted redirects, logout and CORS origins. Configure the deployed authentication API domain and supported production session settings. Preserve local callbacks. Follow [web and MCP identity guidance](../astack/references/foundation.md#identity-across-web-and-mcp). |
| MCP | Set exact HTTPS resource URL, issuer and audience; update discovery and WorkOS Connect resource/client settings. Refresh the real host's connection/consent. Preserve distinct web/MCP credentials and backend ownership enforcement. |
| CI/integrations | Scope secrets, build variables, webhook URLs and release permissions to this target; keep local startup independent of cloud release credentials. |

## Verify hosted behavior and retain recovery

Drive the actual hosted URL with an authorized identity: login/session renewal, create and fresh backend read, reactive updates and ownership rejection. Through the actual HTTPS MCP endpoint, check discovery, OAuth issuer/audience/scopes, subject continuity, rejected wrong-resource/web/expired tokens and a persisted tool write observed by web. Exercise installed MCP UI in the intended host when part of delivery. Record deployed revision, environment, actions and results. Local readiness, builds and Storybook remain local evidence. Missing provider/host access is an explicit gap; do not declare hosted delivery complete on that basis.

Check preserved local startup/data after cloud deployment. Document code/config rollback and target-backup restoration, including writes since cutover. If cutover fails, restore routing and the last working target/configuration; reconcile new writes before destructive restoration. Revoke temporary release credentials when appropriate. Finish with the PR, actual hosted proof, user choices, limits and recovery steps. Do not merge or release beyond the user's authority.
