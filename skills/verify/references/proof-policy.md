# Proof

Proof is a claim about an observable result on a named revision and environment. Select it from the behavior contract and the project's actual surfaces. Use the project's `astack-<app>` control CLI and feature map when present. If none exists during a small task, use the project's working commands for that task; follow [app control and feature map](../../app-control/references/control-contract.md) during project setup or when repeated app driving needs a reliable command. astack does not supply a universal app driver.

## Select

For each acceptance case, identify the cheapest check that can catch its failure and whether a running-product observation is needed. Select surfaces by behavior and dependency impact: a backend change can affect web or MCP without touching either client, while a web-only copy change normally needs no MCP run. State the reason for each applicable or excluded surface.

Use component stories when selected or already available for rendering and interaction states, tests for focused domain and protocol behavior, and real-app driving for end-to-end state, identity, timing, or integration claims. A visual result cannot establish persistence; a mocked callback cannot establish an authorized server write. Do not demand video or full-suite runs for every case when a narrower check proves it.

Choose test boundaries by the behavior they exercise. Pure logic can use focused tests, rendered interaction needs a real-browser observation, and backend permissions need backend checks. A `.tsx` file may contain a pure rule and a `.ts` file may control browser behavior; their extensions do not settle the test choice. For the [foundation reference](https://github.com/applification/astack/blob/main/examples/foundation/docs/engineering-profile.md), distinguish deterministic CI, disposable local readiness, live WorkOS OAuth, installed-host proof, and fresh-agent delivery trials.

For MCP behavior, follow the [MCP proof path](../../mcp-server/SKILL.md#prove-the-affected-boundary). A direct tool call checks its contract; a client connection to the running endpoint checks transport and deployment; a model-driven run checks how an agent chooses and uses tools. Report these as distinct claims. A mock MCP server can test a consuming client, but cannot prove the server under change.

For new web projects, use [Tester Army e2e](../../testing/references/e2e.md) for repeatable running-app checks and live MCP inspection. Existing projects keep their working runner and browser driver. When using [agent-browser](https://agent-browser.dev/) for project app control, follow the installed CLI's current `agent-browser skills get core` guidance, use a named session, and drive the actual app through its interactive snapshot. Capture a screenshot of a decisive visible state when it helps review; record a short [video](https://agent-browser.dev/recording) when timing, transitions, or a hard-to-reproduce journey matter. Selected Storybook stories can be driven with the same tool for component checks, while selected Pencil frames provide a design comparison surface. The browser observation is one part of the proof result; confirm persisted or authorized effects with a fresh read or independent view.

For ChatGPT plugins, follow [plugin engineering](../../chatgpt-plugin/SKILL.md). Record component, protocol, agent and installed-host observations separately. A Storybook view, MCP Jam host emulation or local webhook acknowledgment cannot prove actual ChatGPT navigation, native forms, attachment behavior or completed event actions. Test supported target clients and report unavailable account/host coverage as skipped.

## Discover and retain regressions

Map each material acceptance case to its check, target, actor, fixture, expected observation, and any independent read needed to establish a side effect. Select focused regressions while editing and affected regressions at a checkpoint. Select exploration charters from the contract, feature map, diff, and dependency impact when they can expose missing cases; record why exploration was selected or skipped. Documentation-only changes normally need no app exploration.

Treat exploration findings as candidates. Preserve the report, steps and artifacts, reproduce the claimed behavior with an isolated exact assertion, and distinguish a product defect from setup, locator or budget failure. A confirmed defect affecting the requested acceptance cases blocks delivery completion until fixed or the owner explicitly accepts the limitation. A requested verification can finish with an honest failure report. After an authorized fix, rerun the original repro and retain it as a regression. Use the project's existing runner or the [e2e loop](../../testing/references/e2e.md); keep backend, protocol and installed-host checks at their actual boundaries.

## Run

Before driving an instance, establish that it is the intended build and environment with disposable or authorized fixtures. Do not infer this from an open port alone. Record the full commit, build or deployment identity where relevant, surface, actor or test persona, action, expected observation, and actual observation. Confirm material mutations with a fresh read or independent view. Keep secrets and credentials out of evidence.

Use the feature map to find the affected user entry points. Run the control CLI's `doctor` before driving and after a surprising failure. A CLI command's exit code shows whether that command completed its own action and checks; judge each acceptance case from the observed running-product result and record any untested path as a gap.

Use these outcomes consistently:

- `pass`: the named check observed the expected behavior on the named target.
- `fail`: it observed contrary behavior.
- `inconclusive`: setup or observation could not distinguish pass from fail.
- `skipped`: applicable but not run, with a reason.
- `not applicable`: behavior cannot be reached from that surface, with a reason.

Read run-level errors, selected results, every relevant attempt, and exploration step statuses and termination reason. A green job, zero findings, or exit code zero can coexist with failed steps and an exhausted exploration. Report that charter as inconclusive. A retry pass records the latest observation and a flaky result; it does not erase the first failure. A locator, setup, provider or budget failure does not confirm a product defect. An explicit skipped case remains skipped, with a reason; an empty selection or missing report is inconclusive.

Preserve the first failure when rerunning. Cleanup stops what the run started and removes disposable state; it does not erase evidence needed to explain a failure. Return a concise proof result to the caller. When the task includes updating an existing PR, publish it there and follow its [media checkpoint](../../pr/SKILL.md) for any screenshots or recordings captured during proof. A later code change invalidates proof for behavior it could affect until the new revision is checked.

## Keep review evidence proportional

Keep full runner output in ignored local run folders or CI artifacts. Commit a concise proof index, the decisive sanitized reports or excerpts, source identities and selected media needed to assess the claim. Preserve the original failure and its identity, but do not copy every rerun, duplicate summary, JUnit file, empty log or full artifact tree into `.astack`. Deduplicate byte-identical media and record which observations use it. Link fuller diagnostics when useful; retain the evidence supporting lasting claims beyond CI artifact expiry.
