import type { Plugin } from 'vite';
import { emulateMcpToken } from './workos-emulate';

export function previewProxy(
  environment: NodeJS.ProcessEnv = process.env,
): Plugin {
  return {
    name: 'astack-local-mcp-preview',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        async function serve() {
          if (request.url === '/' || request.url?.startsWith('/?')) {
            request.url = '/preview.html' + request.url.slice(1);
            next();
            return;
          }
          if (
            !request.url?.startsWith('/__mcp/') &&
            request.url !== '/__emulate/mcp-token'
          ) {
            next();
            return;
          }
          try {
            const host = request.headers.host;
            const origin = request.headers.origin;
            if (
              !host ||
              !['localhost', '127.0.0.1'].includes(
                new URL(`http://${host}`).hostname,
              ) ||
              (origin && origin !== `http://${host}`)
            ) {
              response.writeHead(403).end('Foreign origin is not permitted');
              return;
            }
            if (request.url === '/__emulate/mcp-token') {
              const issuer = environment.ASTACK_EMULATE_URL;
              if (
                environment.ASTACK_AUTH_MODE !== 'emulate' ||
                !issuer ||
                request.method !== 'POST' ||
                request.headers['content-type'] !== 'application/json'
              ) {
                response.writeHead(404).end('No local Emulate session route');
                return;
              }
              const token = await emulateMcpToken({
                url: issuer,
                apiKey: 'sk_test_default',
              });
              response
                .writeHead(200, {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-store',
                })
                .end(JSON.stringify({ access_token: token }));
              return;
            }
            const endpoint = environment['VITE_MCP_URL'];
            if (!endpoint) {
              response
                .writeHead(503)
                .end('Start the local backend with bun dev.');
              return;
            }
            const url = new URL(endpoint);
            if (
              !['http:', 'https:'].includes(url.protocol) ||
              !['localhost', '127.0.0.1'].includes(url.hostname) ||
              url.username ||
              url.password ||
              url.pathname !== '/mcp' ||
              url.search ||
              url.hash
            )
              throw new Error('Preview requires a local Convex endpoint.');
            const path = request.url.slice('/__mcp'.length);
            if (
              ![
                '/mcp',
                '/.well-known/oauth-protected-resource/mcp',
                '/.well-known/oauth-protected-resource',
              ].includes(path) ||
              !['POST', 'GET', 'DELETE'].includes(request.method ?? '')
            ) {
              response.writeHead(404).end('Unknown local MCP route');
              return;
            }
            const chunks: Buffer[] = [];
            let bytes = 0;
            for await (const chunk of request) {
              chunks.push(
                Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)),
              );
              bytes += chunks[chunks.length - 1]?.byteLength ?? 0;
              if (bytes > 1024 * 1024)
                throw new Error('MCP preview request is too large.');
            }
            const headers = new Headers();
            for (const name of [
              'authorization',
              'content-type',
              'accept',
              'mcp-protocol-version',
              'mcp-session-id',
              'last-event-id',
            ]) {
              const value = request.headers[name];
              if (typeof value === 'string') headers.set(name, value);
            }
            const upstream = await fetch(new URL(path, url.origin), {
              method: request.method ?? 'GET',
              headers,
              ...(request.method === 'POST'
                ? { body: Buffer.concat(chunks) }
                : {}),
            });
            const forwarded = new Headers(upstream.headers);
            for (const name of [
              'content-length',
              'content-encoding',
              'transfer-encoding',
              'connection',
            ])
              forwarded.delete(name);
            response.writeHead(upstream.status, Object.fromEntries(forwarded));
            // The reference is stateless JSON transport, not an unbounded SSE stream.
            response.end(Buffer.from(await upstream.arrayBuffer()));
          } catch {
            response
              .writeHead(502)
              .end('Local MCP proxy failed. Check that bun dev is running.');
          }
        }
        serve().catch(() => {
          response.end('MCP preview request failed.');
        });
      });
    },
  };
}
