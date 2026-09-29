# shadcn lint for web and Storybook

When a project uses shadcn/ui, use [`@shadcn/lint`](https://github.com/shadcn-ui/lint#rules) as a fast design-system check. Cover the web app, shared UI consumers, and Storybook stories when present in the same lint policy. A passing lint run checks the supported class and style rules; it does not establish that a story renders or that the running app behaves correctly.

## Set up the project

Read the current [setup](https://github.com/shadcn-ui/lint/blob/main/README.md#get-started), [rules](https://github.com/shadcn-ui/lint/blob/main/docs/rules.md), and [adoption guidance](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md) before editing configuration. The package targets Tailwind v4. Check the project's Node and linter versions against the current requirements. Reuse the linter that already covers JSX/TSX; do not add a second one just for this plugin. For a new React web workspace with no linter, use ESLint so the same configuration can supply editor diagnostics on save. Preserve existing parser, framework, Storybook, and ignore configuration.

Install `@shadcn/lint` in the workspace that owns the lint config, using the project's package manager. Register `plugin as shadcn` in the ESLint flat config or `@shadcn/lint` in Oxlint's `jsPlugins`. Include `apps/web` and every shared UI package in the lint command and config. Check that `*.stories.{js,jsx,ts,tsx}` and JSX/TSX files under `.storybook/` are not excluded by ignores or package boundaries. The stories should receive the same rules as production UI. Keep each app's `components.json`, UI import prefix, and Tailwind theme discovery scoped correctly; add `settings.shadcn.ui` or `componentImports` only when discovery cannot identify shared components.

For a new project, enable these six rules as errors on UI and story files:

```js
rules: {
  "shadcn/no-restyle": ["error", { allow: ["layout"] }],
  "shadcn/no-raw-colors": "error",
  "shadcn/no-arbitrary-values": ["error", { allow: ["layout"] }],
  "shadcn/no-inline-styles": "error",
  "shadcn/no-unknown-classes": "error",
  "shadcn/require-static-classes": "error",
}
```

After the main rule block, turn `no-restyle`, `no-arbitrary-values`, and `require-static-classes` off **inside the actual shadcn component source directory**, where components own their styles. Keep `no-raw-colors` and `no-inline-styles` active there. Do not exempt stories or component consumers. Tailor `no-restyle` contracts and narrow exceptions to the project's real component API; do not add broad disables to make a run green.

For an existing codebase, first measure findings on both the web app and stories. Follow the upstream [incremental adoption](https://github.com/shadcn-ui/lint/blob/main/docs/adoption.md) path: start noisy rules at `warn`, keep new UI code strict where practical, and promote rules to `error` as violations are resolved. Record any warning cap or scoped legacy exception in the lint config, not as an undocumented agent convention. If Tailwind or linter compatibility blocks setup, record the exact blocker in `.astack/project.md` and keep the existing lint path working.

## Make feedback immediate

Expose a `lint:ui` script (or the project's existing equivalent) that checks the web app, shared UI package, and Storybook files when present. Include it in the normal workspace lint task and CI. Record its exact command in `.astack/project.md`; add a short `AGENTS.md` instruction to run it after UI or story edits and fix new findings before claiming a file is done. Agents working outside an editor should run the command on changed files during the edit loop and the full UI scope before review.

Enable the editor's ESLint or Oxlint diagnostics for the project's JSX/TSX and story files so a save reports violations. Confirm this in the actual editor with a temporary violation in both an app component and a `*.stories.tsx` file, then remove the violation. Also run the lint command on those paths to confirm the agent sees the same findings. A script alone does not create save-time diagnostics; if the editor integration is unavailable, use the per-file command as the immediate check and report that limit.

Keep selected Storybook render and interaction checks, and running-app proof where needed, alongside lint. They answer different questions.
