import { freePort, type Runtime } from './runtime';

// Emulate's Node HTTP adapter installs a lightweight global Response. Bun.serve
// requires its native Response; retain that constructor before starting Emulate.
const HostResponse = globalThis.Response;

/** Local Apps SDK host: its tool/resource traffic reaches the actual Convex MCP endpoint. */
export async function startMcpHost(
  runtime: Runtime,
): Promise<{ url: string; stop(): Promise<void> }> {
  const entrypoint = new URL('./mcp-host-browser.ts', import.meta.url).pathname;
  const build = await Bun.build({
    entrypoints: [entrypoint],
    target: 'browser',
    format: 'esm',
    minify: false,
  });
  if (!build.success)
    throw new Error(
      `MCP host build failed: ${build.logs.map((log) => log.message).join('\n')}`,
    );
  const bundle = build.outputs[0];
  if (!bundle) throw new Error('MCP host build produced no bundle');
  const javascript = await bundle.text();
  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',
    async fetch(request) {
      const url = new URL(request.url);
      if (
        url.origin !== origin ||
        (request.headers.has('origin') &&
          request.headers.get('origin') !== origin)
      )
        return new HostResponse('Foreign origin is not allowed', {
          status: 403,
        });
      const path = url.pathname;
      if (path === '/host.js')
        return new HostResponse(javascript, {
          headers: { 'content-type': 'text/javascript' },
        });
      if (path === '/mcp') {
        const headers = new Headers(request.headers);
        headers.delete('host');
        // This trusted local fixture is a server-side MCP client proxy. Browser origin is
        // checked by the fixture's own same-origin routing, not forwarded as MCP origin.
        headers.delete('origin');
        headers.delete('referer');
        headers.set('authorization', `Bearer ${runtime.tokens.mcp}`);
        const upstream = await fetch(runtime.mcpUrl, {
          method: request.method,
          headers,
          ...(['GET', 'HEAD'].includes(request.method)
            ? {}
            : { body: await request.arrayBuffer() }),
        });
        return new HostResponse(upstream.body, {
          status: upstream.status,
          headers: upstream.headers,
        });
      }
      if (path === '/')
        return new HostResponse(
          '<!doctype html><html><head><meta charset="utf-8"><title>Local MCP App host</title></head><body><h1>Local MCP App host</h1><p id="status" role="status">Connecting</p><button id="palette" disabled>Update host palette</button><button id="remount" disabled>Teardown and remount</button><button id="close-app" disabled>Close App</button><div id="app-container"></div><script type="module" src="/host.js"></script></body></html>',
          { headers: { 'content-type': 'text/html' } },
        );
      return new HostResponse('Not found', { status: 404 });
    },
  });
  return {
    url: origin,
    stop: async () => {
      await server.stop(true);
    },
  };
}
