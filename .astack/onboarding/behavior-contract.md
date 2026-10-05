# astack onboarding and callable skills

## Outcome

Keep Codex plugin installation. Establish new projects or integrate and upgrade existing projects toward astack's opinionated runtime control and verification loop. Users can give the coordinator an engineering outcome or invoke any focused skill directly. Applicable language-independent principles live in callable `principle-*` leaves.

## Acceptance

| Case | Result and evidence |
| --- | --- |
| A1. Setup establishes startup, instance identity, action, independent observation, checks, retained evidence and owned cleanup. | Instructions and profile contract reviewed in `skills/project-setup/`; new-product and existing-upgrade paths share the loop. Actual setup in a separate product remains unverified. |
| A2. Existing-project setup can improve weak tooling while respecting supplied stack/data decisions. | Reviewed the upgrade/default table, baseline/recovery guidance and routing cases. Ordinary fixes do not trigger project-wide migration. |
| A3. Skills complete direct requests and share project guidance without requiring the coordinator. | All 28 skill identities, UI invocation prompts, policies and packaged references validate. Runtime skills read the project profile; contextual show-me/domain-modeling retain their direct use. Installed discovery and fresh-agent instruction-following remain separate trials. |
| A4. Principles are discoverable and owned by callable leaves. | Seven leaves appear in the coordinator and site indexes; platform/workflow links resolve. Three former TypeScript references moved to leaves; four additional principles retain pinned MIT provenance and scope adaptations. |
| A5. Onboarding clearly explains install, establish/upgrade, then use. | README, project installation guide, five-chapter guide and rendered site reviewed. Codex installation commands and existing skill names remain intact. |
| A6. The site presents setup and principle examples correctly. | In-app browser selected Project setup and displayed the upgraded-loop route. Searching `principle` returned the three direct principle assessment examples. Onboarding rendered the install/setup/use steps; [retained capture](evidence/onboarding.jpg). At 390px the page's document width and scroll width were both 390px; default viewport restored. |

## Design and component evidence

Pen: not selected; this is onboarding copy and source structure within the existing site layout. Storybook: not selected; the site is plain HTML/CSS/JavaScript and this change introduces no reusable component API. The running browser checks cover the changed route selection, search and displayed onboarding.

## Verification scope

Local environment: macOS, Node.js 24.21.0, Bun 1.4.0, Codex in-app browser. `bun run check` validates package manifests, all skill identities/prompts/references, site routing, 112 routing examples, principle indexes and guide links. `bun test scripts` passes 14 existing tests. Skill Creator's validator checks all 28 entrypoints using an isolated temporary Python environment with PyYAML; no repository dependency was added.

Review was performed by the implementing agent. Routing examples describe expected decisions and do not prove fresh-agent delivery. No provider auth, hosted deployment or installed-host behavior was changed or claimed. The PR records the final checked commit.

## Source and naming decisions

Read pstack's agent wrapper, poteto-mode and all ten guide chapters at revision `4e5b1cf2ccb0ea3716f08c8ee0a5856b5ab93536`. Adopt the separation of task routing, focused expertise and principle leaves, plus task-led documentation, explicit finish conditions, control maintenance and resumption. Keep astack's coordinator in its skill; a separate Cursor-style agent wrapper is unnecessary for the current installation. Workflow/platform names stay stable. The new guide uses astack examples and authority boundaries; imported principle bodies have their own licence, hashes and adaptation records.
