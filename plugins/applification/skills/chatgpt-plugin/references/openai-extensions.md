# OpenAI extension contracts

Use @openai/mcp-extensions/server and /app with a verified [SDK profile](compatibility.md). Keep the shared MCP Apps APIs underneath. The launch matrix below is expected support, not evidence from an account. Recheck upstream and the actual client before implementation.

| Feature | Desktop | Work web | iOS | Android |
| --- | --- | --- | --- | --- |
| Global/thread entrypoints, settings, inline/fullscreen | Yes | Yes | Yes | Yes |
| Deep links | Yes | Yes | Yes | No |
| Composer content mentions | Yes | No | No | No |
| File handlers, opening and file resources | Yes | No | No | No |
| OpenAI rich forms | Yes | Yes | No | No |

Web here excludes classic ChatGPT. Free/Go web extensions are coming soon in launch guidance. Feature detection and account/workspace access determine the usable path. The UI guide and SDK types mention pip, but the extension spec currently excludes it; do not promise picture-in-picture without actual host proof.

## Entrypoints and navigation

Register launch tools with _meta.ui.resourceUri and _meta["openai/ui"].entrypoints. Global and thread launch tools accept {} and should be read-only; put mutations on explicit actions. Each thread has its own UI instance. Provide descriptive titles and theme-compatible SVG icons. app-only visibility is not an authorization check and entrypoint invocations ignore its normal model-visibility behavior.

Resource display metadata declares supported inline/fullscreen modes and an optional initial preference. Preferences are hints. Don't equate fullscreen with the browser owning the whole ChatGPT window.

Deep links target a global app tool. Percent-encode the plugin identity, tool name and the entire app-relative path/query. The decoded route starts with / and has no fragment. Local identities include @marketplace; published identities omit it. Read initial openai/deepLink host context and subsequent changes. Validate routes and resource access server-side; a deep link is no permission grant.

## Settings, mentions and context

Persist settings per authenticated account. Native settings expose read/update tools; read accepts {}, supplies values for all properties, and update merges only changed properties. Restrict native fields to supported primitive types. Use a settings UI entrypoint for bespoke controls.

Mention search accepts an empty query, returns bounded authorized resource links and advertises mentions/search with app visibility. Composer mentions reference content; they don't execute arbitrary actions or grant access to referenced records.

Standard update-model-context replaces the context for that app instance. OpenAI host context reports the current attachment and user removal. Restore selection on remount and clear it when the host removes it. Use small relevant context, exclude secrets, and avoid regenerating attachments the user deliberately removed. ui/message sends a user message; expose it through an explicit user action, detect support and preserve draft behavior. Mobile supports only the active conversation target.

## Files

File extensions use dotted values such as .csv. Parse the file input schema; the app gets a name and opaque resource URI, not a path. Read/subscribe/write through host resource APIs. Unsubscribe when leaving. Check writable metadata and send ifMatch with the read ETag; handle saved, conflict and too-large without silently overwriting a newer version. A related-file server tool can receive a host-provided trusted path; validate containment including symlinks and never accept a browser-supplied path as equivalent.

## Rich forms

Native forms are elicitation schemas, not React components. Use titled choices, thumbnail icons, suggestions and resource selection only when the host supports the complete form. For registered connections require MCP 2026-07-28 MRTR; the legacy SDK elicitInput helper is for direct connections only. Validate accepted data; decline/cancel must end the operation without re-prompting or mutation. Protect requestState when it affects identity, authorization or operation state, and bind it to the actor, request and expiry. Make effects after acceptance idempotent.

Proof selects the affected boundary: actual sidebar/thread opening, deep-link updates, settings persistence, mention selection, attachment removal/remount, file conflicts or form acceptance/cancellation. Keep untested platforms explicit.

Sources checked 2026-09-30: [extension spec](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md), [SDK](https://github.com/openai/mcp-extensions/blob/main/typescript/README.md), [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr).
