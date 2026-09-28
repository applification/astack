# Database path

Choose **Convex** when a new app or new feature needs a database and the project has not already committed to another database. Keep an existing project's established database unless the user asks for a migration. Convex works with both the [React/Vite](https://docs.convex.dev/quickstart/react) and [Next.js](https://docs.convex.dev/client/nextjs/app-router/) web paths; persistence alone is not a reason to choose Next.js.

For development and prototype proof, prefer a [local Convex deployment](https://docs.convex.dev/cli/local-deployments). Use the current Convex setup instructions for a new project; for an already configured project, `npx convex deployment select local` selects the local deployment. Keep `npx convex dev` running while the app or CLI uses it. Local deployments can work without a Convex account and store their state in `.convex`; exclude local state and secrets from Git.

Define the data shape and ownership before writing queries and mutations. Use current Convex guidance and any available Convex-specific project skill when editing `convex/`. Prove a material write through the running app and a fresh read, using disposable data on the named local deployment. Storybook fixtures remain presentation examples, not database proof.

The application code can be promoted to a production Convex deployment later, but the local deployment and its data are not production. State the separate deployment and verification step in the PR when production readiness is claimed. If the feature needs externally reachable webhooks, paid services, or other behavior that a local deployment cannot exercise, name that gap and use an appropriate preview or cloud deployment for that check.
