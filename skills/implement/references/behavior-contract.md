# Behavior contract

For a substantial change, keep a short account of the outcome and the cases that distinguish success from plausible wrong behavior. Use existing project records; `.astack/<feature>/behavior-contract.md` is an option when a separate file helps. A small change can keep this in the task and PR.

Record only what the change needs:

- Who can do what, and why?
- Which observable cases distinguish success, failure and material boundary conditions?
- Which product or design choices are open, and what is outside scope?
- How will each case be checked: target, actor, fixture, expected result and any fresh read needed for a side effect?
- For persistence, retries, migrations or background effects, what happens after interruption, duplicate delivery or restart?

Use the project's selected design and component tools when they answer a real question. Link relevant artifacts to the cases they support. A visual comparison or component fixture establishes only those states; data, identity and persistence need checks at their owning boundary.

Given/When/Then and case IDs are useful when they clarify the change. They are not a required format. Resolve choices that change the intended outcome before dependent implementation. If learning changes acceptance, update it explicitly rather than letting it drift to match the code.

Keep agreed definitions and consequential rationale in the project's existing glossary or decision register, following [domain language guidance](../../domain-modeling/SKILL.md). Update relevant links and results as the work changes. Put concise proof and any remaining gaps in the PR, with the actual revision and environment.
