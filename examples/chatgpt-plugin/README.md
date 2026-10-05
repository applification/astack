# astack ChatGPT plugin reference

A neutral TypeScript fixture for shared React UI, the released OpenAI extensions helper, and a separate MCP 2.0 forms/events server. No Loami behavior is included. This is a development example, not a production service or a claim of installed ChatGPT compatibility.

## Run and inspect

Requires Node 22+ and Bun 1.4.0+. From this directory:

```sh
bun install --frozen-lockfile
bun run build
bun run typecheck
bun test
bun run storybook
```

Storybook at http://localhost:6006 shows the same RecordList component used by the MCP App, including normal, selected, empty and error states. `bun run build:storybook` builds it. It validates presentation independently of the host bridge.

To check actual browser rendering and selection in both development and the built Storybook:

```sh
bunx --no-install playwright install chromium
bun run verify:storybook dev
bun run verify:storybook built
```

Each check owns a server on a free loopback port and a Chromium browser, checks all four stories and selection updates, then stops both. Reports, screenshots and terminal logs stay in `.proof/storybook/`. Linux may also need `playwright install-deps chromium`. The Storybook configuration explicitly prebundles React's CommonJS roots for the development browser; a successful static build alone does not check this path. Restart an existing Storybook session after changing `.storybook/main.ts`.

The build produces `dist/plugin/` with portable root `plugin.json`, `mcp.json`, a setup skill, self-contained Node server scripts, inline UI HTML and dependency license notices. Copy that entire folder to prove relocation. It needs Node at runtime, without the source tree, Bun or node_modules. Persistent data belongs in `${PLUGIN_DATA}`, not in the package. Root validation is `bun run check`; `bun scripts/check-plugins.ts examples/chatgpt-plugin/dist/plugin` also validates the built artifact.

## Two explicit SDK profiles

| Profile | Demonstrates | Boundary |
| --- | --- | --- |
| reference-ui | @openai/mcp-extensions 0.1.0 + MCP SDK 1.31.0 + ext-apps 1.7.5; global/sidebar and thread entrypoints, settings, mentions, file entrypoint, built MCP App HTML, validated deep links and optional host messaging/context | Released helper uses the v1 SDK. These tools are exercised by a legacy client; registered ChatGPT MCP 2.0 compatibility is unverified. |
| reference-events | Split MCP server/client/core 2.2.0; protocol 2026-07-28, MRTR enum elicitation/cancellation, events/list, subscribe and unsubscribe, signed callbacks | No OpenAI UI helper is attached to this server. Rich registered-server OpenAI form thumbnails remain guidance, not implemented fixture behavior. |

The profiles share record schemas, not SDK instances or transport state. The released helper's `elicitInput` sends `openai/elicitation/create`; it is not the MRTR mechanism required by the registered-server documentation. Do not suppress peer checks or cast the v1 helper onto a v2 server. The compatibility ledger in [astack guidance](../../skills/chatgpt-plugin/references/compatibility.md) records this boundary.

Dependency versions are locked. `bunfig.toml` keeps a seven-day minimum package age with explicit exceptions for these newly released OpenAI/MCP SDKs; ordinary dependencies satisfy the age rule.

## Install locally in Codex

1. Build the fixture.
2. Add a local marketplace entry in this repository's `.agents/plugins/marketplace.json`, with a new stable name and `source.path: "./examples/chatgpt-plugin/dist/plugin"`. Use the existing entry's policy fields. The path resolves from the repository root.
3. Register the source with `codex plugin marketplace add /absolute/path/to/astack`, then `codex plugin add astack-reference@applification`. Check the installed CLI's `codex plugin --help` and list output for its supported commands. Alternatively use the desktop Plugins Directory and the local marketplace source.
4. Review the two bundled stdio servers. Install, restart the desktop and start a new chat. The setup skill explains what each profile proves. Ask to open the neutral reference records and inspect discovered tools before using them.
5. Rebuild and refresh/reinstall after changes: source edits alone do not update the installed cache. Never edit cache files.

The reference is deliberately absent from astack's shipped marketplace. Enabling a test fixture should be explicit. astack's own plugin remains skills-only with an empty root mcp.json. For just astack, follow [project installation](../../docs/project-install.md).

## Connect the modern endpoint to ChatGPT

For a private development endpoint:

```sh
# Set a private development token in your environment; do not commit it.
bun run events:http
```

`REFERENCE_MCP_TOKEN` must contain at least 24 characters. The server binds to 127.0.0.1:4318/mcp, requires that bearer token, rejects browser Origins and validates the URL host. `REFERENCE_PORT` and `REFERENCE_DATA` can override development values. This token protects a fixed `reference-user` persona; it is not production OAuth or account authorization.

In a permitted ChatGPT account, enable Developer mode under Settings > Security and login. Connect through Secure MCP Tunnel or an authenticated HTTPS development endpoint. A Work web connection cannot directly reach localhost. Use the current tunnel-client quickstart/init/doctor/run instructions with a real tunnel ID and runtime key associated with the intended Platform organization and ChatGPT workspace. Keep the tunnel running and credentials out of source control. Tunnel authentication and MCP account authentication are separate concerns.

Rescan the registered connection and confirm `server/discover` reports protocol `2026-07-28`, tools and events. Ask ChatGPT to choose a reference record, accept and cancel the form, then explicitly ask it to monitor `record.updated` for `alpha` and state what it should do. Call `records.emit` for alpha and beta to verify matching and filtering; stop monitoring to exercise unsubscribe. Compare actual ChatGPT response with mere webhook receipt: HTTP 2xx does not establish that the requested agent action occurred.

For a combined registered plugin, copy the real `plugin_asdk_app` technical ID into an `.app.json` mapping referenced under `plugin.json`'s `extensions.com.openai.apps`. Generate/validate that mapping against current tooling; this fixture contains no invented connection ID. `mcp.json` declares bundled servers and is not the registered mapping. Avoid duplicate server connections. Refresh server discovery and refresh the installed package separately, then start a fresh chat.

## Event and resource behavior

Subscriptions, filters, owner, expiry, signing keys and pending jobs persist to an atomic private JSON file. A lock enforces one owning server process; the delivery loop runs inside that process. After a clean restart it resumes due work. After a crash, the server fails on a stale lock: stop all fixture processes, verify the PID in the `.lock` file is gone, then remove that lock manually. Automatic stale recovery could admit two owners. Use a transactional database and leases for production concurrency; do not share this file across services or run an external delivery process. Only the explicit development persona can access alpha/beta.

Callbacks require HTTPS, connection-time public DNS validation, pinned validated addresses, original TLS hostname verification, no redirects, a ten-second timeout and bounded response size. Verification uses signed single-use challenges, constant-time echoes, a bounded five-minute cache scoped by principal/URL/key, and categorized -32015 errors. Deliveries have stable IDs and exact signed bytes, refreshed timestamps on retry, finite exponential retries, no retry on 410/413 and a short dual-key rotation window. Secrets stay in the private state file and are never printed. Missed source events are not replayed (`cursor: null`).

File UI uses the host-supplied opaque resource URI and negotiated optional resources bridge. Notifications preserve dirty drafts. Conditional writes use ETags and expose conflicts/size errors. Explicit reload can discard a draft; asynchronous responses from an old URI are ignored. Real host permissions, ETags and notifications require installed-host proof.

## Proof limits

Automated checks cover real legacy and MCP 2.0 clients, raw HTTP requests, relocation, subscription persistence, signatures, retries, callback errors and adapter regressions. MCP Jam is useful for additional MCP Apps inspection; neither it nor Storybook establishes installed ChatGPT UI, skill activation, OAuth, mobile support, agent selection or event-triggered actions. See [tracked evidence](../../.astack/chatgpt-plugin/evidence.md) for actual results and outstanding host checks.

Sources: [extensions](https://developers.openai.com/plugins/build/extensions), [TypeScript helper](https://github.com/openai/mcp-extensions/blob/main/typescript/README.md), [MCP UI](https://developers.openai.com/plugins/build/chatgpt-ui), [MCP Events](https://developers.openai.com/plugins/build/mcp-events), [packaging](https://developers.openai.com/plugins/build/plugins), [connect/test](https://developers.openai.com/plugins/deploy/connect-chatgpt), [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). Checked 2026-09-30.
