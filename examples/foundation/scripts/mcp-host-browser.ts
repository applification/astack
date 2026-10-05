import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { McpUiHostContext } from '@modelcontextprotocol/ext-apps';
import { McpUiHostStylesSchema } from '@modelcontextprotocol/ext-apps';
import {
  AppBridge,
  PostMessageTransport,
} from '@modelcontextprotocol/ext-apps/app-bridge';
import { HttpTransport } from './http-transport';

const statusElement = document.getElementById('status');
const containerElement = document.getElementById('app-container');
const paletteElement = document.getElementById('palette');
const remountElement = document.getElementById('remount');
const closeElement = document.getElementById('close-app');
if (
  !statusElement ||
  !containerElement ||
  !(paletteElement instanceof HTMLButtonElement) ||
  !(remountElement instanceof HTMLButtonElement) ||
  !(closeElement instanceof HTMLButtonElement)
)
  throw new Error('Host controls missing');
const status = statusElement;
const container = containerElement;
const paletteButton = paletteElement;
const remountButton = remountElement;
const closeButton = closeElement;
const controls = [paletteButton, remountButton, closeButton];
const contexts: Record<'dark' | 'light', McpUiHostContext> = {
  dark: {
    theme: 'dark',
    styles: {
      variables: McpUiHostStylesSchema.shape.variables.unwrap().parse({
        '--color-background-primary': '#131b27',
        '--color-background-secondary': '#1f2937',
        '--color-text-primary': '#f1f5f9',
        '--font-sans': '"Astack Proof Sans", sans-serif',
      }),
      css: {
        fonts:
          '@font-face { font-family: "Astack Proof Sans"; src: local("Arial"); }',
      },
    },
  },
  light: {
    theme: 'light',
    styles: {
      variables: McpUiHostStylesSchema.shape.variables.unwrap().parse({
        '--color-background-primary': '#fff4db',
        '--color-background-secondary': '#fffaf0',
        '--color-text-primary': '#35230e',
        '--font-sans': '"Astack Proof Serif", serif',
      }),
      css: {
        fonts:
          '@font-face { font-family: "Astack Proof Serif"; src: local("Times New Roman"); }',
      },
    },
  },
};
type MountedApp = {
  client: Client;
  bridge: AppBridge;
  iframe: HTMLIFrameElement;
};
let mounted: MountedApp | undefined;
let active = true;
let palette: 'dark' | 'light' = 'dark';
let resourceHtml: string | undefined;
let mounts = 0;
let acknowledgements = 0;
let closedConnections = 0;
const isCurrent = (owned: MountedApp) => active && mounted === owned;
const setBusy = (busy: boolean) => {
  for (const control of controls) control.disabled = busy;
};
const fail = (error: unknown) => {
  status.textContent = `Host operation failed: ${String(error)}`;
};
async function mount() {
  const client = new Client({
    name: 'astack-local-proof-host',
    version: '1.0.0',
  });
  const bridge = new AppBridge(
    client,
    { name: 'astack-local-proof-host', version: '1.0.0' },
    { serverTools: {}, serverResources: {}, logging: {} },
    { hostContext: contexts[palette] },
  );
  const iframe = document.createElement('iframe');
  iframe.id = 'app';
  iframe.title = 'Work items MCP App';
  iframe.setAttribute('sandbox', 'allow-scripts');
  iframe.style.cssText = 'width:100%;height:700px;border:1px solid #ddd';
  const owned = { client, bridge, iframe };
  mounted = owned;
  try {
    await client.connect(
      new HttpTransport(new URL('/mcp', window.location.href)),
    );
    const resource = await client.readResource({
      uri: 'ui://foundation/work-items.html',
    });
    const content = resource.contents[0];
    if (!content || !('text' in content))
      throw new Error('MCP UI resource has no HTML');
    if (resourceHtml !== undefined && content.text !== resourceHtml)
      throw new Error('Remounted UI resource differs from the original');
    resourceHtml = content.text;
    const initialized = new Promise<void>((resolve, reject) => {
      bridge.addEventListener('initialized', () => {
        const populate = async () => {
          if (!isCurrent(owned)) return;
          await bridge.sendToolInput({ arguments: {} });
          const result = await client.callTool({
            name: 'work_items_list',
            arguments: {},
          });
          if (!isCurrent(owned)) return;
          await bridge.sendToolResult(CallToolResultSchema.parse(result));
          mounts += 1;
          document.body.dataset.mounts = String(mounts);
          status.textContent =
            mounts === 1
              ? 'Connected to the running MCP server'
              : 'Remounted after teardown acknowledgement';
          resolve();
        };
        populate().catch(reject);
      });
    });
    container.appendChild(iframe);
    iframe.srcdoc = content.text;
    const viewWindow = iframe.contentWindow;
    if (!viewWindow) throw new Error('MCP App iframe window missing');
    await bridge.connect(new PostMessageTransport(viewWindow, viewWindow));
    await initialized;
  } catch (error) {
    if (mounted === owned) mounted = undefined;
    await Promise.all([bridge.close(), client.close()]);
    iframe.remove();
    throw error;
  }
}
async function teardown() {
  const owned = mounted;
  if (!owned) return;
  await owned.bridge.teardownResource({}, { timeout: 5_000 });
  acknowledgements += 1;
  document.body.dataset.teardownAcknowledgements = String(acknowledgements);
  mounted = undefined;
  // The acknowledged view has stopped its own work. Close our owned transports
  // before replacing the iframe, so old messages cannot reach a new bridge.
  await Promise.all([owned.bridge.close(), owned.client.close()]);
  closedConnections += 2;
  document.body.dataset.closedConnections = String(closedConnections);
  owned.iframe.remove();
}
const onPalette = () => {
  if (!mounted) return;
  palette = palette === 'dark' ? 'light' : 'dark';
  mounted.bridge.setHostContext(contexts[palette]);
  status.textContent = `Host palette updated to ${palette}`;
};
const onRemount = () => {
  setBusy(true);
  (async () => {
    await teardown();
    await mount();
  })()
    .catch(fail)
    .finally(() => {
      if (active && mounted) setBusy(false);
    });
};
const onClose = () => {
  setBusy(true);
  teardown()
    .then(() => {
      status.textContent = 'App closed after teardown acknowledgement';
    })
    .catch(fail);
};
paletteButton.addEventListener('click', onPalette);
remountButton.addEventListener('click', onRemount);
closeButton.addEventListener('click', onClose);
window.addEventListener(
  'pagehide',
  () => {
    active = false;
    paletteButton.removeEventListener('click', onPalette);
    remountButton.removeEventListener('click', onRemount);
    closeButton.removeEventListener('click', onClose);
    const owned = mounted;
    mounted = undefined;
    if (owned)
      Promise.all([owned.bridge.close(), owned.client.close()]).catch(
        console.warn,
      );
  },
  { once: true },
);
setBusy(true);
try {
  await mount();
  setBusy(false);
} catch (error) {
  fail(error);
}
