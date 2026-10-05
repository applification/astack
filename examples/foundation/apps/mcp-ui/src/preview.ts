import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { HttpTransport } from '../../../scripts/http-transport';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import {
  AppBridge,
  PostMessageTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { PreviewOAuth } from './preview-oauth';
import '@foundation/ui/styles.css';

const status = document.getElementById('status');
const container = document.getElementById('app-container');
const connect = document.getElementById('connect');
const refresh = document.getElementById('refresh');
const disconnect = document.getElementById('disconnect');
if (
  !status ||
  !container ||
  !(connect instanceof HTMLButtonElement) ||
  !(refresh instanceof HTMLButtonElement) ||
  !(disconnect instanceof HTMLButtonElement)
)
  throw new Error('MCP preview controls missing.');
const endpoint: unknown = import.meta.env['VITE_MCP_URL'];
if (
  typeof endpoint !== 'string' ||
  !['127.0.0.1', 'localhost'].includes(new URL(endpoint).hostname)
)
  throw new Error(
    'Start the local backend with bun dev to preview its MCP App.',
  );
const serverUrl = new URL(endpoint);
const provider = new PreviewOAuth(
  endpoint,
  location.origin,
  sessionStorage,
  (url) => {
    location.assign(url);
  },
);
// OAuth discovery uses the real resource URL. Only local Convex traffic uses the same-origin Vite proxy.
const localFetch: typeof fetch = (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.origin === serverUrl.origin) {
    const proxy = new URL(`/__mcp${url.pathname}`, location.origin);
    return fetch(proxy, init);
  }
  return fetch(input, init);
};
let owned:
  { client: Client; bridge: AppBridge; iframe: HTMLIFrameElement } | undefined;
let busy = false;
async function close() {
  const app = owned;
  owned = undefined;
  if (!app) return;
  try {
    await app.bridge.teardownResource({}, { timeout: 2000 });
  } catch {}
  await Promise.all([app.bridge.close(), app.client.close()]);
  app.iframe.remove();
}
async function populate() {
  const app = owned;
  if (!app) return;
  const result = CallToolResultSchema.parse(
    await app.client.callTool({ name: 'work_items_list', arguments: {} }),
  );
  if (result.isError)
    throw new Error('The server could not load work items. Try reconnecting.');
  if (owned === app) await app.bridge.sendToolResult(result);
}
async function mount(code?: string) {
  await close();
  const transport = new HttpTransport(serverUrl, {
    authProvider: provider,
    fetch: localFetch,
  });
  const client = new Client({
    name: 'astack-development-preview',
    version: '1.0.0',
  });
  try {
    if (code) await transport.finishAuth(code);
    await client.connect(transport);
    const resource = await client.readResource({
      uri: 'ui://foundation/work-items.html',
    });
    const html = resource.contents[0];
    if (!html || !('text' in html))
      throw new Error('The MCP server did not return its App HTML.');
    const iframe = document.createElement('iframe');
    iframe.title = 'Work items MCP App';
    iframe.setAttribute('sandbox', 'allow-scripts');
    iframe.style.cssText = 'width:100%;height:640px;border:0';
    const bridge = new AppBridge(
      client,
      { name: 'astack-development-preview', version: '1.0.0' },
      { serverTools: {}, serverResources: {} },
      { hostContext: { theme: 'light' } },
    );
    owned = { client, bridge, iframe };
    const initialized = new Promise<void>((done, fail) => {
      bridge.addEventListener('initialized', () => {
        populate().then(done, fail);
      });
    });
    container?.appendChild(iframe);
    iframe.srcdoc = html.text;
    const view = iframe.contentWindow;
    if (!view) throw new Error('The App iframe did not open.');
    await bridge.connect(new PostMessageTransport(view, view));
    await initialized;
    if (status) status.textContent = 'Connected to local Convex through MCP.';
  } catch (error) {
    await close();
    await client.close();
    throw error;
  }
}
async function attempt(code?: string) {
  if (busy) return;
  busy = true;
  if (connect instanceof HTMLButtonElement) connect.disabled = true;
  if (status) status.textContent = 'Connecting…';
  try {
    await mount(code);
  } catch (error) {
    if (status)
      status.textContent =
        error instanceof UnauthorizedError
          ? 'Opening WorkOS to authorize this local MCP client…'
          : `Could not connect: ${error instanceof Error ? error.message : String(error)}. Check the WorkOS resource indicator and DCR settings in README.md.`;
  } finally {
    busy = false;
    if (connect instanceof HTMLButtonElement) connect.disabled = false;
    if (refresh instanceof HTMLButtonElement) refresh.disabled = !owned;
    if (disconnect instanceof HTMLButtonElement) disconnect.disabled = !owned;
  }
}
connect.addEventListener('click', () => {
  attempt().catch(console.error);
});
refresh.addEventListener('click', () => {
  populate().catch(() => {
    status.textContent = 'Refresh failed. Reconnect to sign in again.';
  });
});
disconnect.addEventListener('click', () => {
  close()
    .then(() => {
      provider.invalidateCredentials('tokens');
      status.textContent = 'Disconnected. Connect to sign in again.';
      if (refresh instanceof HTMLButtonElement) refresh.disabled = true;
      if (disconnect instanceof HTMLButtonElement) disconnect.disabled = true;
    })
    .catch(console.error);
});
window.addEventListener('pagehide', () => {
  close().catch(console.error);
});
const params = new URLSearchParams(location.search);
const code = params.get('code');
if (code || params.has('error')) {
  const valid = provider.acceptState(params.get('state'));
  history.replaceState(null, '', '/');
  if (!valid)
    status.textContent =
      'Sign-in state did not match this browser session. Connect again.';
  else if (code) attempt(code).catch(console.error);
  else
    status.textContent = 'WorkOS sign-in was cancelled. Connect to try again.';
} else if (provider.tokens()) attempt().catch(console.error);
