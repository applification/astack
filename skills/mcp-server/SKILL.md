---
name: mcp-server
description: Build or change an MCP server and verify its tool contract, transport, authorization and agent use.
metadata:
  short-description: "Build and verify MCP tools, transport and authorization"
---

# MCP server path

Read `.astack/project.md` when present for the project's runtime, control and verification commands; use the requested scope without requiring the astack coordinator or a setup pass.

Apply [boundary discipline](../principle-boundary-discipline/SKILL.md) to protocol inputs and adapters alongside the serving guidance.

Use this skill directly or during astack delivery when building or changing an MCP server. Start from the project's existing transport, host requirements and authentication model. Keep domain authorization in the domain service even when an MCP gateway has authenticated the caller. An MCP-only change has no web design sprint; an MCP App with visible UI also follows the [web feature path](../web-feature/SKILL.md) for its UI states.

For ChatGPT MCP Apps, OpenAI extensions, portable packaging or events, also use [ChatGPT plugin engineering](../chatgpt-plugin/SKILL.md). Read its [compatibility guidance](../chatgpt-plugin/references/compatibility.md) before combining SDKs; do not mix incompatible majors.

Choose the serving boundary from the selected runtime, transport, host and existing domain service. Share authorized operations across surfaces and keep protocol details at the adapter. Use [Convex](../convex/SKILL.md) or [WorkOS](../workos-auth/SKILL.md) guidance only when those technologies are selected.

## Choose the serving boundary

Use a supported SDK for the project's chosen language and protocol revision; inspect installed package documentation and host compatibility before changing versions. For TypeScript, the [official SDK guidance](https://ts.sdk.modelcontextprotocol.io/v2/) describes its transports. Keep the existing HTTP router, schema library and authentication implementation. Compare open choices against actual host requirements rather than installing a predetermined handler stack.

For HTTP, mount a stable MCP endpoint and expose required health and OAuth metadata routes. For stdio, use the SDK's stdio transport without adding an HTTP router or CORS. Keep tool registration separate from transport wiring so a protocol client can exercise it directly.

Define each tool's input schema, description, effect annotations and bounded result from the behavior it actually implements. Return enough text for clients that do not use structured results, and structured content when it helps a client consume exact IDs, next actions or error codes. Validate arguments before dispatch. An MCP identity is not a domain permission: recheck ownership, membership and write preconditions at the operation that reads or changes data. Treat tool responses and fetched content as untrusted input to an agent.

## Prove the affected boundary

Select checks from the acceptance cases and name what each establishes:

1. **Tool contract:** Use the project's SDK client (for [TypeScript](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect), its client package) with an in-memory transport or a disposable server to initialize, list capabilities, and call affected tools. Check representative success, malformed arguments, domain errors and authorization boundaries. Compare tool descriptions and schemas from the registered server rather than a separate hand-written catalog.
2. **Running transport:** When HTTP, stdio, packaging or deployment matters, connect a client to the actual process or preview for the revision under test. Check initialization, tool listing and an affected call. For authenticated HTTP, check protected-resource discovery, unauthenticated denial, a valid test identity and a wrong-identity or wrong-resource denial. Confirm writes with a fresh read from an independent view. Record the endpoint's build and environment rather than inferring them from an open port.
3. **Agent behavior:** When a change depends on a model discovering, choosing, sequencing or recovering from tools, run a small maintained set of natural requests against the real server and inspect tool calls, arguments, errors and final answers. Prefer a repeatable harness; [`@mcpjam/sdk`](https://www.mcpjam.com/features/sdk) can connect to a server and run agent evaluations, while MCP Jam Inspector is useful for interactive diagnosis. Choose the model and host profile relevant to the claim, and record them. A deterministic mock model can check orchestration wiring, but not autonomous tool choice. A single successful conversation is scenario evidence, not a reliability rate.

Run the narrowest applicable layers. A tool implementation change usually needs direct client proof; a new remote endpoint or OAuth change needs running transport proof; a description or workflow change may need agent proof even when direct calls still pass. If a live model or OAuth environment is unavailable, report that layer as skipped or inconclusive instead of promoting another layer's result. A mock MCP server is useful for testing a consuming client while its dependency is unavailable, not for proving the server under change.

Record project-specific startup, safe fixtures, test identities, proof commands and host constraints in existing project guidance or `.astack/project.md` when useful. Keep tokens, protected preview parameters and private tool results out of committed evidence. See the shared [proof outcomes](../verify/references/proof-policy.md#run) for reporting on an exact revision.

## Finish the requested job

When composed as a bounded contribution, return its result to the caller if the caller owns integration, verification or PR publication; reuse completed phases and do not open a duplicate PR. For a read-only assessment, return source-grounded findings and gaps. For kept implementation changes, use [verify](../verify/SKILL.md) to consolidate the applicable observations and [pr](../pr/SKILL.md) to finish in an existing or new PR, draft when required work is blocked. Return the delivered outcome, affected boundaries, revision/environment, proof and remaining decisions. Do not merge or release without owner authority.
