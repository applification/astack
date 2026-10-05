# Work items visual design

The owner selected Pen (pen.dev) on 5 October 2026. `work-items.pen` is the editable visual source. Use Pen MCP to read or edit it; never interpret the encrypted file with text tools. `spec.json` was extracted through MCP after designing the frames and before implementing the UI. PNGs in `frames/` are source design exports, not screenshots of completed code.

The visual direction is calm and practical: warm neutral ground, forest green actions, explicit status labels, open list rows, Inter typography and a 4/8/12/16/24/32 spacing scale. Input/action height is 44 px; control radius is 8 px. Reusable components include the header, primary button, title input, creation form, filters, work-item row, empty list and notice. Default and dark palettes use semantic variables. MCP host fonts and supported SDK color variables take precedence over defaults.

| Frame          | Pen ID / source image       | Story ID                            | Viewport   |
| -------------- | --------------------------- | ----------------------------------- | ---------- |
| Web mixed      | [Hhign](frames/Hhign.png)   | `work-items-workspace--web-mixed`   | 1040 × 800 |
| Web narrow     | [l5CZRK](frames/l5CZRK.png) | `work-items-workspace--web-narrow`  | 390 × 800  |
| MCP mixed      | [azIBu](frames/azIBu.png)   | `work-items-workspace--mcp-mixed`   | 720 × 520  |
| MCP host dark  | [mcpFP](frames/mcpFP.png)   | `work-items-workspace--mcp-dark`    | 720 × 520  |
| Web empty      | [XSTWb](frames/XSTWb.png)   | `work-items-workspace--web-empty`   | 1040 × 800 |
| Web loading    | [FrMvz](frames/FrMvz.png)   | `work-items-workspace--web-loading` | 1040 × 800 |
| MCP saving     | [dcVZh](frames/dcVZh.png)   | `work-items-workspace--mcp-saving`  | 720 × 520  |
| MCP save error | [uJu1t](frames/uJu1t.png)   | `work-items-workspace--mcp-error`   | 720 × 520  |
| MCP empty      | [ZZhmK](frames/ZZhmK.png)   | `work-items-workspace--mcp-empty`   | 720 × 520  |

[Foundations](frames/bi8Au.png) and [components](frames/ixrbW.png) show the source tokens and reusable elements. The embedded view has no creation form, so its empty state asks the assistant to add an item. Its compact padding and host theme are deliberate platform adaptations.

Run `bun run design:verify`. It builds this project's own Storybook, serves that build on a disposable loopback port, and compares the nine fixtures with `spec.json`. It checks layout within 4 px (allowing renderer rounding/font metrics), exact heading typography/text and selected semantic surfaces, pending controls, alert semantics, overflow and uncaught errors. `.proof/design/` retains source/spec identities, observations and rendered screenshots. A caller-supplied `--url` is useful while iterating, but its server source identity is explicitly unverified.

Inspect the source and rendered images side by side: automatic measurements do not judge composition, accessibility or all visual details. Stories use fixture data; they do not prove persistence, authorization, OAuth or installed-host behavior. Run `bun run readiness` for the actual web → Convex → MCP journey and host lifecycle. Real auth/loading/error timing remains owned by the platform adapters.

For a consequential UI change, choose the relevant existing frames/components or update the visual specification through Pen before implementing the new choice. Re-extract affected frames/spec and update the story mapping deliberately. Keep the design as a generation input; do not replace it with an import of already completed code and claim design-guided delivery.
