---
name: workos-auth
description: Implement or diagnose WorkOS AuthKit web sessions, Convex authentication or Connect MCP OAuth, including token validation, same-user identity and permitted/denied operations.
metadata:
  short-description: "Keep WorkOS web and MCP identity boundaries explicit"
---

# WorkOS authentication

Use directly for a WorkOS integration or auth defect. Inspect the installed SDKs, current callbacks/origins, server auth configuration, actual resource URL and ownership checks. Keep existing provider/project conventions. For new Applification web/MCP products use AuthKit for web and Connect for MCP; they share a user system with distinct token contracts.

## Web session and data access

Follow the selected framework's AuthKit integration and [Convex's AuthKit adapter](https://docs.convex.dev/auth/authkit/add-to-app). Treat the web login session and Convex's validated auth readiness as separate states. Gate authenticated queries on the latter; test initial loading, sign-out and expired session behavior. Derive the principal from verified identity server-side, not a client-supplied user ID. Keep ownership checks in the operation that reads or writes data.

Register the checkout's actual origin and callbacks, including the worktree/preview hostname. Preserve unrelated dashboard settings and verify saved values through a fresh read when authorized to change them. Keep API keys and session secrets server-side; public client IDs do not prove issuer/audience configuration.

## MCP resource token

Use [Connect's MCP flow](https://workos.com/docs/authkit/mcp) and [token claims](https://workos.com/docs/authkit/connect/token-claims). Publish protected-resource/authorization discovery for the exact resource. At HTTP entry validate signature with the issuer's keys, accepted issuer, intended audience/resource and expiry before calling domain operations. Reject missing/wrong-resource/expired credentials. Never forward a bearer token to another resource or substitute a web session token.

Map the verified subject to the same backend principal used by web. Resource scopes and record/account permission are separate checks. Prove same-user continuity with the same real WorkOS user across both surfaces; two arbitrary fixture strings are not that evidence. Use [MCP server](../mcp-server/SKILL.md) for the protocol adapter and OAuth errors.

## Choose the auth proof layer

Read [auth testing](references/testing.md) for Emulate, disposable provider and manual/installed-host boundaries. Start ordinary local/CI testing with WorkOS Emulate and seeded identities. Use disposable real Staging identities only under provider-test authority, with cleanup/recovery ownership; never recreate a shared test account. Do not make a live dashboard change merely to repair an emulated fixture.

Return token/session ownership, positive and denied observations, exact environment and remaining provider/host gaps. A local token test does not establish real redirect, consent, renewal or target-host OAuth. [verify](../verify/SKILL.md) consolidates proof; [pr](../pr/SKILL.md) owns kept changes and readiness.
