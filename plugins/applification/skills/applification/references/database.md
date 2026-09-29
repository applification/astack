# Database path

Choose **Convex** when a new app or new feature needs a database and the project has not already committed to another database. In a new Bun/Turborepo project, keep the Convex source and generated API in `packages/backend/convex`, with consuming apps depending on the backend workspace. Add `convex` to that workspace with Bun. Keep an existing project's established database unless the user asks for a migration. New web products use the [Next.js App Router path](https://docs.convex.dev/client/nextjs/app-router/); adapt to an existing app's framework rather than migrating it to add persistence.

## Choose the Convex route

Use the `@Convex` plugin for current setup, client wiring, components, and scaling advice. Match its tool or skill to the actual task:

- **New app with Convex:** Consult the plugin's new-app guidance and runbook before creating files. `$convex:quickstart` is for a new Next.js and shadcn app with no existing Convex project. Use it when that scaffold fits, then bring its output into AStack's Bun workspaces and `packages/backend/convex` layout. For an existing repository or another layout mismatch, follow the plugin guidance without running that scaffold. Do not let a scaffold silently replace the chosen app architecture or add a second lockfile.
- **Add Convex to an existing JavaScript or TypeScript app:** Use the plugin's `add_convex_to_existing_project` guidance before editing. Pass the actual framework, package manager, and auth needs; integrate its provider and backend steps into the existing layout. `$convex:add` assumes the project already has Convex and is adding a backend capability, so it is not the initializer for this case.
- **Add a capability to an existing Convex app:** In a Convex + Next.js project, use `$convex:add` to consult its live capability catalog before choosing a component or writing custom code. For another framework, use the `@Convex` plugin and current component guidance. Respect spend and service setup rules. Keep the project's current framework and package manager unless the task explicitly changes them.
- **Edit Convex backend code:** Invoke `$convex:convex-expert` before touching any `convex/` directory, including schema, functions, auth, HTTP endpoints, crons, and component configuration. Read `schema.ts` and generated guidelines if present. Use its current rules for validators, indexes, bounded reads, auth, internal functions, and components. Review the resulting diff with `$convex:convex-reviewer` before the PR is ready.

If the plugin or a named skill is unavailable, install or enable `convex@openai-curated-remote` where possible. Do not imply that AStack installs it automatically. If access remains unavailable, use the project's Convex guidance and official docs for implementation, record the missing specialist review, and keep a Convex PR in draft until that review can run.

## Prove the backend behavior

Define the data shape, access paths, and ownership before writing queries or mutations. Use indexed queries with bounded results, reactive queries for reads, mutations for transactional writes, and actions for external side effects. Keep credentials in Convex environment variables and store storage IDs rather than expiring file URLs. Let the expert skill and the project's code decide the exact implementation.

Use the plugin's current deployment guidance for setup. For disposable development proof, a [local Convex deployment](https://docs.convex.dev/cli/local-deployments) is useful when the feature does not need externally reachable services. Record which deployment the app and CLI use, keep `bunx convex dev` running, and exclude local state and secrets from Git. Use a suitable cloud or preview deployment when auth, webhooks, or another integration needs one.

Run TypeScript checking and a Convex push against the named development deployment when available. Exercise the main changed backend path through the running app or a realistic function invocation, and confirm a material write with a fresh read. Storybook fixtures are presentation examples, not database proof. Name any untested integration in the PR. A local deployment and its data do not establish production readiness; state the separate production deployment and verification step if claiming that.
