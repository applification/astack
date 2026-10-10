# Database path

Use this when the project selects Convex. Keep its chosen package manager, source layout, framework, auth provider and deployment. Use the [React client](https://docs.convex.dev/client/react/overview) or [Next.js App Router integration](https://docs.convex.dev/client/nextjs/app-router/) when that framework is selected. A database requirement alone does not select Convex.

## Choose the Convex route

Use the `@Convex` plugin for current setup, client wiring, components, and scaling advice. Match its tool or skill to the actual task:

- **New app with Convex:** Consult the plugin's new-app guidance and runbook before creating files. `$convex:quickstart` is for a new Next.js and shadcn app with no existing Convex project. Use it only when that scaffold matches the project's fixed choices. For an existing repository or another layout mismatch, follow the plugin guidance without running that scaffold. Do not let a scaffold silently replace the chosen app architecture or add a second lockfile.
- **Add Convex to an existing JavaScript or TypeScript app:** Use the plugin's `add_convex_to_existing_project` guidance before editing. Pass the actual framework, package manager, and auth needs; integrate its provider and backend steps into the existing layout. `$convex:add` assumes the project already has Convex and is adding a backend capability, so it is not the initializer for this case.
- **Add a capability to an existing Convex app:** In a Convex + Next.js project, use `$convex:add` to consult its live capability catalog before choosing a component or writing custom code. For another framework, use the `@Convex` plugin and current component guidance. Respect spend and service setup rules. Keep the project's current framework and package manager unless the task explicitly changes them.
- **Edit Convex backend code:** Invoke `$convex:convex-expert` before touching any `convex/` directory, including schema, functions, auth, HTTP endpoints, crons, and component configuration. Read `schema.ts` and generated guidelines if present. Use its current rules for validators, indexes, bounded reads, auth, internal functions, and components. Review the resulting diff with `$convex:convex-reviewer` before the PR is ready.

If the plugin or a named skill is unavailable, install or enable `convex@openai-curated-remote` where possible. Do not imply that astack installs it automatically. If access remains unavailable, use the project's Convex guidance and official docs for implementation, record the missing specialist review, and keep a Convex PR in draft until that review can run.

## Prove the backend behavior

Define the data shape, access paths, and ownership before writing queries or mutations. Use indexed queries with bounded results, reactive queries for reads, mutations for transactional writes, and actions for external side effects. Keep credentials in Convex environment variables and store storage IDs rather than expiring file URLs. Let the expert skill and the project's code decide the exact implementation.

Convex owns its reactive server state; do not copy query results into a second client cache with manual invalidation. Use the official [TanStack Query integration](https://docs.convex.dev/client/tanstack/tanstack-query) when the chosen platform needs it. Form state is local input state, and using TanStack Form does not imply a Query dependency. When the project uses WorkOS, follow [its identity boundaries](../../workos-auth/SKILL.md). The backend enforces identity and ownership regardless of the calling surface.

Verify the selected development deployment before pushing. For a [local deployment](https://docs.convex.dev/cli/local-deployments), guard startup against inherited cloud targets and deploy keys, record its actual client URL and preserve ordinary development data. For a hosted development deployment, use its explicit target and isolate disposable fixtures. Exclude state and secrets from Git; do not let a scaffold change the chosen deployment.

Use [cloud transition](../../cloud-transition/SKILL.md) for an agreed hosting change. An integration requiring a public URL leaves a named verification prerequisite until an authorized endpoint is available; it does not select a host or authorize an unrelated migration.

Run TypeScript checking and a Convex push against the named development deployment when available. Exercise the main changed backend path through the running app or a realistic function invocation, and confirm a material write with a fresh read. Storybook fixtures are presentation examples, not database proof. Name any untested integration in the PR. A local deployment and its data do not establish production readiness; state the separate production deployment and verification step if claiming that.
