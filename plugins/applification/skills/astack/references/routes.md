# Work routes

Choose the route that matches the user's outcome. These are decision guides, not compulsory checklists. Read only the applicable sections.

## Feature

Clarify the observable outcome through a [behavior contract](behavior-contract.md). For a web UI feature, use [the web feature path](web-feature.md) to decide independently whether Pencil and Storybook are useful before production wiring. For a new app without a chosen stack, use [the astack greenfield default](project-setup.md); if it needs a database, follow [the Convex path](database.md). In an existing app, work with its current stack. Trace affected entry points from trigger through data, ownership, and side effects. Check history before removing an unusual constraint; distinguish recorded intent from an inference based on current code. Sketch data shape and module boundaries before promoting prototype state or changing a costly interface. Implement in coherent slices, use fast checks, and [prove](proof.md) the integrated behavior on applicable surfaces. End with a [pull request](pr.md) linking the contract and proof result, including any unresolved gaps.

## Bug fix

Reproduce the reported symptom on its real surface or build the closest runnable signal that can fail on that symptom. Make the loop as fast and deterministic as practical. Use code and history to distinguish causes, then change the smallest mechanism supported by evidence. Rerun the original signal after the fix; a neighboring unit test alone does not establish that the reported symptom is gone. Add a regression check at a meaningful seam when it earns its maintenance cost. Findings from exploration follow the [candidate confirmation and regression loop](e2e.md) when e2e is in use; setup or locator failures do not confirm a bug. End with a [pull request](pr.md) that names the original symptom, cause, fix, and observed before/after proof.

## Refactor

State the behavior that must remain unchanged and pin it with an existing test, recorded output, or a temporary equivalence check. Name the structural improvement and the expected reduction in reader load. Move in small steps, run the pin, and delete obsolete paths once callers have moved. [Prove](proof.md) the affected real artifact when the move crosses a user-visible or integration boundary. If behavior must change, use the Feature route for that part. End with a [pull request](pr.md) showing the equivalence evidence and structural improvement.

## Performance

Identify the user-visible or operational metric and measure a baseline under comparable conditions. Investigate the bottleneck before editing, change one plausible cause, and compare against the baseline. Report the size and limits of the measurement. A faster microbenchmark does not prove a faster user path unless it represents that path. When the route changes the repository, end with a [pull request](pr.md) containing the comparable measurements.

## Investigation

Answer the question from code, history, running behavior, or primary documentation as appropriate. Separate observed facts from inference. Recommend an option with tradeoffs when asked; do not create implementation work merely to make the answer feel complete. A read-only investigation ends with the answer; if the user asks to implement a finding, use the relevant change route and its PR.

## Cloud transition

A user request to move an app to cloud or host it follows [cloud transition](cloud-transition.md) as project delivery work. Resolve target/data choices, preserve local development, configure and deploy chosen surfaces, verify actual hosted behavior and retain recovery. A new app starts locally until that request.

## App control

Follow [app control and feature map](app-control.md) to create or repair the project-owned `astack-<app>` CLI and its user-facing map. Start from the real product and its existing drivers. Prove one mapped path with the generated command, then open a PR showing the command, observation, retained evidence, and any coverage gap. If the user asked only for a read-only assessment of the control route, use Investigation instead.

## Pull request

Read [PR and review](pr.md). Review the diff against the intent and project standards, then report proof and material gaps without relabeling inconclusive work as passed. If authorized fixes are made, update the PR under review rather than opening a duplicate.
