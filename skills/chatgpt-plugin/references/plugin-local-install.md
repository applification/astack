# Portable packaging and local installation

Use root plugin.json and mcp.json with the Agent Plugins 1.0.0 schemas. Discover skills under skills/ and put OpenAI interface, registered connection mappings and onboarding under extensions.com.openai. Do not introduce .codex-plugin/plugin.json or .mcp.json as the maintained format. Existing compatibility packages may be inspected during a requested migration; convert fields and transport declarations, not just filenames.

astack's own mcp.json is empty because it distributes guidance rather than a runtime server. Application plugins declare each bundled server's type: stdio or streamable-http. Keep scripts and assets inside the package. Use ${PLUGIN_ROOT} for packaged paths and ${PLUGIN_DATA} for writable persistent state. Prove a built package copied out of the source checkout; no hidden node_modules or ../development imports may be required. Keep user credentials in runtime configuration, not the package.

## Local Codex package

Create or update .agents/plugins/marketplace.json at the repo root. A local source.path such as ./plugins/my-plugin resolves from that root, not from .agents/plugins/. Add policy.installation, policy.authentication and category. Keep plugin and marketplace names stable because they form the enabled identity.

Register with codex plugin marketplace add /absolute/path/to/repo and install with codex plugin add my-plugin@marketplace-name where that command is supported. Confirm effective installation with the installed CLI's help/list output. In desktop open Plugins Directory, select the local source and install. Project .codex/config.toml can enable the quoted plugin@marketplace identity in trusted projects. Installation copies into a cache; editing the source is not proof that the installed copy updated. Refresh/reinstall as supported, restart desktop and begin a new chat. Never edit cache files.

## ChatGPT connection and complete package

A local plugin folder does not make localhost reachable from Work web. Start the actual server, connect it through Secure MCP Tunnel or an HTTPS development endpoint, and enable Settings > Security and login > Developer mode when the account/workspace permits it. In ChatGPT Plugins create a connection, review discovered tools/events/resources and test the server before packaging the combined experience.

For a registered connection, copy its actual plugin_asdk_app technical ID and map it through .app.json referenced by extensions.com.openai.apps. Inspect the current registered-mapping schema or plugin-creator output; don't invent IDs or reuse another person's connection. The portable mcp.json configures bundled servers; .app.json maps an already registered OpenAI connection. Avoid enabling both as duplicate servers.

For Secure MCP Tunnel obtain a real tunnel ID and runtime key, associate the target Platform organization and ChatGPT workspace, then use tunnel-client help quickstart, init with the private HTTP URL or stdio command, doctor --explain and run. Select that tunnel under Connection. Keep it alive during testing. Tunnel transport and MCP application authentication are separate; OAuth's browser-facing authorization server must also be reachable. Do not commit runtime keys. Public submission still requires a stable public HTTPS endpoint.

After server metadata changes, restart/deploy, refresh the connection, confirm new metadata and start a fresh chat. After package/skill changes, refresh the local installed package and restart the client. Record these as separate operations.

## Validate

Validate both portable schemas and extension paths/assets, ensure no fallback manifests remain, inspect a relocated build and prove stdio or HTTP tools. Then test skill activation and the installed UI/events in the real host. A valid manifest doesn't prove the client loaded the package.

Sources checked 2026-09-30: [packaging](https://developers.openai.com/plugins/build/plugins), [connection testing](https://developers.openai.com/plugins/deploy/connect-chatgpt), [Secure MCP Tunnel](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels).
