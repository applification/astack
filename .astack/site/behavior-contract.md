# AStack site behavior contract

## Outcome

A visitor can understand what AStack does, find the route for a task, install the Applification plugin, and reach the current source. Maintainers can update the explanation in this repository alongside workflow changes.

## Acceptance

- A1. The landing page explains the entry skill, seven routes, proof, and the PR outcome without relying on a dated PR count or snapshot.
- A2. The vertical route map stays readable as an underground-style map. Choosing a line highlights its branch and stations.
- A3. The routing explorer groups the current eval cases by route without showing every case at once. Search narrows the cases; selecting one shows its expected decision and highlights the corresponding line.
- A4. Light and dark themes follow Applification's design roles, honor the system preference on first visit, and let the visitor switch and retain a choice.
- A5. The installation commands are available as text and can be copied or selected.
- A6. The page remains readable and navigable on a narrow mobile viewport and with a keyboard.
- A7. A change to a route name, eval example, or source link that breaks the page fails the site check before deployment.
- A8. A merge to main deploys the contents of site/ to the configured GitHub Pages domain over HTTPS.

## Design and implementation choices

- Plain HTML, CSS, and JavaScript. This site has no app state, server data, or reusable components that justify a framework or Storybook.
- Pencil is skipped because the visual direction is implemented and reviewed directly in the running static page. There is no existing Pencil design to update.
- The skill source remains authoritative. Site prose links to it and avoids release statistics that would go stale.
- Routing examples in `site/scenarios.json` carry the requests and expected decisions from `evals/routing.md`. `site/check.mjs` rejects drift. Route grouping is an editorial mapping maintained with the site.
- The site uses a custom GitHub Actions workflow. GitHub Pages settings and DNS hold the domain configuration; a CNAME file in the artifact is ignored for this publishing mode.

## Proof to record in the PR

Run `node site/check.mjs`, `node --check site/app.js`, and `git diff --check`. Serve `site/` locally and inspect desktop and mobile layouts, grouped evals, search, route highlighting, both themes, navigation, and install commands. After merge, confirm the Pages run and the HTTPS URL. A local preview does not establish the deployed result.
