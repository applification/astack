# Select an SDK profile

Before choosing dependencies inspect the installed versions, published peer requirements and official protocol/host guidance. Record SDK packages, runtime, MCP protocol revision and bridge API separately; a package major version does not prove protocol or host support. Preserve a working project's chosen profile unless migration is requested.

The OpenAI extension helper, MCP Apps bridge and split MCP server/client SDK can have different peer constraints. Do not suppress peer errors, cast a v1 helper into a v2 server or assume an elicitation helper implements MRTR. Choose a compatible profile for the requested capabilities, or a separately verified adapter implementing the required wire contract. Keep isolated experiments separate until combined behavior has been observed.

Fetch the exact chosen SDK's package metadata and source for registration, auth, initialization and teardown. Use Bun as the package manager for new Applification projects; run a packaged server under a supported Node runtime when required. Prove runtime compatibility rather than treating Bun installation as that proof.

Record resolved versions, protocol, runtime, source date, target host/account and observed checks in the project profile. Verify forms/events/extensions in the actual target host; local round trips and compiling types establish only those checks. Feature-detect optional host APIs and retain unavailable coverage as a gap.

Primary sources: [SDK peers](https://github.com/openai/mcp-extensions/blob/main/typescript/package.json), [SDK README](https://github.com/openai/mcp-extensions/blob/main/typescript/README.md), [extension spec](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md), [MCP SDK](https://ts.sdk.modelcontextprotocol.io/v2/), [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr).
