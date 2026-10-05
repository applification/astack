# Design-derived foundation follow-up

F10 extends PR 15 with the owner's selected Pen design. The original foundation skipped visual design and demonstrated engineering delivery only. Those historical v1 scores remain unchanged.

The [portable design record](../../../examples/foundation/.astack/design/README.md) names all nine frames, stories, viewports and source images. Pen MCP created the semantic tokens, reusable components and layouts before their translation into the shared React UI. The generated project carries the editable source and exported handoff. The live Storybook story was also loaded in Pen's integrated browser for comparison.

The shared UI preserves props/callback ownership. Web keeps its WorkOS, TanStack and Convex adapter; MCP keeps its SDK bridge, validation and teardown. The narrow form stacks its action, completed items have an explicit icon and label, and the embedded empty state directs creation through the assistant. The Inter font is bundled locally and inlined into the MCP resource. Supported host theme/font variables override the default design.

`design:verify` checks the selected source specification against a fresh local Storybook build and records screenshots. Its 4 px structural tolerance is not a pixel-perfect image or general accessibility claim. Visual review and actual running-product readiness remain separate requirements. The creation-trial rubric was declared before execution in [trial-rubric.md](trial-rubric.md); it scores two fresh design-aware creation rounds separately from the historical feature/bug trials.

Observed results and revision identities will be recorded here after validation. Live WorkOS and installed ChatGPT remain separate gaps in the foundation evidence.
