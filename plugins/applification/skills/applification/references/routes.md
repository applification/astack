# Work routes

Choose the route that matches the user's outcome. These are decision guides, not compulsory checklists. Read only the applicable sections.

## Feature

Clarify the observable outcome through a [change contract](change-contract.md). For a web UI feature, follow [the required Pencil and Storybook path](web-feature.md) before production wiring. For a new app needing a database, follow [the Convex path](database.md). For a feature in a clean repository, establish the project and proof route using [project setup](project-setup.md). Trace affected entry points from trigger through data, ownership, and side effects. Check history before removing an unusual constraint; distinguish recorded intent from an inference based on current code. Sketch data shape and module boundaries before promoting prototype state or changing a costly interface. Implement in coherent slices, use fast checks, and [prove](proof.md) the integrated behavior on applicable surfaces. End the feature with a [pull request](pr.md) carrying the contract and proof result, including any unresolved gaps.

## Bug fix

Reproduce the reported symptom on its real surface or build the closest runnable signal that can fail on that symptom. Make the loop as fast and deterministic as practical. Use code and history to distinguish causes, then change the smallest mechanism supported by evidence. Rerun the original signal after the fix; a neighboring unit test alone does not establish that the reported symptom is gone. Add a regression check at a meaningful seam when it earns its maintenance cost.

## Refactor

State the behavior that must remain unchanged and pin it with an existing test, recorded output, or a temporary equivalence check. Name the structural improvement and the expected reduction in reader load. Move in small steps, run the pin, and delete obsolete paths once callers have moved. [Prove](proof.md) the affected real artifact when the move crosses a user-visible or integration boundary. If behavior must change, use the Feature route for that part.

## Performance

Identify the user-visible or operational metric and measure a baseline under comparable conditions. Investigate the bottleneck before editing, change one plausible cause, and compare against the baseline. Report the size and limits of the measurement. A faster microbenchmark does not prove a faster user path unless it represents that path.

## Investigation

Answer the question from code, history, running behavior, or primary documentation as appropriate. Separate observed facts from inference. Recommend an option with tradeoffs when asked; do not create implementation work merely to make the answer feel complete.

## Pull request

Read [PR and review](pr.md). Review the diff against the intent and project standards, then report proof and material gaps without relabeling inconclusive work as passed.
