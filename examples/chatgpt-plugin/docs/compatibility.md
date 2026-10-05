# OpenAI compatibility ledger

Checked 2026-09-30. This ledger records dependency constraints and evidence, not permanent latest-version claims. Recheck official guidance and published package metadata when building or upgrading. Keep existing working projects on their chosen profile unless migration is requested.

| Profile | Dependencies | Claims to verify |
| --- | --- | --- |
| OpenAI extension helper | @openai/mcp-extensions 0.1.0, @modelcontextprotocol/sdk 1.x matching ^1.29.0, ext-apps 1.x matching ^1.7.5 | Tool/resource registration, settings, mentions, App initialization, optional host APIs |
| MCP 2.0 | Split @modelcontextprotocol/server/client 2.x; choose compatible runtime adapters | server/discover, 2026-07-28 requests, MRTR, events on authenticated endpoint |
| MCP Apps v2 | ext-apps 2.x and its split SDK peers | Standard UI bridge; do not pass it into the released OpenAI helper as if it met the helper's peers |

The released OpenAI package requires Node >=22. Bun remains astack's package manager; prove runtime compatibility or run the packaged server under Node. SDK/package major 2 does not mean the UI bridge protocol version is 2026-07-28.

The OpenAI server helper currently uses the v1 McpServer API. Its elicitInput implementation sends legacy openai/elicitation/create; the README explicitly excludes MRTR. Registered OpenAI forms and ChatGPT Events require 2026-07-28. Do not solve the mismatch by suppressing peer errors, casting server types or transplanting helper objects into a v2 server. Use a separately verified adapter or implement only the required extension wire contract on v2, and prove it in ChatGPT before claiming combined support.

The reference example keeps a released-helper UI profile and an isolated v2 forms/events profile. Its checked-in lockfile pins both. See the example README and .astack/chatgpt-plugin/evidence.md for results. A local client round trip doesn't establish registered ChatGPT MRTR support. Missing live host proof stays visible.

Other launch differences: the spec requires dotted file extensions even where short docs examples omit the dot; the spec excludes pip although the UI guide and SDK schema mention it; the SDK has settings entrypoints/quick actions beyond the spec's main entrypoint list. Treat the actual host as the final integration check, never infer availability just because a type compiles.

For new work fetch the exact official page and the chosen SDK's peer metadata before choosing dependencies. Record resolved versions, protocol, runtime, source date, target host/account, observed checks and remaining gaps. Never tell an agent to blindly install every package at latest.

Sources: [published SDK source metadata](https://github.com/openai/mcp-extensions/blob/main/typescript/package.json), [extension README](https://github.com/openai/mcp-extensions/blob/main/typescript/README.md), [spec](https://github.com/openai/mcp-extensions/blob/main/docs/spec.md), [MCP SDK v2](https://ts.sdk.modelcontextprotocol.io/v2/), [MRTR](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr), [events](https://developers.openai.com/plugins/build/mcp-events).
