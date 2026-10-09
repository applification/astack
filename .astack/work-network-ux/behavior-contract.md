# Graph exploration experience

The owner likes the relationship-network proof of concept and wants clearer,
more polished controls and supporting content around node/edge interaction.
This iteration changes presentation and local selection state; the captured
relationship projection, authorization and persisted evidence remain owned by
the existing implementation.

| Case | Observable outcome |
| --- | --- |
| U1 | A compact toolbar separates layout, grouped filters and expansion. View options and canvas navigation are secondary. Active restrictions and a reset are clear. |
| U2 | Node and edge hover or keyboard focus provides a short contextual preview. Clicking or activating either opens a persistent evidence panel with typed relationship meaning, endpoint navigation and source links. |
| U3 | The graph uses full width; desktop inspection overlays its right edge without changing canvas scale. Narrow inspection stacks below the canvas. The panel can be dismissed with return focus; filtered/missing selections remain explicit. Controls and previews fit the viewport. |
| U4 | Work story retains its existing evidence path and selection continuity. Current local Convex data still renders through the unchanged adapter; no capture or grading writes are introduced. |

## Direction and tools

Use the existing Observatory colors, type and shared primitives. A hover preview
is for orientation; the selected panel is for text and source evidence. Edges
are inspected as recorded relationships, with their own identity, rather than
silently selecting an endpoint. Opening a panel must preserve canvas scale and
position so the selected target stays recognizable. When keyboard navigation
subsequently reaches an item covered by the desktop inspector, the canvas pans
only enough to reveal it; zoom remains unchanged. Narrow inspection does not
cover the canvas. Hidden-selection wording reflects whether the panel is open.

Pen was selected for the workspace states. It initially lacked a desktop
connection and then an open document. The owner opened
`/Users/rufus/Apps/astack/design/astack.pen`, which restored the tools.
The HTML [interaction specification](interaction-spec.html) preceded the main
implementation. Pen's later comparison/refinement is not evidence that it guided
the initial generation.

Pen frame `nGcY7` (**Selected direction · compact inspector**) specifies a short
header, one dismissal action, typed relationship meaning, endpoint navigation
and supporting capture. Frame `I3aA07` contains live browser `KEJOr` for the actual
`observatory-evaluations--network-explorer` story; `blGY1` is an imported inspector
for comparison. The comparison prompted a single-row layout label and removal
of the redundant graph Back button. The owner-selected Pen document stays in
their main checkout; a frame export will be retained here for PR access.

Storybook is selected for toolbar, hover/focus preview, node/edge selection,
dismissal, hidden capture and narrow-screen states. Retained screenshots use
synthetic data. Keyboard previews open after focus scrolling settles; resetting
filters keeps the reset control focusable instead of closing the popover.

Relationship explanations describe only captured meaning. In particular,
`records` links can originate from either a conversation or a loaded turn, so
the label is **Recorded activity**. A link has no invented body or occurrence
time. Its supporting panel reuses the relevant captured endpoint details.

The owner is the parent agent, with one writer in this worktree. A separate
read-only UX/accessibility contribution and final integrated review are advisory;
the parent resolves findings and verifies the integrated result in PR #33.
