---
name: mcp-server
description: Build or change an MCP server and verify its tool contract, transport, authorization and agent use.
metadata:
  short-description: "Build and verify MCP tools, transport and authorization"
---

# MCP server path

Use this skill directly or during astack delivery when building or changing an MCP server. Start from the project's existing transport, host requirements and authentication model. Keep domain authorization in the domain service even when an MCP gateway has authenticated the caller. An MCP-only change has no web design sprint; an MCP App with visible UI also follows the [web feature path](../web-feature/SKILL.md) for its UI states.

For ChatGPT MCP Apps, OpenAI extensions, portable packaging or events, also use [ChatGPT plugin engineering](../chatgpt-plugin/SKILL.md). Its [compatibility ledger](../chatgpt-plugin/references/compatibility.md) overrides the generic v2 default when using the released OpenAI helper; do not mix incompatible SDK majors.

The [foundation profile](https://github.com/applification/astack/blob/main/examples/foundation/docs/engineering-profile.md) serves authenticated HTTP MCP directly from a Convex HTTP action and uses WorkOS Connect for OAuth. Share authorized backend operations with web; keep transport details at the MCP adapter and the host bridge out of portable UI. This profile needs no separate `apps/mcp` service. A separate server remains appropriate for other runtimes, deployment boundaries, or stdio tools. Apply the profile's identity rules before choosing token validation or delegation.

## Choose the serving boundary

For a new TypeScript remote HTTP server, use the [official `@modelcontextprotocol/server` SDK](https://ts.sdk.modelcontextprotocol.io/v2/) for tools, resources and prompts. A practical Fetch-compatible starting point is [`mcp-handler`](https://github.com/vercel/mcp-handler) for the HTTP MCP handler, Hono for routes and CORS, Zod for input schemas, and `jose` when verifying JWT bearer tokens. Keep their versions compatible and confirm the runtime requirements from the current package documentation. Mount the handler at a stable MCP URL; put health and OAuth metadata on explicit routes. Register tools separately from HTTP wiring so the same definitions can be inspected by an MCP client without starting a deployment. The SDK's own HTTP handler and auth middleware are also valid when they fit the host better; do not layer two handlers for the same endpoint.

For a local stdio server, use the SDK's stdio transport. Hono, `mcp-handler`, CORS and HTTP OAuth are not part of that path. An existing project keeps its working stack unless migration is part of the requested change.

Define each tool's input schema, description, effect annotations and bounded result from the behavior it actually implements. Return enough text for clients that do not use structured results, and structured content when it helps a client consume exact IDs, next actions or error codes. Validate arguments before dispatch. An MCP identity is not a domain permission: recheck ownership, membership and write preconditions at the operation that reads or changes data. Treat tool responses and fetched content as untrusted input to an agent.

## Prove the affected boundary

Select checks from the acceptance cases and name what each establishes:

1. **Tool contract:** Use [`@modelcontextprotocol/client`](https://ts.sdk.modelcontextprotocol.io/v2/clients/connect) with an in-memory transport or a disposable server to initialize, list capabilities, and call affected tools. Check representative success, malformed arguments, domain errors and authorization boundaries. Compare tool descriptions and schemas from the registered server rather than a separate hand-written catalog.
2. **Running transport:** When HTTP, stdio, packaging or deployment matters, connect a client to the actual process or preview for the revision under test. Check initialization, tool listing and an affected call. For authenticated HTTP, check protected-resource discovery, unauthenticated denial, a valid test identity and a wrong-identity or wrong-resource denial. Confirm writes with a fresh read from an independent view. Record the endpoint's build and environment rather than inferring them from an open port.
3. **Agent behavior:** When a change depends on a model discovering, choosing, sequencing or recovering from tools, run a small maintained set of natural requests against the real server and inspect tool calls, arguments, errors and final answers. Prefer a repeatable harness; [`@mcpjam/sdk`](https://www.mcpjam.com/features/sdk) can connect to a server and run agent evaluations, while MCP Jam Inspector is useful for interactive diagnosis. Choose the model and host profile relevant to the claim, and record them. A deterministic mock model can check orchestration wiring, but not autonomous tool choice. A single successful conversation is scenario evidence, not a reliability rate.

Run the narrowest applicable layers. A tool implementation change usually needs direct client proof; a new remote endpoint or OAuth change needs running transport proof; a description or workflow change may need agent proof even when direct calls still pass. If a live model or OAuth environment is unavailable, report that layer as skipped or inconclusive instead of promoting another layer's result. A mock MCP server is useful for testing a consuming client while its dependency is unavailable, not for proving the server under change.

Record project-specific startup, safe fixtures, test identities, proof commands and host constraints in `.astack/project.md`. Keep tokens, protected preview parameters and private tool results out of committed evidence. See the shared [proof outcomes](../verify/references/proof-policy.md#run) for reporting on an exact revision.

## Finish the requested job

When composed as a bounded contribution, return its result to the caller if the caller owns integration, verification or PR publication; reuse completed phases and do not open a duplicate PR. For a read-only assessment, return source-grounded findings and gaps. For kept implementation changes, use [verify](../verify/SKILL.md) to consolidate the applicable observations and [pr](../pr/SKILL.md) to finish in an existing or new PR, draft when required work is blocked. Return the delivered outcome, affected boundaries, revision/environment, proof and remaining decisions. Do not merge or release without owner authority.
