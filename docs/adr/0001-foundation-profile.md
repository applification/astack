# 0001: Support one portable interactive foundation

Status: accepted. Date: 2026-10-04. Scope: `examples/foundation` and greenfield interactive defaults.

## Context and decision

The owner chose Convex + MCP and WorkOS as a core profile and a work-item reference. Use Bun workspaces/Turborepo, React/TypeScript/Vite, a standalone app and a separately bundled MCP Apps UI sharing browser-safe presentation. Convex owns the database and domain authorization. Its HTTP action is the MCP resource server: there is no second data API or forwarding of inbound MCP credentials to a downstream service.

Use the official WorkOS AuthKit React/Convex provider for web sessions. Configure the WorkOS Connect issuer and exact MCP resource audience independently for MCP OAuth. Both validated identities map ownership to the same WorkOS subject within the configured environment; `tokenIdentifier` cannot be the cross-surface owner because the issuers differ. Check the MCP credential audience at its entry point even though the deployment supports web credentials too.

Next.js remains an option when public content, server rendering or server application behaviour warrants it. This changes new interactive defaults, not existing projects. COS integrations and OpenAI-specific extensions/events remain later work.

## Alternatives and consequences

A separate MCP gateway would need another delegated backend credential and verification boundary. Serving MCP directly within Convex keeps permission checks beside the data. Native Convex HTTP actions must support the chosen web-standard SDK transport; the reference proves that compatibility. Pin the released SDK 1.x / MCP Apps 1.x profile together rather than mixing incompatible peers.

Disposable readiness uses local signed identities with a data-URI public JWKS and loopback guard. This demonstrates JWT validation and domain permissions; it is not evidence of WorkOS login, remote OAuth or installed ChatGPT support. Production has no local credential fallback.

## Sources and verification

[Convex AuthKit](https://docs.convex.dev/auth/authkit/add-to-app), [WorkOS MCP](https://workos.com/docs/authkit/mcp), [Convex HTTP authentication](https://docs.convex.dev/functions/http-actions#authentication), [custom JWT audience validation](https://docs.convex.dev/auth/advanced/custom-jwt). Compatibility and actual proof are recorded with the foundation evidence, separately from this accepted direction.
