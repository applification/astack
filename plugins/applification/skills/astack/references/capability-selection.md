# Select affected capabilities

Use this before implementation in a directly invoked delivery or platform skill. Select only the guidance whose boundary the change reaches; do not load the whole collection or restart the task through astack.

| Affected boundary | Guidance to apply |
| --- | --- |
| Ambiguous domain meaning or a new concept | [domain-modeling](../../domain-modeling/SKILL.md) |
| Web interaction, layout or presentation | [web-feature](../../web-feature/SKILL.md), with separate Pen/Storybook decisions |
| Convex backend code | [database guidance](database.md); use the companion convex-expert before editing backend code |
| MCP tools, transport or OAuth | [mcp-server](../../mcp-server/SKILL.md) |
| ChatGPT plugin UI, extensions, events or packaging | [chatgpt-plugin](../../chatgpt-plugin/SKILL.md) |
| Missing repeatable product driving | [app-control](../../app-control/SKILL.md) when establishing it is in scope |
| A requested new product or astack adoption | [project-setup](../../project-setup/SKILL.md) |
| An authorized hosting transition | [cloud-transition](../../cloud-transition/SKILL.md) |

A selected skill can already be the caller: apply its guidance once rather than invoking it recursively. Existing project conventions and the user's choices take precedence. Convex review belongs to the pr skill before readiness; companion skills must actually be available, and missing required expertise/proof is a reported gap. Reading a dependency does not authorize unrelated implementation, migration or external effects.
