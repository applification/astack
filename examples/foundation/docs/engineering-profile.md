# Worked foundation engineering profile

Use this profile for a new product that needs persistent shared behavior on web and MCP. The [work-item reference](https://github.com/applification/astack/tree/main/examples/foundation) makes the profile concrete: React + TypeScript + Vite, Convex persistence and MCP serving, WorkOS authentication, and portable presentation components. It is a worked starting point, not a requirement to add every surface to a small tool. An existing product retains its working stack unless migration is requested. Follow [project setup](https://github.com/applification/astack/blob/main/skills/project-setup/SKILL.md), [database](https://github.com/applification/astack/blob/main/skills/convex/SKILL.md), [web UI](https://github.com/applification/astack/blob/main/skills/web-feature/SKILL.md), and [MCP](https://github.com/applification/astack/blob/main/skills/mcp-server/SKILL.md) guidance only at the boundaries the task changes.

The reference includes a Pen (pen.dev) visual design in `.astack/design/` inside the generated project. Read its design record, selected frames and exported handoff before implementing UI. Its shared components and web/MCP states demonstrate design → code → rendered proof. `bun run design:verify` builds the generated project's own Storybook, compares dimensions, typography and semantic surfaces against the MCP-extracted specification and retains screenshots for visual review. Keep those fixture observations separate from `readiness` persistence, authorization and host-lifecycle results. For a new product, select its visual direction before extending the reference; preserve an existing project's chosen design system.

## Start from the reference

Generated projects include root [AGENTS.md](../AGENTS.md), a [Claude pointer](../CLAUDE.md) and [the runtime profile](../.astack/project.md). Their main agent owns the request, selects useful delegation with the actual host, and verifies integrated results. Setup/upgrades reconcile these project-owned instructions in place, preserving custom text and framework-managed blocks. No T3 connection or separate orchestrator prompt is required.

From an astack checkout, generate a separate project:

```sh
bun scripts/create-foundation.ts /absolute/path/to/my-product
```

Follow the generated README for installation, environment configuration, and startup. `bun run dev` starts persistent local Convex without requiring a Convex account, supplies its actual URL to clients and rejects cloud targets/deploy keys. Ordinary shutdown preserves local data; readiness owns separate disposable state. The user initiates a [move to cloud](https://github.com/applification/astack/blob/main/skills/cloud-transition/SKILL.md) when ready; generated `.astack/cloud.md` maps that workflow to the reference, including data choice, frontend and WorkOS/MCP configuration, hosted proof and recovery. Commit the Bun lockfile and retain the generated scoped instructions with the code they govern. Record consequential departures in the project's ADRs; use current official documentation for the selected platform and installed versions. Scaffold output and a successful build establish structure, not integration readiness.

```text
apps/
  web/                 WorkOS web session and Convex React adapter
  mcp-ui/              MCP host bridge and HTML resource bundle
packages/
  ui/                  portable React presentation
  domain/              pure terms, validation, and behavior
  backend/convex/      data, authorization, and HTTP MCP resource server
  config/              shared tooling configuration
```

The reference serves `/mcp` from a Convex HTTP action. Its SDK transport is an adapter around shared backend operations; it does not need a second service in `apps/mcp`. A separate MCP process is appropriate when its runtime or deployment requires one. A stdio tool without persistence can use the smaller [MCP server path](https://github.com/applification/astack/blob/main/skills/mcp-server/SKILL.md).

## Keep rules at their owning boundary

| Scope                     | Rule and worked use                                                                                                                                                   | Exception                                                                                                                                                    |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/ui`             | Receive data and action callbacks through props. The work-item list renders in web and MCP UI without importing Convex, WorkOS, or a host bridge.                     | Host and data adapters belong to consuming apps. Add a platform-specific component where behavior cannot be shared.                                          |
| `packages/domain`         | Keep deterministic validation and terms free of React, protocol, database, and environment imports. Normalize a work-item title here when both clients need the rule. | Persisted identity, membership, and transactional checks stay in the backend.                                                                                |
| `packages/backend/convex` | Validate public inputs and enforce ownership at the operation that reads or writes. Web and MCP call the same authorized mutations.                                   | External side effects use actions; local presentation state belongs to its UI consumer.                                                                      |
| Client data adapters      | Let Convex subscriptions own Convex state. A mutation updates the subscribed work-item list.                                                                          | Use another data library for another source, or the official Convex integration when a router requires it; do not create a second manually invalidated copy. |
| Forms                     | The Vite reference uses TanStack Form with Zod. Preserve native labels, submit behavior, pending/error states, and backend validation.                                | Choose the documented approach for another platform. An existing Next.js app may use its Server Action form path.                                            |
| Tests                     | Test pure rules directly, permissions at the backend, MCP contracts through a client, and rendered interactions in a real browser.                                    | A focused component check can cover isolated presentation. File extensions alone neither require nor forbid a test.                                          |

The reference's boundary checks and deliberately invalid fixtures demonstrate rule enforcement. Treat a passing negative fixture as evidence that the check rejects that violation; it does not establish all architectural correctness. Keep scoped instructions, rules, examples, and checks aligned when a boundary changes.

For new React forms, consult [TanStack Form validation](https://tanstack.com/form/latest/docs/framework/react/guides/validation). For Next.js, consult [the framework's forms guide](https://nextjs.org/docs/app/guides/forms) and keep authorization inside the server operation. Convex's [React client](https://docs.convex.dev/client/react/overview) supplies subscriptions and mutations. Its [TanStack Query integration](https://docs.convex.dev/client/tanstack/tanstack-query) is an option where that platform needs it; adding TanStack Form does not require adding Query.

## Identity across web and MCP

For ordinary local/CI auth, start WorkOS Emulate with deterministic seeded users/linked identities alongside persistent local Convex. In the reference, `bun dev` does this by default and uses the official AuthKit React/Convex adapter. `auth:verify` and readiness establish local session behavior, persisted authorization and separate web/MCP token contracts. Emulate Connect tokens test the resource server; its pinned version does not establish real DCR, PKCE, consent, resource negotiation or Connect refresh.

Use the dedicated astack Staging environment for a small opt-in provider suite. Create a unique verified user and generated password during setup, authenticate programmatically and clean up after success/failure. Keep an owned external-ID journal for recovery and scoped API keys in a secret store. Do not maintain a permanent shared test account/password. The reference's `auth:staging` implements this; `auth:acceptance -- create` creates a temporary identity for a bounded manual run.

`setup:workos` saves public staging configuration; `dev:staging` selects it explicitly while preserving local development. With authorized WorkOS tools, inspect/preserve dashboard settings, register web/preview callbacks and CORS, enable DCR and register the exact local MCP resource. Verify saved values through a fresh query. No API key belongs in the browser. Real manual G1/G2 covers Hosted AuthKit login/redirect/refresh/subject continuity, MCP consent/exact-resource issuance and the same real WorkOS user across both surfaces. Installed ChatGPT OAuth/App remains a separate H1 host check. Setup or Emulate success cannot substitute for these observations. See the generated `.astack/auth-testing.md` for commands, limits and cleanup.

Use WorkOS AuthKit for the web session and [WorkOS Connect for MCP OAuth](https://workos.com/docs/authkit/mcp). They share the user identity system, but have different token contracts. Follow [Convex's AuthKit integration](https://docs.convex.dev/auth/authkit/add-to-app) for the selected web framework. Gate authenticated Convex reads on Convex's validated authentication state.

For MCP, configure the actual resource URL, discovery metadata, issuer, keys, and audience. Validate the resource token where the HTTP request enters, then run backend operations with that authenticated identity. Recheck ownership at the data operation. Do not forward a bearer token to another resource or substitute a web session token. Scopes and user permissions are separate checks; follow [WorkOS's Connect token claims](https://workos.com/docs/authkit/connect/token-claims) for the chosen permission model.

Keep secrets on the server. Register the actual development origins and callbacks for the checkout under test. An environment file or local signed token fixture cannot prove the real WorkOS redirect, consent, renewal, or target-host connection. Prove those flows with live test identities before making that claim.

## Command and evidence contract

These are the reference project's commands, run from its root. Existing projects can map their working commands to the same purposes in `.astack/project.md`.

| Command                                                           | Purpose and limit                                                                                                                                                                                                          |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run check:quick -- <file...>`                                | Fast scoped feedback for named files; without arguments, use current edits or all scopes when clean. Read the selected checks.                                                                                             |
| `bun run check:affected -- <base-ref>`                            | Check changed packages and affected consumers against the given Git base; defaults to `HEAD`. Review selection for indirect effects.                                                                                       |
| `bun run check:ci`                                                | Run the retained deterministic package and boundary checks. A green result covers those checks.                                                                                                                            |
| `bun run development:verify`                                      | Check ordinary local startup, the served frontend URL, data/configuration after restart and private export in an owned copy; Emulate login/subject restart and administrative export do not establish real provider login. |
| `bun run readiness`                                               | Exercise a disposable local deployment with Emulate-issued positive credentials and real reference behavior. Read the retained evidence and missing layers.                                                                |
| `bun run dev`                                                     | Start persistent local Convex and clients; preserve state and reject cloud targets. Seeded Emulate auth is the default; no external WorkOS setup.                                                                          |
| `bun run setup:workos --client-id <id> --authkit-domain <issuer>` | Save a selected sandbox's public configuration to ignored local files; preserve other settings and refuse conflicts. Dashboard configuration remains a WorkOS tool/account step.                                           |
| `bun run auth:verify`                                             | Deterministic Emulate auth/session and identity checks; no real provider/host claim.                                                                                                                                       |
| `bun run auth:staging`                                            | Opt-in real SDK checks with disposable astack Staging identities and cleanup; scoped secret required.                                                                                                                      |
| `bun run dev:staging`                                             | Use saved real WorkOS settings against persistent local Convex for provider acceptance.                                                                                                                                    |
| `bun run auth:acceptance -- create`                               | Create a temporary manual identity; record G1/G2/H1 separately and clean it afterwards.                                                                                                                                    |
| `bun run dev:backend`                                             | Start persistent local Convex without clients for configuration/data operations.                                                                                                                                           |
| `bun run convex:local -- <command>`                               | Guard local env/run/data/export/import commands against target overrides; requires the backend running.                                                                                                                    |

Use the project-owned control route for real-product observations and retain acceptance case IDs, revision, environment, actions, and results under the feature contract. Record direct MCP, browser, live OAuth, installed-host, and agent-trial results separately. A local reference run does not demonstrate installed MCP host behavior or successful delivery by fresh agents. Missing credentials or host access remain named gaps; they cannot become passes because deterministic CI succeeds. Follow [proof](https://github.com/applification/astack/blob/main/skills/verify/SKILL.md) for result classification and [PR review](https://github.com/applification/astack/blob/main/skills/pr/SKILL.md) before delivery.
