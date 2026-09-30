# ChatGPT plugin support

## Outcome
astack can guide TypeScript projects through MCP Apps, OpenAI extensions, portable plugin packaging, local installation, and MCP 2.0 forms/events. Loami implementation is out of scope.

## Acceptance
A1. Existing astack skills, publisher identity, icons and marketplace source resolve through root plugin.json; there is no fallback manifest. Root mcp.json is valid and empty because astack itself has no runtime server.
A2. A plugin task loads the relevant references, preserves the project's stack, distinguishes host-specific behavior and never claims Storybook or MCP Jam establishes installed ChatGPT behavior.
A3. The reference UI profile lists real tools, settings, mentions and entrypoint metadata; serves built HTML; uses shared React components and the standard bridge with optional OpenAI extensions.
A4. The separate MCP 2.0 profile demonstrates real MRTR round trips, cancellation and validation, event discovery and persistent subscription lifecycle, signed delivery and bounded retry. It does not claim the released v1 helper supports MCP 2.0.
A5. Installation instructions distinguish a local package, a registered connection and a tunnel. Packaged scripts resolve from PLUGIN_ROOT without a development checkout.
A6. README, site, routing examples and CI describe the same capabilities and limits. Source links and portable schema checks pass.

## UI decisions
Pencil is not selected. This example demonstrates protocol integration with a simple records list, with no unresolved product design choice. Storybook is selected for shared component empty, selected, error and normal states. Component stories do not establish ChatGPT integration.

## Proof
See evidence.md for commands, observed results, target revision and explicit host gaps. Installed ChatGPT, OAuth, mobile coverage and live-model selection require a connected test account or host and are not established by local checks.
