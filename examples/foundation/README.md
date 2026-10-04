# Convex, WorkOS and MCP foundation

A worked profile for a private work-item app with standalone React/Vite and MCP Apps presentation. This is a reference and repeatable starting point. The Applification plugin remains the engineering method; this app supplies a concrete environment.

From a fresh checkout, use Node 24 and Bun 1.4.0:

```sh
bun scripts/create-foundation.ts /absolute/path/to/new-project
cd /absolute/path/to/new-project
bun install --frozen-lockfile
bun run build:mcp-ui
bun run readiness
bun run check:ci
```

Run the scaffold command from the astack repository root. It refuses existing destinations, excludes credentials/local data/build output, and records the source revision and lock digest. Install Chromium with the pinned local Playwright CLI when not already available: `bunx --no-install playwright install chromium` (CI adds `--with-deps`). Readiness creates an isolated local Convex deployment and signed disposable identities, identifies the build, drives the browser and real MCP endpoint, verifies independent persisted reads and rejected access, and preserves redacted evidence through cleanup. It does not configure or prove WorkOS login or installed ChatGPT.

## Architecture and supported examples

- `apps/web`: WorkOS AuthKit and official Convex provider; native Convex reactive subscriptions/mutations; TanStack Router owns URL filters; TanStack Form with Zod owns drafts and pending/error feedback.
- `apps/mcp-ui`: one self-contained HTML bundle using the standard MCP Apps bridge. It receives initial host results without another launch call, parses incoming data, and calls data tools after interactions.
- `packages/backend/convex`: indexed owned data, validated arguments/returns and the `/mcp` HTTP action. Convex validates JWTs and passes identity to queries/mutations. WorkOS Connect tokens stay within this resource server.
- `packages/ui`: portable shadcn-style primitives and composed presentation with props/callbacks; `packages/domain`: browser-safe data/validation contracts; `packages/config`: shared strict compiler/lint policy.

Shared UI and domain have no router, identity, backend, host bridge or direct network imports. Local state remains valid; semantic composition and test quality require review. Stories cover empty, mixed and pending states. Tests follow behaviour, not `.ts`/`.tsx` filenames. Exact dependencies and peers are pinned. TypeScript 7 checks source; Microsoft's TypeScript 6 compatibility package supplies the API required by typed ESLint and resolved-import checks. Bun supplies the package manager, runtime and test runner. The source repository retains the measured Oxlint comparison and tooling decision.

Handwritten code inherits strictness, exact optional fields and checked indexed access. Library declaration checking stays enabled for domain, backend and application projects. Two narrow exceptions skip dependency declaration checking: root tooling (Bun 1.4.2 / Node 24 declarations conflict) and UI stories (Storybook 10.6 declarations conflict with exact optional fields). Handwritten source is still checked in both projects. The config workspace contains JavaScript lint configuration, checked by ESLint; it has no TypeScript source or typecheck task.

## Actual WorkOS setup

Use a dedicated WorkOS environment and Convex development deployment. Keep values in ignored local files or the deployment, never in the template. Copy `apps/web/.env.example` for browser values and use `packages/backend/.env.example` as the deployment-variable checklist. The SPA needs the client ID, redirect URI and Convex URL. Register that redirect and web origin in WorkOS, then configure the official AuthKit integration according to [Convex's supported guide](https://docs.convex.dev/auth/authkit/add-to-app).

For MCP, set `WORKOS_AUTHKIT_DOMAIN` to the actual issuer and `MCP_RESOURCE_URL` to this deployment's exact HTTPS `/mcp` URL. Configure that resource and permitted OAuth clients in WorkOS Connect; [WorkOS's MCP guide](https://workos.com/docs/authkit/mcp) documents dynamic registration, discovery and consent. The MCP custom JWT provider verifies the issuer, RS256 signature, expiry and exact resource audience. The web provider is separate. Both subjects identify the same WorkOS user within the configured environment. A web session token is rejected at `/mcp`, and the mutation rechecks ownership.

Build the MCP UI before `bunx --no-install convex dev` in `packages/backend`. Start the web with `bun run dev`; use the actual printed URL. Public `/health` reports the build identifier, and `/.well-known/oauth-protected-resource/mcp` advertises the resource and authorization server. Refresh metadata/connection when the configured resource changes. Import the remote MCP endpoint in a supported host and exercise its UI for installed-host proof. The local AppBridge fixture proves local host wiring only.

## Feedback and evidence

`bun run check:quick -- <files...>` gives typed lint feedback for edited files; with no file argument it selects Git changes (or the full source when unknown). `bun run check:affected -- <base-ref>` runs checks for affected apps and broadens shared/config changes to the workspace. `bun run check:ci` checks formatting, shared package coverage, typed correctness, domain contracts and browser bundles. `bun run readiness` is the separate integration gate. Each command names its scope; a quick pass is not acceptance proof.

The pre-commit hook uses pinned Husky/lint-staged, formatting and staged lint, with backup/partial-stage protection. Install in a fresh Git checkout with `bun install`. The scaffold does not initialize Git implicitly; run `git init` when creating a repository. Broader affected checks run before handoff/CI; a pre-push hook is deferred until its measured cost fits. Generated files are narrowly excluded. Agents must correct code rather than bypass hooks or weaken checks.

`.astack/project.md` records actual proof/control routes. The control script in `.codex/skills/astack-work-items/` identifies prerequisites and runs disposable verification. Trial prompts/rubric and retained outcomes live in the source repository's `.astack/foundation/`. Read the retained result before asserting provider, host or agent behaviour; those are separate claims.

From the source repository, run actual delivery trials after committing the candidate:

```sh
bun examples/foundation/scripts/trials.ts --candidate <commit> --rubric .astack/foundation/trial-rubric.md --output <new-evidence-directory> --rounds 2 --model <configured-model> --reasoning <configured-effort>
```

Every round uses fresh creation, feature and bug-fix agents plus independent scored reviewers. The candidate's immutable verifier checks delivered source, including title-edit assertions for the feature. The rubric is committed before execution and remains fixed across rounds. Timeouts, missing proof and authorization defects cannot pass; prompts, source, observations, usage, costs when available and interventions survive disposable-project cleanup. The runner reuses CLI authentication, installs only the temporary candidate plugin and removes it afterwards.
