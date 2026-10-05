---
name: convex
description: Design, implement or review Convex schema, functions, authentication and reactive client integration. Use for Convex backend edits or changes to its data and ownership boundaries.
metadata:
  short-description: "Build Convex data and reactive integration safely"
---

# Convex engineering

Read the actual schema, generated API, scoped instructions, consumers and target deployment. Use [integration guidance](references/integration.md) for setup, framework selection, local development and companion capabilities. Preserve an existing layout; new Bun/Turbo products put the backend in `packages/backend/convex`.

Before backend edits apply `$convex:convex-expert` when available. It supplies current framework procedures; this skill owns Applification's data, client and local-development decisions. If unavailable, use current official docs and scoped project guidance, record the missing review prerequisite, and keep the resulting Convex PR draft until `$convex:convex-reviewer` runs. Do not run a Next.js quickstart inside an existing Vite app.

- Use object-form public functions with validators for arguments and returns; keep server-only helpers internal. Reject untrusted input at the function boundary. Share deterministic domain validation without moving identity or transaction checks to clients.
- Obtain authenticated identity inside each operation and check access to the specific record/account. A UI login gate, opaque ID, MCP scope or previously authorized query does not authorize a later write. Use [WorkOS auth](../workos-auth/SKILL.md) for AuthKit/Connect token boundaries.
- Design indexes from actual access paths: owner/status or parent/time where the query needs them. Use indexed, bounded reads and pagination for unbounded lists; avoid collecting a table and filtering in memory. Validate the index prefix/range against the selected query.
- Keep database reads in queries and transactional writes in mutations. Put external effects in actions; do not assume a network call is inside a database transaction. Use the existing durable scheduler/outbox when retryable effects follow a committed change, with idempotency tied to the operation.
- Let Convex subscriptions own server records in React. Handle loading, unauthenticated and empty states separately. Do not mirror query results into a manually invalidated cache. The official TanStack integration is appropriate when that router/data layer requires it, not because the app uses TanStack Form.
- Store storage IDs and resolve URLs when needed. Keep credentials in server environment variables. Scope an HTTP MCP adapter to the same authorized backend operations rather than implementing a second permission model.

Check type generation and a push against the named authorized development deployment. Exercise changed permitted/denied operations and a fresh read after a material write. Test pagination, concurrency or migration behavior when affected. Keep local state persistent during ordinary development, disposable tests isolated, and cloud deployment an explicit owner choice. A local push establishes neither hosted auth nor production readiness.

Return data/permission changes, actual target, observations and gaps. Review the completed Convex diff through `$convex:convex-reviewer` before PR readiness; [pr](../pr/SKILL.md) owns publication.

Primary guidance: [functions](https://docs.convex.dev/functions), [indexes](https://docs.convex.dev/database/reading-data/indexes/), [authentication](https://docs.convex.dev/auth), [local deployments](https://docs.convex.dev/cli/local-deployments).
