# Behavior contract

For ChatGPT plugin work, also record the target client/version, entrypoint, authenticated actor, model-visible context, UI-only state, persistence owner, fallback and installed-host proof. For events include the user-authorized monitoring action and stop condition. See [plugin engineering](chatgpt-plugin.md).

Use for substantial behavior changes and design sprints. The contract is one reviewable account of the intended behavior and the evidence used to implement and validate it. Start it with an outcome and a few observable acceptance cases, then add design evidence and proof as the work progresses. For a design sprint, keep it at `.astack/<feature>/behavior-contract.md` with retained evidence and any selected Pencil file in the same tracked feature folder.

Keep the contract short enough to read during implementation and review. It should answer:

- Who can do what, and why?
- Which observable cases distinguish success from plausible wrong behavior? Give material cases stable IDs such as A1 and A2.
- For web UI work, why were Pencil and Storybook each selected or skipped? When selected, which frames or stories demonstrate the relevant states or interactions? Tie each to the relevant case and say what was actually checked.
- How will each case be validated in the running product or at another appropriate seam? Record the result on the exact revision and environment once checked.
- Which product choices remain open, and what is outside this change?

Given/When/Then is optional shorthand for a case, not an executable specification. Include cancellation, authorization, persistence, errors, or accessibility when they materially change the outcome. Do not turn every visual state into another requirement.

For web UI work, selected `.pen` files and Storybook stories are evidence inside the contract, with paths, frame names, and story IDs that a reviewer can open. Pencil validates the selected visual direction; Storybook can validate component rendering and interaction with fixture data. Neither proves real data effects, timing in the app, or authorized persistence. Name the running-product check needed for those claims. If a frame or story changes, update the contract's evidence rather than leaving an old reference as the agreed design.

Resolve decisions that change the intended result before implementing them. If learning changes acceptance, update the contract explicitly and tell the user when the choice is theirs. The contract may evolve; it must not drift silently to match the implementation.

Update the tracked contract as decisions and proof change. The PR links it and summarizes the outcome and remaining gaps; it need not duplicate the full contract. Keep enduring feature-specific domain and asset decisions in the same folder when useful. For work without a design sprint, a short contract may stay in the task and PR. Do not create a parallel `docs/` feature file or leave a selected `.pen` file in a separate `design/` workstream.
