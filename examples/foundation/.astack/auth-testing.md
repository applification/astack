# Authentication proof

The owner selected this hierarchy on 5 October 2026. Each tier proves a different boundary. A passing local check never turns a provider or installed-host gap into a pass.

| Tier                  | Default route                                                                      | What it establishes                                                                                                                                                              | What it does not establish                                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| WorkOS Emulate        | `bun dev`, `bun run auth:verify`, `bun run readiness`, normal CI                   | Seeded users/linked identities, AuthKit password/code sessions, official React/Convex adapter, refresh rotation/replay/revocation, persisted ownership and denial across web/MCP | Real Hosted AuthKit, real Connect consent/DCR/PKCE/resource negotiation/refresh, real-provider continuity, installed ChatGPT |
| astack WorkOS Staging | `bun run auth:staging`, optional provider CI workflow                              | Disposable verified users with generated passwords, real SDK authentication, signature/issuer checks, session refresh and revocation, user cleanup                               | Hosted login/redirect UI, MCP consent/exact-resource issuance, real web ↔ MCP continuity, installed ChatGPT                  |
| Manual G1/G2          | Temporary identity from `bun run auth:acceptance -- create`; `bun run dev:staging` | Observed Hosted AuthKit login/redirect/refresh/subject continuity; real MCP consent/exact-resource tokens; same WorkOS subject and owned data across web/MCP                     | Installed ChatGPT until separately exercised                                                                                 |
| Installed-host H1     | Actual ChatGPT MCP/App installation with an authorized temporary identity          | That host's OAuth, tool selection, resource rendering and persisted interaction                                                                                                  | Other untested hosts/accounts                                                                                                |

## Local development and CI

`bun dev` starts persistent local Convex and WorkOS Emulate on port 4100. Web uses the official AuthKit React and Convex providers against that emulator, with its interactive password page. Sign in as `owner@example.com` or `other@example.com`, password `Local-Emulate-only-2026!`. These public fixtures exist only in local memory. Pinned user IDs keep local ownership stable across restarts; sessions and signing keys are recreated. Never seed these identities/passwords in staging or production.

At port 5174, **Connect with Emulate** loads the actual MCP App with an Emulate-issued Connect token for the seeded owner. It deliberately skips real OAuth consent. Emulate's Standalone Connect application pins the local resource as its audience. This checks the resource server's claim validation and same seeded subject mapping; it does not demonstrate provider Resource Indicator handling. Its current Connect implementation has no consent UI, DCR, PKCE or refresh token coverage. Each preview connection obtains a fresh local Connect token from a loopback-only development route; reconnect to renew it after expiry. This is local token issuance, not real Connect OAuth refresh. **Refresh work items** rereads data, not OAuth credentials.

`auth:verify` checks seeded identities, bad passwords, signature/issuer/audience, refresh rotation, replay and revocation. Revocation prevents renewal; a previously issued access JWT may remain valid until expiry. `readiness` R1–R11 owns a disposable Emulate/Convex/browser runtime, drives an actual AuthKit browser login, reads persisted effects independently, and exercises other-user, anonymous, expired and wrong-audience denial. Only expired/wrong-audience negative controls are synthetically signed; successful sessions and Connect tokens come from official Emulate endpoints. The normal CI workflow needs no WorkOS credentials or external login.

Emulate mode is rejected outside loopback Convex. Its public JWKS is installed only for that local mode. Staging startup selects real issuers and disables synthetic proof authentication. Switching modes preserves saved public staging settings and local data; real staging users and Emulate users own separate rows.

## Real provider setup

Keep astack **Staging**, environment `environment_01M44GM0FT8SCNA5D3CYQNY2E5`, client `client_01M44GM0TDFFAQKQA7YFX23ZDY`. Save its public web/MCP configuration with `setup:workos` as described in README.md. Select it explicitly with `bun run dev:staging`; ordinary `bun dev` keeps using Emulate.

For SDK checks, store the following in ignored `.env.workos-staging` with mode 0600, or supply them from a secret store. The connected management tools do not expose the SDK API key. No API key belongs in Vite/browser configuration.

```dotenv
WORKOS_STAGING_ENVIRONMENT_ID=environment_01M44GM0FT8SCNA5D3CYQNY2E5
WORKOS_STAGING_CLIENT_ID=client_01M44GM0TDFFAQKQA7YFX23ZDY
WORKOS_STAGING_API_KEY=sk_test_REPLACE_FROM_SECRET_STORE
```

Run `bun run auth:staging`. This opt-in route uses only the dedicated staging client and a scoped staging API key. Each run generates a unique `astack-proof+<uuid>@example.com` identity and password, marks email verified because email verification is not under test, authenticates with the server SDK, and cleans up in `finally`. It uses no permanent shared user/password and does not automate Hosted AuthKit or send Magic Auth email. This SPA has no server-side `wos-session` cookie: do not inject sealed-cookie state from another platform's recipe and call that SPA proof.

The optional `foundation-staging.yml` GitHub workflow runs only when manually dispatched and reads `ASTACK_WORKOS_STAGING_API_KEY` from GitHub secrets. It is separate from ordinary PR CI. Missing/invalid credentials produce a skipped report and nonzero exit, never a successful provider check.

## Disposable identities and recovery

Fixture setup journals its run ID and owned external ID before creating a user, so a lost create response can be recovered. Normal automated journals contain no password or session credentials. Failed cleanup retains the private journal under ignored `.auth-fixtures/`; retry with `bun run auth:acceptance -- cleanup <run-uuid>` using the same staging key. If a CI runner is interrupted or its private journal is lost, use the nonsecret run UUID in its provider report with `bun run auth:acceptance -- recover <run-uuid>`. This reconstructs only the owned fixture metadata; it does not recover or reuse a password. Cleanup resolves the exact owned external ID, checks identity/email, deletes the user, verifies removal and then removes the journal. It never adopts an existing user by email or deletes an arbitrary user ID.

For a manual acceptance run, `bun run auth:acceptance -- create` writes a temporary generated password to a private mode-0600 lease file and prints only its path and cleanup command. Read that file privately for sign-in. The lease records a two-hour acceptance deadline; it does not schedule automatic deletion. Finish or abort the run, delete acceptance-created work items through its authenticated web/MCP actions, then invoke identity cleanup. Interrupted runs must be cleaned from the journal before another acceptance run. Do not commit credentials or browser storage state. `.auth-fixtures` is excluded from generation, source hashes and retained proof archives.

`voiced@applification.net` is not a canonical fixture. Its unused astack Staging test record was removed on 5 October 2026 and an exact-email query returned no users afterwards. Do not recreate it as test infrastructure.

## Manual acceptance record

Record the revision, actual URLs, staging environment, temporary run ID, actions and observations without tokens/passwords. Keep each row explicitly `pass`, `fail`, `inconclusive` or `skipped`.

| ID  | Required observation                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Real Hosted AuthKit login returns to the registered web callback; an independently authenticated backend read confirms its WorkOS `user_` subject; web reload/token refresh preserves that subject and owned data. Record actual refresh, not merely the login screen.                                                                                                                                           |
| G2  | Real MCP authorization displays consent and returns through the client's callback. Verify the provider-issued token has the configured issuer, valid signature/expiry and the exact MCP resource audience; the web token is rejected at `/mcp`. Sign in with the same temporary identity and confirm the same subject and owned item resolve across web and MCP. Exercise real Connect token refresh separately. |
| H1  | Install/connect the actual ChatGPT MCP/App against the chosen public HTTPS resource. Observe OAuth, tool choice, App rendering and a persisted interaction. A local AppBridge preview is insufficient.                                                                                                                                                                                                           |

References: [WorkOS testing](https://workos.com/docs/authkit/testing), [official Emulate](https://github.com/workos/emulate) and [WorkOS MCP OAuth](https://workos.com/docs/authkit/mcp). Emulate is pinned at 0.14.0; reassess its coverage when upgrading.
