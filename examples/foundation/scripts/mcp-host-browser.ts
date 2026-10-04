import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HttpTransport } from './http-transport';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  AppBridge,
  PostMessageTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge';

const status = document.getElementById('status');
if (!status) throw new Error('Host status element missing');
try {
  const client = new Client({
    name: 'astack-local-proof-host',
    version: '1.0.0',
  });
  await client.connect(
    new HttpTransport(new URL('/mcp', window.location.href)),
  );
  const resource = await client.readResource({
    uri: 'ui://foundation/work-items.html',
  });
  const content = resource.contents[0];
  if (!content || !('text' in content))
    throw new Error('MCP UI resource has no HTML');
  const iframe = document.getElementById('app') as HTMLIFrameElement;
  const bridge = new AppBridge(
    client,
    { name: 'astack-local-proof-host', version: '1.0.0' },
    { serverTools: {}, serverResources: {}, logging: {} },
  );
  const populate = async () => {
    await bridge.sendToolInput({ arguments: {} });
    await bridge.sendToolResult(
      CallToolResultSchema.parse(
        await client.callTool({ name: 'work_items_list', arguments: {} }),
      ),
    );
    status.textContent = 'Connected to the running MCP server';
  };
  bridge.addEventListener('initialized', () => {
    populate().catch((error: unknown) => {
      status.textContent = `Tool initialization failed: ${String(error)}`;
    });
  });
  iframe.srcdoc = content.text;
  const viewWindow = iframe.contentWindow;
  if (!viewWindow) throw new Error('MCP App iframe window missing');
  await bridge.connect(new PostMessageTransport(viewWindow, viewWindow));
  window.addEventListener('pagehide', () => {
    Promise.all([bridge.close(), client.close()]).catch((error: unknown) => {
      console.warn(String(error));
    });
  });
} catch (error) {
  status.textContent = `Connection failed: ${String(error)}`;
}
