# Move this reference to cloud

Start locally with `bun run dev`. Moving to cloud is an explicit user decision. This file supplements astack's [cloud transition workflow](https://github.com/applification/astack/blob/main/plugins/applification/skills/astack/references/cloud-transition.md) with reference commands. No cloud project, host or data-transfer choice is preselected.

Record the chosen Convex team/project/deployment/type, frontend host/domain, WorkOS environment, revision, empty-versus-transfer decision and recovery policy in `.astack/cloud/transition.md`. Keep credentials and snapshots private. Preserve `packages/backend/.env.local` and `packages/backend/.convex`; a separate clean release checkout keeps cloud configuration independent. `bun run dev` and `bun run convex:local` deliberately refuse cloud targets.

## Local preparation and data choice

Run `bun run check:ci`, `bun run readiness` and `bun run design:verify`. These establish local checks only. With persistent local Convex running (`bun run dev` or `bun run dev:backend`), export a private snapshot from the project root:

```sh
bun run convex:local -- export --include-file-storage --path /absolute/private/local-snapshot.zip
```

Keep snapshots out of Git and public proof archives. Record checksum and schema/ownership review. Ask whether to start empty or transfer selected real data. Readiness users (`proof-owner-*`) and tokens stay local. Explicitly map subjects/memberships if WorkOS environments change. Check stored files and document references as well as counts. An occupied target requires an agreed merge/replacement policy and target backup before import.

## Explicit cloud configuration

Use Node 24, the committed Bun lockfile and installed Convex CLI (currently 1.46.0). In the release checkout's `packages/backend`, run `bunx --no-install convex dev --configure --dev-deployment cloud` to select/create the user-chosen cloud development project. Follow installed help and interactive provider authentication. Cloud development and production are distinct choices. Do not run this in the preserved local checkout.

For production or another named release, use `convex deployment` to select/create the intended deployment. Save an exact deployment-scoped key privately with `bunx --no-install convex deployment token create <release-token-name> --deployment <team:project:deployment> --save-env /absolute/private/.env.cloud`. Verify the target and use that file for every cloud command. `convex deploy` otherwise selects the project's default production deployment. Never guess the target or copy this key into frontend values or local `.env.local`.

Set server values against that target: `WORKOS_CLIENT_ID`, `WORKOS_AUTHKIT_DOMAIN`, exact HTTPS `MCP_RESOURCE_URL`, hosted `WEB_ORIGIN` and `ASTACK_BUILD_ID` identifying the revision. Use `convex env` with `--env-file /absolute/private/.env.cloud`; supply secrets through supported interactive/stdin or private file routes. Set `ASTACK_PROOF_MODE=disabled` (the current auth configuration reads this value at push time); remove fixture `ASTACK_PROOF_ISSUER`, `ASTACK_PROOF_JWKS`, `ASTACK_PROOF_WEB_AUDIENCE` and proof-token values. Build the MCP resource with `bun run build:mcp-ui` in the release root, then deploy from its backend using `bunx --no-install convex deploy --env-file /absolute/private/.env.cloud`.

If transfer was selected, use `convex import` with that same private target file after backup and schema/ownership review. Check installed flags; avoid `--replace`, `--replace-all` or `--yes` unless that exact replacement was authorized. Verify imported counts, relationships, files and authorized fresh reads. If no transfer was selected, verify hosted data starts empty.

## Frontend, WorkOS and MCP

The Vite frontend needs its own chosen host. Set public `VITE_CONVEX_URL` to the cloud client URL, `VITE_WORKOS_CLIENT_ID`, hosted `VITE_WORKOS_REDIRECT_URI`, `VITE_WORKOS_DEV_MODE=false` and `VITE_WORKOS_API_HOSTNAME` for its configured authentication API domain. Set no `VITE_ASTACK_PROOF_*` values. Build `apps/web` and deploy its `dist` with SPA routing through that host. Keep local `apps/web/.env.local` separate.

In the intended WorkOS environment, register hosted redirect/logout/CORS origins and the authentication API domain; preserve local callbacks. Configure WorkOS Connect's exact HTTPS resource and allowed OAuth clients. Discovery, token audience and backend resource must agree. Refresh the intended MCP host's connection after changing the URL. Web session and MCP OAuth tokens remain distinct credentials for the same authorized user.

## Hosted acceptance and recovery

Retain actual hosted observations: `/health` revision identity; web login, refresh, create and fresh backend read; reactive updates and another user's rejection; MCP discovery, OAuth, same-subject continuity, audience checks and tool writes visible in web. Exercise installed MCP UI in the chosen host if included. Local readiness/stories cannot substitute. Mark missing access or failures explicitly; do not report deployment complete from a build alone.

Restart the preserved local checkout with `bun run dev` and verify its prior data remains. Record the last working hosted release/configuration, target snapshot and rollback commands. On failed cutover restore previous routing/release and reconcile subsequent writes before restoring data. Revoke temporary deploy keys where appropriate. The app can continue local development after hosting; moving or recovering does not require deleting local state.
