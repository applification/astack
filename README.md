# astack

astack by Applification is an opinionated engineering system delivered as the **Applification** Codex plugin. Install it, establish or upgrade your project's runtime control and verification loop, then give `$applification:astack` an engineering request or invoke a focused skill directly. Each skill owns its instructions; each project owns its running environment, commands and product knowledge.

**[Explore the astack site](https://astack.applification.net/)** for a visual route map and searchable routing examples. This README and the [skill source](skills/astack/SKILL.md) hold the detail. The site lives in [`site/`](site/) in this repository.

The [astack guide](docs/guide/README.md) walks through project setup, a first real task, design decisions, runtime verification, principle-based steering and resumption.

## Install → set up → use

1. **Install the Codex plugin.** Use the commands below or the [project installation guide](docs/project-install.md) to pin a version. Codex remains the supported installation path; Claude and Skills CLI distribution can be added later without moving project runtime knowledge into the package.
2. **Establish the project loop.** Run `$applification:project-setup Set up this new project` or `$applification:project-setup Integrate and upgrade this project for astack`. Setup applies the [new-product defaults](skills/project-setup/references/profile.md) or improves an existing project's development, control and verification tooling. The outcome is a loop an agent can actually run: start, identify, act, inspect, check and retain evidence through cleanup. It records the working loop in `.astack/project.md` and links it from project agent instructions.
3. **Give it work.** Use `$applification:astack <request>` to select and compose the skills through the requested outcome, or `$applification:<skill> <request>` for a focused job. Both read the relevant project guidance. A missing profile does not block a narrow task or trigger a project-wide upgrade.

## How it works

| You want to… | astack's route |
| --- | --- |
| Add or change user behavior | Feature |
| Fix a reported defect | Bug fix |
| Change structure while preserving behavior | Refactor |
| Improve measured slowness | Performance |
| Answer a question from evidence | Investigation |
| Review or finish an existing change | Pull request |
| Make a running app controllable for verification | App control |
| Establish or upgrade a project's runtime and verification loop | Project setup |

The route is a decision guide, not a checklist. astack picks checks that can catch the relevant failure and records what was actually observed. Kept repository changes end in a pull request; a read-only investigation ends with an answer. See the [work routes](skills/astack/SKILL.md), [proof guidance](skills/verify/SKILL.md), and [routing examples](evals/routing.md).

The plugin has one coordinating entry, [`astack`](skills/astack/SKILL.md), plus independently callable skills. Call `$applification:astack` to carry a task through delivery, or `$applification:<name>` for a focused job. Skills own their instructions and outputs; references hold supporting policy and platform detail. Composition can be sequential and does not require subagents.

| Skill | Job |
| --- | --- |
| [`typescript-best-practices`](skills/typescript-best-practices/SKILL.md) | Concrete TypeScript modeling, validation and boundary rules imported from pstack |
| [`react`](skills/react/SKILL.md) | Components, state, effects, forms and portable adapters |
| [`convex`](skills/convex/SKILL.md) | Data, ownership, functions and reactive integration |
| [`workos-auth`](skills/workos-auth/SKILL.md) | AuthKit/Connect identity, tokens and auth proof layers |
| [`testing`](skills/testing/SKILL.md) | Meaningful regressions, integration/browser checks and candidate confirmation |
| `implement` | Deliver an agreed feature or behavior change |
| `bug-fix` | Reproduce and repair a supported defect |
| `refactor` | Improve structure while preserving behavior |
| `performance` | Measure and address slowness |
| `investigate` | Answer an engineering question from evidence |
| `show-me` | Explain the current topic visually, throughout a conversation |
| `domain-modeling` | Resolve concepts, glossary terms and consequential decisions |
| `project-setup` | Establish a new project or integrate and upgrade an existing runtime loop |
| `app-control` | Build or repair product driving and feature maps |
| `verify` | Run proportionate checks and report actual proof |
| `pr` | Review a change or prepare/update its pull request |
| `web-feature` | Design and deliver web UI with Pen/Storybook choices |
| `mcp-server` | Build and prove MCP tools, transport and authorization |
| `chatgpt-plugin` | Build ChatGPT UI, extensions, packaging and events |
| `cloud-transition` | Deliver an authorized hosting transition |

Browse the [skills directory](skills/) for each `SKILL.md`. Each has YAML `name`, `description` and `metadata.short-description`, plus `agents/openai.yaml` with a display name, short description, invocation prompt and automatic-selection policy. The seven delivery routes stay intact, with project setup establishing their runtime loop. Ordinary features and fixes use the project's established stack; setup can integrate and upgrade it toward Applification's opinions. New-product defaults use Bun/Turbo, React/Vite, Convex, WorkOS and MCP where the behavior needs them. Proof names the affected behavior, revision, environment and observed result. Small fixes stay lightweight.

The coordinator separates **workflows** (such as `bug-fix` and `project-setup`), **platform expertise** (such as `react` and `convex`) and **principle leaves**. The index selects applicable principles; their full instructions live in independently callable skills:

| Principle leaf | Apply when |
| --- | --- |
| [`principle-type-system-discipline`](skills/principle-type-system-discipline/SKILL.md) | Designing typed states or signatures in any typed language |
| [`principle-boundary-discipline`](skills/principle-boundary-discipline/SKILL.md) | Wiring validation, errors or framework/protocol adapters |
| [`principle-encode-lessons-in-structure`](skills/principle-encode-lessons-in-structure/SKILL.md) | Preventing demonstrated recurring failures with structural mechanisms |
| [`principle-prove-it-works`](skills/principle-prove-it-works/SKILL.md) | Establishing the claimed outcome against the real artifact |
| [`principle-test-behavior-not-implementation`](skills/principle-test-behavior-not-implementation/SKILL.md) | Designing assertions that distinguish observable failures |
| [`principle-fix-root-causes`](skills/principle-fix-root-causes/SKILL.md) | Diagnosing a reproduced defect and repairing its supported cause |
| [`principle-sequence-verifiable-units`](skills/principle-sequence-verifiable-units/SKILL.md) | Delivering multi-step changes in coherent checked units |

The first three promote already bundled pstack principles out of TypeScript references; the verification/delivery leaves extend the same structure with pinned, attributed guidance. Workflow and platform names remain callable as before. Read a leaf when its decision applies; a direct skill can compose the same principles without entering the coordinator. Use principle names to steer a concrete decision. No separate host-specific routing agent is required.

TypeScript retains pstack's rule table and examples and composes the callable principle leaves. Show-me retains HumanLayer's visual formats/examples; domain-modeling retains Matt Pocock's active modeling discipline and glossary/ADR formats. Each import has its MIT licence, source revision, original hashes and narrow adaptations beside the skill; see [attribution](NOTICE.md). The [ownership and trial record](.astack/knowledge-ownership/behavior-contract.md) distinguishes structural checks from observed use.

[Specialist guidance](skills/astack/references/specialists.md) bounds actual delegated contributions by affected behavior and risk. Ordinary requests use the owning skills without a role roster or separate handoff record. Environments without delegation apply expertise sequentially and disclose missing independent review. Each worktree has one writer.

The [portable text handoffs](skills/astack/references/handoffs.md) carry work identity, evidence, scope, acceptance, authority and execution limits through specialist contributions and the lead’s result. They distinguish completed engineering work, partial/draft results and blocked decisions. astack supplies the engineering method; the external COS host owns durable records, priorities, dispatch, deduplication and outcome follow-up. The [worked examples](skills/astack/references/handoff-examples.md) illustrate the contracts; actual specialist delivery and the external pilot remain [subsequent proof milestones](.astack/specialists/milestones.md).

## Install in Codex

The [Applification marketplace](.agents/plugins/marketplace.json) points to the plugin in this repository. To try it directly after the first release is on `main`:

```sh
codex plugin marketplace add applification/astack
codex plugin add applification@applification
```

For a project-controlled version, use the [project installation guide](docs/project-install.md). Start a task with `$applification:astack`, for example, `$applification:astack Fix the save button that loses edits after reopening`. In Codex CLI or the IDE extension, `/skills` can select the same skill. Plugin skills do not create a literal `/astack` slash command; [Codex's custom prompt commands are deprecated](https://learn.chatgpt.com/docs/custom-prompts). After installation, invoke `$applification:project-setup` to establish or upgrade the project loop. Setup records `.astack/project.md`, adds a short pointer in the project's agent instructions, and creates or upgrades the project-owned `astack-<app>` control CLI and feature map for runnable products. It proves one safe real path and records remaining coverage or prerequisite gaps. The plugin stays sourced from this repository; project-specific details stay in the project.

For local development of this plugin, use `codex plugin marketplace add /absolute/path/to/astack` and `codex plugin add applification@applification` in a test Codex installation. The desktop app may need a restart to load an updated installed copy.

## Behavior contract

For a substantial behavior change, astack keeps one contract with an outcome, a few observable acceptance cases, affected surfaces, and unresolved product decisions. Given/When/Then can express a case but is not required. For web UI work, record the Pencil and Storybook decisions; when used, link the chosen frames and story IDs beside the cases they support, with what each actually demonstrated. Implementation follows that contract, and running-product proof records the results for the same cases. The PR links the tracked contract and summarizes its evidence.

When a design sprint uses Pencil, its artifacts live together in `.astack/`, which must be visible to Git:

```text
.astack/
  project.md
  presence/
    behavior-contract.md
    loami-chat.pen
    embedded-image.png
    evidence/
```

When used, Storybook stories stay with their components in `apps/` or `packages/` and are referenced from the contract. astack does not create separate root `design/` and `docs/` folders for feature work.

## Domain language

When a change introduces or changes domain concepts, astack uses the project's existing glossary and concrete code/user cases to resolve ambiguous terms. It records agreed meanings promptly, keeps observable acceptance in the behavior contract, and puts consequential rationale in the existing decision register. Without an established glossary, create `GLOSSARY.md` only when the first term is agreed; follow an existing `GLOSSARY-MAP.md` for multiple contexts. Small fixes using settled terms need no extra modeling pass. See [domain language guidance](skills/domain-modeling/SKILL.md).

## App control

The [app control route](skills/app-control/SKILL.md) creates a project-local `astack-<app>` CLI that can launch or connect to a running product, check its identity, exercise user actions, inspect results, and capture evidence. Its skill and executable script live in `.codex/skills/astack-<app>/`; a short feature map in `.astack/feature-map/<app>/` records how users reach each feature and which CLI commands drive it. Agents can invoke the script directly by path from the checkout; a package script is optional convenience, and global `PATH` setup belongs to the user. New Bun CLIs use Commander for command parsing. The CLI is built from the project's existing browser, simulator, terminal, or protocol tools; astack does not bundle one driver for every product. Setup proves the direct invocation and one mapped path end to end, and later changes update the command and map when that path changes.

For new products without a chosen stack, astack's default is a Bun workspace monorepo with Turborepo: deployable surfaces in `apps/`, reusable code in `packages/`. New interactive web UI uses **React + TypeScript + Vite** and shared shadcn/ui with Tailwind CSS in `packages/ui`. Choose **Next.js App Router** when server rendering or public content requirements justify it; its version-matched agent docs and configured DevTools MCP remain part of that path. Local web development uses [Portless](https://portless.sh/) for worktree-specific URLs, with Node.js 24+ alongside Bun. The [shadcn lint workflow](skills/react/references/shadcn-lint.md) applies when shadcn/ui is used. Ordinary work uses the existing stack; project setup assesses and implements useful upgrades toward this loop, honoring explicit project choices and resolving larger migration scope.

The [foundation profile](examples/foundation/docs/engineering-profile.md) is a worked example for persistent web and MCP products: Convex owns data and serves MCP from an HTTP action; WorkOS AuthKit handles web sign-in and Connect handles MCP OAuth. The [work-item reference](examples/foundation/README.md) shares presentation and domain code across web and MCP UI, with host and data integration in adapters. Generate a separate project with `bun scripts/create-foundation.ts <destination>`. Its `check:quick`, `check:affected`, `check:ci`, and `readiness` commands give scoped feedback and local running-product evidence. Choose forms and data handling from the platform's supported integration; the Vite reference uses TanStack Form + Zod with native Convex subscriptions. Choose tests by behavior rather than `.ts` or `.tsx` filenames.

New apps start with persistent local development, including Convex. The user decides when to [move an app to cloud](skills/cloud-transition/SKILL.md). astack carries that transition through project/deployment and data choices, frontend/auth/MCP configuration, actual hosted verification and recovery while preserving local development. The generated reference supplies guarded `dev`, `dev:backend` and `convex:local` commands and a portable transition guide.

The [measured feedback and provisional local budget](.astack/foundation/feedback-proof.md#provisional-local-feedback-budget) describe when to investigate slower checks on the observed host. The [foundation backlog](.astack/foundation/backlog.md) records later specialist and chief-of-staff integration requirements.

The generated profile carries its [Pen visual design](examples/foundation/.astack/design/README.md): semantic tokens, shared components, web/MCP layouts and frame-to-story links. `design:verify` builds the generated project's Storybook and records design-derived comparisons and screenshots. Use this alongside running-product proof; fixture rendering does not establish persisted effects or live OAuth.

Reference execution, live WorkOS OAuth, installed MCP host behavior, and delivery trials by fresh agents are separate claims. Read the reference's retained evidence and gaps before relying on a result; deterministic checks or local signed identities cannot establish the other layers.

For Convex work, install the companion `convex@openai-curated-remote` plugin. astack uses `@Convex` for general guidance, `$convex:quickstart` where its new-app scaffold fits, `$convex:convex-expert` for backend edits, and `$convex:add` for capabilities in an existing Convex + Next.js app. [Convex PR review](skills/pr/SKILL.md) requires `$convex:convex-reviewer` before the PR is ready. astack itself does not bundle the Convex plugin.

Proof maps material acceptance cases to checks and running-product observations. [Tester Army e2e](skills/testing/references/e2e.md) is the default for repeatable verification and live MCP inspection in new web projects; existing apps keep their working runners. The loop discovers candidates, reproduces them with exact assertions, fixes confirmed defects, and retains passing regressions. Reports determine proof outcomes: a green exploration job with exhausted or failed steps remains inconclusive, and a retry pass remains flaky. The [runnable reference](examples/e2e-proof/README.md) exercises this policy without model calls. A passing test or a screenshot supports only the behavior it actually exercised. Applicable but untested surfaces remain visible as gaps. During PR preparation, choose a [compact explanation view](skills/show-me/SKILL.md) when it helps the reviewer understand changed logic, ownership or interactions: pseudocode, a tree, a before/after sketch or a diagram. Keep illustrations distinct from observed proof; a simple fix can stay concise. Before a PR is ready, attach any media captured during proof or explain why media was unnecessary; video is optional.

For ChatGPT plugins, astack has a [plugin engineering path](skills/chatgpt-plugin/SKILL.md) for MCP Apps, shared UI and Storybook, OpenAI extensions, portable packaging, local installation, and MCP 2.0 forms/events. It selects a verified [SDK compatibility profile](skills/chatgpt-plugin/references/compatibility.md), distinguishes local checks from installed ChatGPT proof, and keeps platform gaps explicit. The [reference example](examples/chatgpt-plugin/README.md) exercises released-extension and MCP 2.0 profiles separately. It does not implement Loami.

The repository root is the Applification plugin root: [skills/](skills/) owns reusable engineering guidance, [assets/](assets/) contains presentation assets, and [plugin.json](plugin.json) and [mcp.json](mcp.json) define the package. OpenAI presentation metadata lives under `extensions.com.openai`. The manifest keeps the `applification` namespace. The MCP configuration is empty because astack distributes engineering guidance, not an application server. Project records, examples and the site remain separate from skill instructions.

For MCP servers, astack has a separate [server and proof path](skills/mcp-server/SKILL.md). It uses the project's transport and authentication requirements, tests tool contracts through an MCP client, and checks the running endpoint and agent behavior when those boundaries matter. Agent evaluations are selected for changes to tool discovery or model use; a mock server does not establish that the real server works.

## Development

Validate the skill with Codex's bundled `skill-creator` validator and the portable manifests with `bun scripts/check-plugins.ts`. The latter checks the published Agent Plugins schemas, packaged paths and marketplace discovery. See [evaluation cases](evals/routing.md) for behavior to exercise when changing routing or proof selection. Run `bun run typecheck`, `bun test src`, and `bun run verify` from `examples/e2e-proof` for report policy and the real Chromium repro loop; its README covers pinned installation. CI exercises the same reference without a model provider.

The site is plain HTML, CSS, and JavaScript in [`site/`](site/). Preview it with `python3 -m http.server 8000 --directory site`. Run `node site/check.mjs` to catch route, eval, or source-link drift. GitHub Pages publishes the folder after a merge to `main` at `astack.applification.net`. When changing astack behavior, update the site and README in the same PR; the Pages workflow checks that routes, eval copy, and source links stay current.

## Sources

astack draws on [pstack](https://github.com/cursor/plugins/tree/main/pstack), [FetchUpstream's ChatGPT port](https://github.com/FetchUpstream/pstack-plugin), and [Matt Pocock's skills](https://github.com/mattpocock/skills). The PR explanation guidance also draws on [HumanLayer’s show-me](https://github.com/humanlayer/skills/blob/ca7c8088db69e315a8b2deea43820270457f8f3c/plugins/show-me/skills/show-me/SKILL.md). These ideas are adapted for a project-independent, Codex-first workflow. See [NOTICE](NOTICE.md).

## License

MIT. See [LICENSE](LICENSE).

## Agent Observatory

[Agent Observatory](docs/agent-observatory.md) adds Astack’s private agent feedback loop: automatic persisted Codex capture, a portable metadata-only collector with offline buffering, private self-hosted Convex on Otis, and Work → Runs → Trace plus skill-version/problem views. External COS work remains optional parent context. [MacBook setup](docs/agent-observatory-macbook.md) installs only the collector on another machine; [evidence](.astack/agent-observatory/evidence.md) distinguishes live deployment, synthetic tests and remaining gaps.
