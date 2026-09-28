# Web feature path

Use for every feature that adds or changes a web UI, including a small visible change. Pencil and Storybook are required. Keep the pass small when the change is small; do not omit either tool because the result seems obvious. A feature with no web UI does not need these artifacts.

## Choose the stack

Keep an existing project's framework unless the feature itself warrants migration. In a clean repository, default to **Vite + React + TypeScript** for a client app. Choose **Next.js App Router + TypeScript** when the requested product needs server rendering, server routes, or a Next.js-specific capability. Record the reason for choosing Next.js. Consult the current [Vite](https://vite.dev/guide/) or [Next.js](https://nextjs.org/docs/app/getting-started/installation) setup guide rather than assuming old scaffold flags. Use the project's package manager if one is already established.

Needing a database alone does not change this web stack choice. Use [Convex](database.md) with either React/Vite or Next.js.

Set up Storybook in the chosen application before implementing the feature UI. Use the current official [React/Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite) or [Next.js/Vite](https://storybook.js.org/docs/get-started/frameworks/nextjs-vite) integration and confirm that Storybook starts. Do not migrate an existing project only to satisfy this default stack rule.

## Design and component loop

1. Write a short brief: actor, problem, intended outcome, and the material interaction states. Use the [change contract](change-contract.md) to record observable behavior and open product choices.
2. Create or update a `.pen` file with Pencil's design tools. Read Pencil's own tool guidance before editing; `.pen` files are not plain text and must not be inspected or changed with shell text tools. Save the design with the project so the PR can point to it. Show the consequential states, including empty, loading, error, or confirmation only when they matter to the feature.
3. Build the presentation components in Storybook using fixture data through props. Add stories for the designed states and interactions. Keep these components suitable for production, while treating mocked requests and local placeholder state as prototypes.
4. Load the Storybook story in Pencil's browser, compare it with the design, and correct visible differences. Verify the story renders and its material interaction works. Resolve product or taste choices with the user when the available context cannot settle them.
5. Trace the real data and ownership path, then wire the kept components into the application. Replace prototype data flows with the actual state, authorization, and persistence behavior. Prove the relevant acceptance cases in the running app; a passing story alone does not prove a server effect.

Carry the `.pen` path, Storybook story identifiers, and running-app proof into the feature PR. If Pencil or Storybook is unavailable, state the concrete blocker and continue independent work; a draft PR may preserve progress, but the web feature is not complete until the required design and component checks run or the user explicitly changes the requirement.
