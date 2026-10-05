# MCP App UI

Use the standard MCP Apps bridge for initialization, tool input/results, server tool calls, messages and model context. Add @openai/mcp-extensions/app for supported OpenAI additions. window.openai is for capabilities without a shared equivalent, not the default data layer. Check [compatibility](compatibility.md) before installing SDKs.

## Reuse components

Share browser-safe presentational components from packages/ui or the project's existing UI package. Pass typed data and callbacks into them. Keep App, OpenAIExtensions, capability detection, navigation and tool calls in the MCP App adapter. Do not import Next.js server components, server secrets or Node filesystem code into the iframe. Bundle the production components as an HTML resource; do not embed Storybook as the product UI.

For web design follow [web-feature](../../web-feature/SKILL.md). Storybook is useful for host themes, inline/fullscreen sizing, loading, empty, error, selected, read-only and conflict states. Provide a small fake host adapter where interactions need it and call that component evidence. Preserve the project's shadcn/Tailwind system; map its tokens to host variables. @openai/apps-sdk-ui and the extension stylesheet are optional. Avoid global styles that accidentally replace host-compatible controls.

## Lifecycle and data

Register tool-input, tool-result, host-context and teardown handlers before connect. Render the initial result without re-calling the launch tool. Apply theme/style variables at initialization and when host context changes. Extension categories may be undefined before initialization or on unsupported hosts; feature-detect after connection and show an actionable fallback. Mount one bridge instance and remove listeners/subscriptions on teardown.

Keep authoritative data in authorized domain services. Tools return structuredContent for chaining plus useful text when there is no UI. Keep selection and filters in component state, preferences in backend storage, and widget state only as optional per-instance persistence. localStorage is not a durable cross-device account store.

Prefer data tools without UI metadata and focused launch/render tools with _meta.ui.resourceUri. UI actions call data tools and update their current view rather than remounting after every mutation. Validate untrusted tool results before rendering; keep UI-only content out of model context.

## Resources and proof

Serve built HTML at a versioned ui:// URI using text/html;profile=mcp-app. Put ui.csp, ui.domain and display metadata on returned resource contents. Declare the exact connect/resource origins; external styles and nested frames can be blocked. Change the resource URI when an incompatible bundle changes, update all referring tools and refresh the registered server metadata.

Check the bundle, real tool/resource responses, first render, tool calls, theme updates, remounts, missing capabilities and errors. Installed ChatGPT proof must separately observe navigation, context removal and permitted data effects. A browser screenshot of Storybook establishes none of those host actions.

Sources checked 2026-09-30: [UI guidance](https://developers.openai.com/plugins/build/chatgpt-ui), [MCP Apps](https://modelcontextprotocol.io/docs/extensions/apps), [TypeScript extension lifecycle](https://github.com/openai/mcp-extensions/blob/main/typescript/README.md).
