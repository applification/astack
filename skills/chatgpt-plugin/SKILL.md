---
name: chatgpt-plugin
description: Build or change ChatGPT plugin UI, extensions, packaging or events with explicit SDK and installed-host boundaries.
metadata:
  short-description: "Build and prove ChatGPT UI, packaging and host integration"
---

# ChatGPT plugin engineering

Read `.astack/project.md` when present for the project's runtime, control and verification commands; use the requested scope without requiring the astack coordinator or a setup pass.

Use this skill directly or during astack delivery for ChatGPT/Work plugin implementation, MCP Apps, OpenAI extensions, plugin packaging, or MCP Events. Keep the existing Feature, Bug fix, Refactor or Investigation route; this is specialized implementation guidance, not a new route. A tools-only MCP change stays on [the MCP server path](../mcp-server/SKILL.md).

## Select the pieces

A plugin packages skills and MCP connections. The MCP server owns authorized actions and resources. MCP Apps adds bundled HTML UI and a standard host bridge. OpenAI extensions add ChatGPT-specific entrypoints and context. MCP Events adds user-authorized monitoring through persistent subscriptions. Add only the pieces the requested outcome uses.

Use the TypeScript SDK for OpenAI extensions. Before adding dependencies read [compatibility](references/compatibility.md), check the published peer requirements, and prove the selected profile. Protocol revisions, package major versions and MCP Apps bridge versions are different identifiers. Do not infer support for a protocol from a package name.

Load only the relevant references:

| Work | Reference |
| --- | --- |
| Shared React UI, Storybook, bundling or host lifecycle | [MCP App UI](references/mcp-app-ui.md) |
| Sidebar, thread panels, settings, links, mentions, context or files | [OpenAI extensions](references/openai-extensions.md) |
| Monitoring, subscription lifecycle or webhook delivery | [MCP Events](references/mcp-events.md) |
| Portable manifests, local marketplace, server connection or tunnel | [Packaging and local installation](references/plugin-local-install.md) |

## Contract and ownership

Extend the project's existing behavior contract with target clients and versions, entrypoint and trigger, authenticated actor, what the model sees, UI-only state, authoritative persistence, capability fallback, and required real-host observations. Include the user instruction that authorizes an event response and what ends monitoring. Do not turn every application state change into an unsolicited message.

For new products, follow [project setup](../project-setup/SKILL.md). Typical consumers are apps/mcp, apps/plugin-ui, packages/ui and an existing domain/backend package. Separate browser-safe presentation components from the MCP adapter and server code. An existing repository keeps its layout and package manager. An astack knowledge update does not need to become a product monorepo.

## Proof and tooling

Use direct protocol clients for schemas, permission boundaries and deterministic lifecycle checks. MCP Jam can inspect tools, OAuth and model use; verify the installed version's MCP 2.0 and extension support before selecting a profile. Storybook proves component states. A local bridge or webhook receiver proves wiring. None establishes ChatGPT's installed navigation, forms, context or asynchronous event actions. Run those checks in the actual supported host and keep unavailable checks skipped or inconclusive in the PR.

Record plugin identity, resource version, server revision, connection identity, host version, account/workspace access and SDK profile in .astack/project.md when they affect repeatability. Never commit credentials or signing secrets. Choose client coverage by supported behavior; don't require mobile file-handler proof for a desktop-only API.

OpenAI Developers can provide current implementation guidance when available. plugin-creator can help package and register a marketplace, but its current compatibility scaffold must be converted to root plugin.json and mcp.json before keeping it. Use OpenAI's Bits & Bolts for extension examples; generic MCP skills need a ChatGPT-specific capability and dependency check.

Sources checked 2026-09-30: [plugin architecture](https://developers.openai.com/plugins/concepts/plugins), [extensions](https://developers.openai.com/plugins/build/extensions), [UI](https://developers.openai.com/plugins/build/chatgpt-ui), [testing](https://developers.openai.com/plugins/deploy/connect-chatgpt).

## Finish the requested job

When composed as a bounded contribution, return its result to the caller if the caller owns integration, verification or PR publication; reuse completed phases and do not open a duplicate PR. For a read-only assessment, return source-grounded findings and gaps. For kept implementation changes, use [verify](../verify/SKILL.md) to consolidate the applicable observations and [pr](../pr/SKILL.md) to finish in an existing or new PR, draft when required work is blocked. Return the delivered outcome, affected boundaries, revision/environment, proof and remaining decisions. Do not merge or release without owner authority.
