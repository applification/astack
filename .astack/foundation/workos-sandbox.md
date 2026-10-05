# astack WorkOS sandbox

Observed on 2026-10-04 and updated on 2026-10-05 through connected WorkOS management operations and public OAuth discovery. Configuration and browser authorization entry were observed; completed live login and MCP OAuth remain unverified.

| Resource                    | Verified value                                                        |
| --------------------------- | --------------------------------------------------------------------- |
| Project                     | `astack` — `project_01M44GM0F6BRQ9ND1ATCEVE96E`                       |
| Environment                 | `Staging` — `environment_01M44GM0FT8SCNA5D3CYQNY2E5`, `sandbox: true` |
| Default web application     | `app_01M44GM0YB4RMXZQFRSDQ84AB7`                                      |
| Web client ID               | `client_01M44GM0TDFFAQKQA7YFX23ZDY`                                   |
| AuthKit issuer              | `https://friendly-site-75-staging.authkit.app`                        |
| Redirect and logout URIs    | `http://localhost:5173/` (default), `http://127.0.0.1:5173/`          |
| CORS origins                | `http://localhost:5173`, `http://127.0.0.1:5173`                      |
| Dynamic client registration | Enabled; read back as `true`                                          |
| Client ID Metadata Document | Enabled; read back as `true`                                          |
| OAuth resource indicators   | Empty; actual public MCP resource URL still required                  |

`createProjectWithNewEnvironments` used `includeProductionEnvironment: false`. The project has exactly one sandbox environment. All subsequent mutations targeted that sandbox or its applications. Existing projects were untouched. No test identities, invitations or emails were created. One disposable Connect application was registered for the check below and removed. No API key secrets were retrieved or retained.

Public [authorization server metadata](https://friendly-site-75-staging.authkit.app/.well-known/oauth-authorization-server) returned the exact issuer above, `/oauth2/authorize`, `/oauth2/token`, `/oauth2/jwks`, PKCE `S256`, and authorization-code, refresh-token and device-code grants. An earlier read after enabling DCR omitted `registration_endpoint`. After enabling CIMD, a fresh no-cache request advertised `client_id_metadata_document_supported: true` and `/oauth2/register`.

A disposable public OAuth client registered through `/oauth2/register` with HTTP `201`, authorization-code and refresh-token grants, authentication method `none`, and callback `http://127.0.0.1:5173/`. The returned public client was `client_01M44HQJG49SS20K2J04ADDSSQ`; its exact application `app_01M44HQJG5YG5WTHD51ZMC16Z7` was deleted through `deleteApplication`. Readback confirmed zero dynamically registered applications remained. This proves DCR registration and cleanup. CIMD client onboarding, login, consent, token issuance, refresh and authenticated MCP access remain unverified.

The web sandbox has no custom authentication API domain. [WorkOS's React guidance](https://workos.com/docs/authkit/react) requires `AuthKitProvider devMode={true}` for that development setup; the AuthKit hosted issuer is not itself a custom authentication API domain. The SPA must explicitly opt into that development mode and use the registered callback. Access-token refresh, logout and the actual Convex user identity still need live verification.

[WorkOS's MCP guidance](https://workos.com/docs/authkit/mcp) requires the actual MCP endpoint as a Resource Indicator so tokens carry its exact audience. CIMD is enabled following WorkOS's current recommendation, with DCR retained for client compatibility. On 5 October, the provider accepted and read back the exact local resource `http://127.0.0.1:3211/mcp`, marked default. External access still requires the chosen HTTPS resource. The reference permits HTTP only at the local Convex site's exact loopback origin and `/mcp`. Consent, token refresh, exact-audience token issuance and installed-host behavior remain gaps.

The default AuthKit application `app_01M44GM0YB4RMXZQFRSDQ84AB7` now preserves both 5173 callbacks/logout URLs and adds both 5174 callbacks/logout URLs, with matching localhost and 127.0.0.1 CORS origins. Environment-level `setRedirectUris` rejected the existing IDs; the application-specific mutation succeeded using the exact application ID. Fresh readback confirmed the saved settings. The public client ID and issuer were saved to ignored browser/backend local files through `setup:workos`; startup applied them to persistent local Convex, whose health reports WorkOS mode and the loopback resource. No cloud Convex deployment was created.

Actual Chromium visits to web 5173 and MCP preview 5174 showed the sign-in/connection actions and reached this sandbox's hosted sign-in page without uncaught page errors. The MCP preview's disposable public DCR client was `client_01M45R09FHS43C4BTE43B8TD3Y` / `app_01M45R09FHEY687WRDCSB27J45`; it was removed after the smoke check. This establishes browser discovery/registration/authorization entry, not successful login, consent, token issuance or refresh. Owner-operated sign-in is pending.

The auth strategy now follows [ADR 0005](../../docs/adr/0005-authentication-proof-hierarchy.md): Emulate for normal local/CI auth; astack Staging for disposable programmatic provider users; explicit manual G1/G2 and separate installed-host H1 acceptance. The [reference procedure](../../examples/foundation/.astack/auth-testing.md) specifies setup, generated passwords, SDK authentication, teardown and recovery. There is no canonical shared manual login.

On 5 October, an exact search found the unused `voiced@applification.net` test record (`user_01M45T2NKBZ5F9G6TTJC3BWVS9`), with no password, identities or sessions. It was deleted through the authorized management operation; a fresh exact-email query returned an empty list. The connected management tools still expose key metadata rather than the scoped SDK secret. This prevents an observed staging SDK login until that key is configured; it does not prevent deterministic Emulate proof. Historical browser entry/configuration observations above remain configuration evidence, not completed acceptance.
