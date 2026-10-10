# App control and feature map

Use this when repeated product driving needs a capability the project does not have. The project owns its launch commands, language, drivers, fixtures and product knowledge. Reuse a working control route before building another.

## Inspect before building

Read the actual user entry points, scripts, browser or native tools, auth/fixtures and verification commands. Run a working path first. Use the chosen runtime and installed drivers; select any missing capability against the product's actual constraints. A wrapper around lint and tests alone does not drive the product.

Identify the repeated actions: start or connect to the correct instance, reach a feature, act, inspect the result and clean up. Build only the commands that remove demonstrated repetition or make a result observable.

## Create the project skill and CLI

Keep the executable and operating instructions in a project-owned skill at the chosen host's supported skill path. Use the project's installed language, package manager and executable convention. An existing parser or driver should not be replaced just to match an example. Document checkout-local invocation and useful help; a global install or PATH change is unnecessary.

Implement a small command set. A read-only `doctor` reports the checkout, revision and dirty state, target URL or process, build/deployment identity when available and readiness. Include commands to drive and observe a real user path. Add start/stop only when this CLI owns a long-lived instance. Add screenshots, logs or traces only when the chosen driver supports them and they help inspect behavior.

Dispatch subprocesses with argument arrays and an explicit working directory. Give failures nonzero exit codes and structured output when an agent consumes it. Keep selectors, URLs, startup and fixtures in the project; do not parse prose guidance as executable configuration or copy another tool's entire command tree.

Use the startup command's actual target and confirm the returned artifact belongs to this checkout. An open port or responsive hostname alone does not establish identity. Isolate targets, sessions and disposable data per checkout or run. Track what the CLI starts; drive and stop only owned instances. Preserve decisive observations through cleanup and keep credentials out of them.

## Share ownership with the test runner

Reuse identity, fixture and navigation helpers across the CLI and the project's chosen runner. Choose one owner per instance: a runner-owned instance is cleaned up by the runner; a CLI-owned instance supplies its verified target and fixture context to tests that do not stop it. Keep sessions and actors isolated even when the process is shared.

When using [Tester Army e2e](../../testing/references/e2e.md), its MCP session can provide inspection and locator validation. Other runners keep their own working inspection tools. Avoid competing selector sets or launchers for the same path.

## Map user behavior

Add a small feature map when several user paths need a reusable index. Use the project's existing location, or `.astack/feature-map/<app>/README.md` with short linked files per feature area. Each entry gives:

- The user behavior and its real entry points.
- Commands that drive it through the running product.
- The observable end state and any material side effect.
- Prerequisites and known traps, such as auth, flags or timing.

Derive entries from actual routes, commands and product documentation. Do not invent features or duplicate the repository. The map describes how to exercise behavior; a proof result records what the current run observed.

## Prove and maintain the result

Run the documented direct command and help from the checkout, then launch or connect, verify identity, drive one real path and independently inspect its material result. Clean up owned fixtures and processes. Use [verify](../../verify/SKILL.md) for the observations and gaps; a scaffold is not a working driver.

Record working commands in existing project guidance or `.astack/project.md`. When a user path or control handle changes, update affected instructions and map entries in the same PR and rerun that path. A full-map audit needs a result or gap for every scoped path; one passing feature does not establish complete coverage.
