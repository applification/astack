# Foundation profile

Use this profile for a new product that needs persistent shared behavior on web and MCP. The [work-item reference](https://github.com/applification/astack/tree/main/examples/foundation) makes the profile concrete: React + TypeScript + Vite, Convex persistence and MCP serving, WorkOS authentication, and portable presentation components. It is a worked starting point, not a requirement to add every surface to a small tool. An existing product retains its working stack unless migration is requested. Follow [project setup](project-setup.md), [database](database.md), [web UI](web-feature.md), and [MCP](mcp-server.md) guidance only at the boundaries the task changes.

## Start from the reference

From an astack checkout, generate a separate project:

```sh
bun scripts/create-foundation.ts /absolute/path/to/my-product
```

Follow the generated README for installation, environment configuration, and startup. Commit the Bun lockfile and retain the generated scoped instructions with the code they govern. Record consequential departures in the project's ADRs; use current official documentation for the selected platform and installed versions. Scaffold output and a successful build establish structure, not integration readiness.

```text
apps/
  web/                 WorkOS web session and Convex React adapter
  mcp-ui/              MCP host bridge and HTML resource bundle
packages/
  ui/                  portable React presentation and forms
  domain/              pure terms, validation, and behavior
  backend/convex/      data, authorization, and HTTP MCP resource server
  config/              shared tooling configuration
```

The reference serves `/mcp` from a Convex HTTP action. Its SDK transport is an adapter around shared backend operations; it does not need a second service in `apps/mcp`. A separate MCP process is appropriate when its runtime or deployment requires one. A stdio tool without persistence can use the smaller [MCP server path](mcp-server.md).

## Keep rules at their owning boundary

| Scope | Rule and worked use | Exception |
| --- | --- | --- |
| `packages/ui` | Receive data and action callbacks through props. A work-item form renders in web and MCP UI without importing Convex, WorkOS, or a host bridge. | Host and data adapters belong to consuming apps. Add a platform-specific component where behavior cannot be shared. |
| `packages/domain` | Keep deterministic validation and terms free of React, protocol, database, and environment imports. Normalize a work-item title here when both clients need the rule. | Persisted identity, membership, and transactional checks stay in the backend. |
| `packages/backend/convex` | Validate public inputs and enforce ownership at the operation that reads or writes. Web and MCP call the same authorized mutations. | External side effects use actions; local presentation state belongs to its UI consumer. |
| Client data adapters | Let Convex subscriptions own Convex state. A mutation updates the subscribed work-item list. | Use another data library for another source, or the official Convex integration when a router requires it; do not create a second manually invalidated copy. |
| Forms | The Vite reference uses TanStack Form with Zod. Preserve native labels, submit behavior, pending/error states, and backend validation. | Choose the documented approach for another platform. An existing Next.js app may use its Server Action form path. |
| Tests | Test pure rules directly, permissions at the backend, MCP contracts through a client, and rendered interactions in a real browser. | A focused component check can cover isolated presentation. File extensions alone neither require nor forbid a test. |

The reference's boundary checks and deliberately invalid fixtures demonstrate rule enforcement. Treat a passing negative fixture as evidence that the check rejects that violation; it does not establish all architectural correctness. Keep scoped instructions, rules, examples, and checks aligned when a boundary changes.

For new React forms, consult [TanStack Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation). For Next.js, consult [the framework's forms guide](https://nextjs.org/docs/app/guides/forms) and keep authorization inside the server operation. Convex's [React client](https://docs.convex.dev/client/react/overview) supplies subscriptions and mutations. Its [TanStack Query integration](https://docs.convex.dev/client/tanstack/tanstack-query) is an option where that platform needs it; adding TanStack Form does not require adding Query.

## Identity across web and MCP

Use WorkOS AuthKit for the web session and [WorkOS Connect for MCP OAuth](https://workos.com/docs/authkit/mcp). They share the user identity system, but have different token contracts. Follow [Convex's AuthKit integration](https://docs.convex.dev/auth/authkit/add-to-app) for the selected web framework. Gate authenticated Convex reads on Convex's validated authentication state.

For MCP, configure the actual resource URL, discovery metadata, issuer, keys, and audience. Validate the resource token where the HTTP request enters, then run backend operations with that authenticated identity. Recheck ownership at the data operation. Do not forward a bearer token to another resource or substitute a web session token. Scopes and user permissions are separate checks; follow [WorkOS's Connect token claims](https://workos.com/docs/authkit/connect/token-claims) for the chosen permission model.

Keep secrets on the server. Register the actual development origins and callbacks for the checkout under test. An environment file or local signed token fixture cannot prove the real WorkOS redirect, consent, renewal, or target-host connection. Prove those flows with live test identities before making that claim.

## Command and evidence contract

These are the reference project's commands, run from its root. Existing projects can map their working commands to the same purposes in `.astack/project.md`.

| Command | Purpose and limit |
| --- | --- |
| `bun run check:quick -- <file...>` | Fast scoped feedback for named files; without arguments, use current edits or all scopes when clean. Read the selected checks. |
| `bun run check:affected -- <base-ref>` | Check changed packages and affected consumers against the given Git base; defaults to `HEAD`. Review selection for indirect effects. |
| `bun run check:ci` | Run the retained deterministic package and boundary checks. A green result covers those checks. |
| `bun run readiness` | Exercise a disposable local deployment with signed proof identities and real reference behavior. Read the retained evidence and missing layers. |
| `bun run dev` | Start the configured product for live WorkOS use. Follow the README's environment and origin setup. |

Use the project-owned control route for real-product observations and retain acceptance case IDs, revision, environment, actions, and results under the feature contract. Record direct MCP, browser, live OAuth, installed-host, and agent-trial results separately. A local reference run does not demonstrate installed MCP host behavior or successful delivery by fresh agents. Missing credentials or host access remain named gaps; they cannot become passes because deterministic CI succeeds. Follow [proof](proof.md) for result classification and [PR review](pr.md) before delivery.
