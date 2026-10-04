# astack WorkOS sandbox

Observed on 2026-10-04 through the connected WorkOS management operations and public OAuth discovery. This is provider configuration evidence; live login and MCP OAuth have not been completed.

| Resource | Verified value |
| --- | --- |
| Project | `astack` — `project_01M44GM0F6BRQ9ND1ATCEVE96E` |
| Environment | `Staging` — `environment_01M44GM0FT8SCNA5D3CYQNY2E5`, `sandbox: true` |
| Default web application | `app_01M44GM0YB4RMXZQFRSDQ84AB7` |
| Web client ID | `client_01M44GM0TDFFAQKQA7YFX23ZDY` |
| AuthKit issuer | `https://friendly-site-75-staging.authkit.app` |
| Redirect and logout URIs | `http://localhost:5173/` (default), `http://127.0.0.1:5173/` |
| CORS origins | `http://localhost:5173`, `http://127.0.0.1:5173` |
| Dynamic client registration | Enabled; read back as `true` |
| Client ID Metadata Document | Enabled; read back as `true` |
| OAuth resource indicators | Empty; actual public MCP resource URL still required |

`createProjectWithNewEnvironments` used `includeProductionEnvironment: false`. The project has exactly one sandbox environment. All subsequent mutations targeted that sandbox or its applications. Existing projects were untouched. No test identities, invitations or emails were created. One disposable Connect application was registered for the check below and removed. No API key secrets were retrieved or retained.

Public [authorization server metadata](https://friendly-site-75-staging.authkit.app/.well-known/oauth-authorization-server) returned the exact issuer above, `/oauth2/authorize`, `/oauth2/token`, `/oauth2/jwks`, PKCE `S256`, and authorization-code, refresh-token and device-code grants. An earlier read after enabling DCR omitted `registration_endpoint`. After enabling CIMD, a fresh no-cache request advertised `client_id_metadata_document_supported: true` and `/oauth2/register`.

A disposable public OAuth client registered through `/oauth2/register` with HTTP `201`, authorization-code and refresh-token grants, authentication method `none`, and callback `http://127.0.0.1:5173/`. The returned public client was `client_01M44HQJG49SS20K2J04ADDSSQ`; its exact application `app_01M44HQJG5YG5WTHD51ZMC16Z7` was deleted through `deleteApplication`. Readback confirmed zero dynamically registered applications remained. This proves DCR registration and cleanup. CIMD client onboarding, login, consent, token issuance, refresh and authenticated MCP access remain unverified.

The web sandbox has no custom authentication API domain. [WorkOS's React guidance](https://workos.com/docs/authkit/react) requires `AuthKitProvider devMode={true}` for that development setup; the AuthKit hosted issuer is not itself a custom authentication API domain. The SPA must explicitly opt into that development mode and use the registered callback. Access-token refresh, logout and the actual Convex user identity still need live verification.

[WorkOS's MCP guidance](https://workos.com/docs/authkit/mcp) requires the deployed MCP endpoint as a Resource Indicator so tokens carry its exact audience. CIMD is enabled following WorkOS's current recommendation, with DCR retained for client compatibility. Configure the resource only once its actual public HTTPS URL exists. No loopback HTTPS resource was invented. Consent, token refresh, exact-audience verification and installed-host behavior remain gaps.

For controlled live tests, [WorkOS's staging recipe](https://workos.com/docs/authkit/testing) uses a scoped API key and dedicated verified test identity. The management connector exposes key metadata rather than the SDK key secret, and its `createUser` operation has no `emailVerified` parameter. Such credentials must stay in ignored local configuration or a secret store. Owner-operated hosted/social login is another way to establish a real sandbox session. Neither path was performed in this setup.
