# Convex, WorkOS and MCP foundation

The shared interface is implemented from the [Pen visual design](.astack/design/README.md). Generation carries the editable `.pen`, exported frames and MCP-extracted specification into the new project. Read those inputs before changing its UI; run `bun run design:verify` for a fresh local Storybook build and nine design-derived comparisons, then inspect the retained screenshots. Running-product checks remain separate.

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

Run the scaffold command from the astack repository root. It refuses existing destinations, excludes credentials/local data/build output, and records the source revision and lock digest. Install Chromium with the pinned local Playwright CLI when not already available: `bunx --no-install playwright install chromium` (CI adds `--with-deps`). Readiness creates an isolated local Convex deployment and WorkOS Emulate seeded identities, identifies the build, drives the browser and real MCP endpoint, verifies independent persisted reads and rejected access, and preserves redacted evidence through cleanup. It proves local AuthKit behavior through Emulate; real provider and installed ChatGPT proof remain separate.

## Architecture and supported examples

- `apps/web`: WorkOS AuthKit and official Convex provider; native Convex reactive subscriptions/mutations; TanStack Router owns URL filters; TanStack Form with Zod owns drafts and pending/error feedback.
- `apps/mcp-ui`: one self-contained HTML bundle using the standard MCP Apps bridge. It receives initial host results without another launch call, parses incoming data, and calls data tools after interactions.
- `packages/backend/convex`: indexed owned data, validated arguments/returns and the `/mcp` HTTP action. Convex validates JWTs and passes identity to queries/mutations. WorkOS Connect tokens stay within this resource server.
- `packages/ui`: portable shadcn-style primitives and composed presentation with props/callbacks; `packages/domain`: browser-safe data/validation contracts; `packages/config`: shared strict compiler/lint policy.

Shared UI and domain have no router, identity, backend, host bridge or direct network imports. Local state remains valid; semantic composition and test quality require review. Stories cover empty, mixed and pending states. Tests follow behaviour, not `.ts`/`.tsx` filenames. Exact dependencies and peers are pinned. TypeScript 7 checks source; Microsoft's TypeScript 6 compatibility package supplies the API required by typed ESLint and resolved-import checks. Bun supplies the package manager, runtime and test runner. The source repository retains the measured Oxlint comparison and tooling decision.

Handwritten code inherits strictness, exact optional fields and checked indexed access. Library declaration checking stays enabled for domain, backend and web. Three narrow exceptions skip dependency declaration checking: root tooling (Bun 1.4.2 / Node 24 declarations conflict), UI stories (Storybook 10.6 declarations conflict with exact optional fields), and MCP UI (SDK 1.32's optional `sessionId` conflicts with its own `Transport`). Handwritten source remains strictly checked; `scripts/http-transport.ts` adapts that SDK interface without a type assertion. The config workspace contains JavaScript lint configuration, checked by ESLint; it has no TypeScript source or typecheck task.

## Persistent local development

New apps start locally. After installation, run `bun dev`: it starts persistent local Convex, seeded **WorkOS Emulate** on port 4100, web on 5173 and the MCP App preview on 5174. Sign in on web as `owner@example.com` or `other@example.com`, password `Local-Emulate-only-2026!`. These known fixtures exist only in Emulate. Web uses the official AuthKit React/Convex adapter; **Connect with Emulate** opens the actual MCP App as the same seeded owner without live OAuth consent. No WorkOS account, cloud backend or API key is needed for this path.

`bun run dev:backend` starts local Convex/Emulate without clients. Startup builds the MCP resource, installs managed Convex AI files once and supplies actual loopback backend URLs. Occupied ports fail. Data persists in `packages/backend/.convex`; `.env.local` identifies the deployment. Pinned Emulate subjects resolve their owned rows after restart; emulator sessions/keys are disposable. Existing public staging settings are preserved, and `bun run dev:staging` selects them explicitly. Both startup paths reject cloud targets, deploy keys and self-hosted overrides. `bun run convex:local -- <command>` guards local env, run, data, export and import commands.

[Authentication proof](.astack/auth-testing.md) defines three distinct tiers: **Emulate** for normal automated/local tests, **astack Staging** for opt-in real-provider checks with disposable programmatic users, and **manual G1/G2 acceptance** for Hosted AuthKit and real MCP OAuth/identity continuity. Installed ChatGPT has its own H1 check. No permanent shared test account/password is required.

`bun run auth:verify` checks deterministic Emulate identity/session behavior. `bun run readiness` owns a separate Emulate/Convex/browser app, exercises AuthKit login and persisted web/MCP behavior, and cleans up. `bun run development:verify` checks ordinary startup, browser login, data/subject continuity after restart and private export in an owned copy. These do not establish real provider consent or installed-host behavior. The user decides when to host the app: follow [move this app to cloud](.astack/cloud.md) for target/data choices, frontend/auth/MCP settings, actual hosted verification and recovery while preserving local development.

## Real WorkOS Staging setup

Use a dedicated **staging** WorkOS environment with persistent local Convex. Cloud Convex is not required. Ask astack to select/create that sandbox and configure it using the connected WorkOS tools. Inspect and preserve existing URLs, use the exact default AuthKit application's ID with the application-specific redirect/logout operations, and verify the saved settings with a fresh query. Keep sandbox values in ignored local files, never in the template.

To save the public app configuration yourself, run once:

```sh
bun run setup:workos --client-id client_YOUR_ID --authkit-domain https://YOUR-DOMAIN.authkit.app
bun run dev:staging
```

The client ID identifies this app's WorkOS environment; the AuthKit domain is the MCP OAuth issuer. The command writes `apps/web/.env.local` and `packages/backend/.env.local`, preserves the local deployment and unrelated values, and refuses a conflicting WorkOS environment. No WorkOS API key is needed in the browser or committed. `bun run dev:staging` applies saved settings through the local Convex CLI, disables disposable proof identity, sets the exact local MCP resource and web origin, and supplies actual backend URLs to both clients. The web callback defaults to the browser's current origin, avoiding a localhost/127.0.0.1 mismatch. Restart an already-running session in staging mode after setup. Ordinary `bun dev` continues to use Emulate.

In the WorkOS staging application, allow redirects/logout for `http://127.0.0.1:5173/` and `http://127.0.0.1:5174/`, and CORS origins `http://127.0.0.1:5173` and `http://127.0.0.1:5174`. Add equivalent localhost URLs if using that hostname. Enable Connect DCR and register **`http://127.0.0.1:3211/mcp`** as a resource indicator (use the actual saved `CONVEX_SITE_URL` if it differs). The local command does not silently create an account or change the dashboard; astack can automate that step through authorized WorkOS tools.

Startup also installs Convex's managed AI guidance/skills once, without a yes/no prompt. It preserves existing AGENTS.md/CLAUDE.md content and honors `aiFiles.enabled: false` in `convex.json`. Use Convex's `ai-files update` for later refreshes. Downloaded managed guidance/skills are excluded from generation and source identity; the scoped AGENTS.md/CLAUDE.md remain source.

For loopback development without a custom authentication API domain, set `VITE_WORKOS_DEV_MODE=true`, as required by [WorkOS's React guide](https://workos.com/docs/authkit/react). Deployed web uses `false` and `VITE_WORKOS_API_HOSTNAME` for its configured custom authentication API domain. The app rejects development mode outside loopback. The AuthKit login/OAuth issuer domain used by MCP and the authentication API hostname have distinct roles.

In staging mode, at **http://127.0.0.1:5174/** choose **Connect with WorkOS**. This development host uses SDK OAuth discovery, public-client DCR, PKCE and a one-use state, then loads the real `/mcp` App HTML inside an AppBridge iframe. Refresh rereads the list; Disconnect closes the bridge and clears this browser session's access/refresh tokens. The standalone resource itself explains how to open a host instead of initializing against its own window. The preview host exists only in Vite development and is excluded from the published App bundle. Its same-origin proxy only forwards known loopback MCP/metadata routes and rejects foreign origins.

Real local MCP OAuth uses the exact loopback resource above and the HTTPS WorkOS issuer. Plain HTTP resources are accepted only at the same loopback origin as local Convex and at `/mcp`, without credentials/query/fragment. External MCP access needs the chosen HTTPS resource (a deliberate tunnel or later cloud transition). Configure that resource and permitted clients in WorkOS Connect; [WorkOS's MCP guide](https://workos.com/docs/authkit/mcp) documents resource indicators, registration, discovery and consent. The MCP provider verifies issuer, RS256 signature, expiry and exact resource audience. The web provider is separate. Both subjects identify the same WorkOS user within the configured environment. Web session credentials are rejected at `/mcp`; the mutation rechecks ownership. A configured sandbox or successful redirect alone does not prove completed login, refresh or installed-host behavior.

Use `bun run auth:staging` for the disposable real-provider SDK suite and `bun run auth:acceptance -- create` for a temporary manual identity. Their private setup, teardown and recovery commands are in [authentication proof](.astack/auth-testing.md). No shared user or password is infrastructure. Start real provider acceptance with `bun run dev:staging`; it connects clients to persistent local Convex. Use the actual printed web URL. Public `/health` reports the build identifier, and `/.well-known/oauth-protected-resource/mcp` advertises the resource and authorization server. Refresh metadata/connection when the configured resource changes. Import the remote MCP endpoint in a supported host and exercise its UI for installed-host proof. The local AppBridge fixture proves local host wiring only.

## Feedback and evidence

`bun run check:quick -- <files...>` gives typed lint feedback for edited files; with no file argument it selects Git changes (or the full source when unknown). `bun run check:affected -- <base-ref>` runs checks for affected apps and broadens shared/config changes to the workspace. `bun run check:ci` checks formatting, shared package coverage, typed correctness, domain contracts and browser bundles. `bun run readiness` is the separate integration gate. Each command names its scope; a quick pass is not acceptance proof.

The pre-commit hook uses pinned Husky/lint-staged, formatting and staged lint, with backup/partial-stage protection. The scaffold does not initialize Git implicitly; run `git init` when creating a repository, then `bun install` or `bun run hooks:install`. The first commit includes checked-in Convex generated types: ESLint suppresses warnings for intentionally ignored generated files while handwritten warnings still fail. A missing embedded MCP resource is prepared inside lint-staged after unstaged lines have been hidden.

Hook installation supports both a standalone Git checkout and a project under an existing Git root, such as `app/`. It computes the actual project path, installs Husky at that path and runs staged checks from the project directory. An empty enclosing repository without hooks or tracked/untracked files outside the project can install automatically. Existing configured/default hooks and occupied enclosing repositories are preserved; installation reports that the app hook is inactive. To use this project's hook instead, explicitly run `bun run hooks:install -- --replace-existing-hooks` from the project after choosing to replace the enclosing repository's hook configuration; existing hook files remain on disk. Failed installation restores the previous Git hook configuration. Alternatively, keep the repository hook and have it invoke this project's pinned lint-staged command from this project's directory.

Broader affected checks run before handoff/CI; a pre-push hook is deferred until its measured cost fits. Generated files are narrowly excluded. Agents must correct code rather than bypass hooks or weaken checks.

`.astack/project.md` records actual proof/control routes. The control script in `.codex/skills/astack-work-items/` identifies prerequisites and runs disposable verification. Trial prompts/rubric and retained outcomes live in the source repository's `.astack/foundation/`. Read the retained result before asserting provider, host or agent behaviour; those are separate claims.

From the source repository, run actual delivery trials after committing the candidate:

```sh
bun examples/foundation/scripts/trials.ts --candidate <commit> --rubric .astack/foundation/trial-rubric.md --output <new-evidence-directory> --rounds 2 --concurrency 2 --model <configured-model> --reasoning <configured-effort>
```

Every round uses fresh creation, feature and bug-fix agents plus independent scored reviewers. Up to two whole rounds run concurrently; each round preserves task order and separate projects. The candidate's immutable verifier checks delivered source, including title-edit assertions for the feature. The rubric is committed before execution and remains fixed across rounds. Timeouts, missing proof and authorization defects cannot pass; prompts, source, observations, usage, costs when available and interventions survive disposable-project cleanup. The runner reuses CLI authentication, installs only the temporary candidate plugin and removes it afterwards.

Delivery defaults to `workspace-write`; reviewers always use `read-only`. Browser launch, process inspection and Git metadata writes may be unavailable in a restricted delivery sandbox. For a controlled environment where those operations are authorized, explicitly add `--delivery-sandbox danger-full-access`, following [OpenAI's non-interactive mode guidance](https://learn.chatgpt.com/docs/non-interactive-mode). This removes OS sandbox isolation for delivery; disposable project directories and task limits still apply. No automatic permission fallback occurs. Reports identify the selected sandbox and executing harness separately from the immutable candidate, retain live redacted JSONL and mark any changed archive bytes.
