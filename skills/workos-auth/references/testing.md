# Auth testing boundaries

| Layer | Useful observations | Limit |
| --- | --- | --- |
| WorkOS Emulate + local backend | Deterministic login/session, subject mapping, permitted/denied operations, wrong issuer/audience and logout. | Establishes local behavior. Check the pinned emulator's features; minted tokens do not prove real DCR, PKCE, consent or Connect refresh. |
| Disposable real WorkOS Staging | Real SDK/provider operations on an owned unique user, cleanup on success/failure and recovery after interruption. | Requires scoped provider authority and secrets. Programmatic auth does not establish the hosted browser or installed client flow. |
| Manual provider acceptance | Hosted AuthKit redirect/login/refresh (G1); real MCP consent, exact-resource token and same-user continuity (G2). | Record actual browser/client, actor and observation. Leave unavailable cases unverified. |
| Installed target host | OAuth connection and authorized App/tool behavior in the real ChatGPT installation (H1). | Separate from direct MCP, emulator, Storybook or local bridge checks. |

For a real provider trial create a unique verified user and generated password at setup, with an owned external-ID journal for interrupted cleanup. Keep credentials in ignored local state or an approved secret store. Bound users, retries and duration; remove only owned identities. Clean up after failures too and retain sanitized source/output identities. A configured provider is not consent to send messages, use production data or broaden the test.

Test both an allowed write and a wrong-owner denial, then read the authoritative record afresh. Check that denying one selected record cannot still affect another owner's records through a bulk operation. A signed token fixture verifies resource-server decisions only; it does not verify the provider's issuance policy.

The worked foundation's actual commands, temporary-identity journal and G1/G2/H1 procedures belong to its [project documentation](https://github.com/applification/astack/blob/main/examples/foundation/docs/engineering-profile.md). Its historical [proof gaps](https://github.com/applification/astack/blob/main/.astack/foundation/backlog.md) remain unverified until observed on the relevant layer/revision.
