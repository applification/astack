import { eventsHandler } from './events-server';
import { createRuntime } from './runtime';
import { timingSafeEqual } from 'node:crypto';
const token = process.env.REFERENCE_MCP_TOKEN;
if (!token || token.length < 24) throw new Error('Set REFERENCE_MCP_TOKEN to a development bearer token of at least 24 characters');
const runtime = createRuntime();
const handler = eventsHandler(runtime.events);
const server = Bun.serve({ hostname: '127.0.0.1', port: Number(process.env.REFERENCE_PORT ?? 4318),
  async fetch(request) {
    const url = new URL(request.url);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || request.headers.has('origin')) return new Response('Forbidden', { status: 403 });
    if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });
    const supplied = request.headers.get('authorization') ?? '';
    const expected = `Bearer ${token}`;
    if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) return new Response('Unauthorized', { status: 401 });
    return handler.fetch(request);
  },
});
console.error(`Development MCP 2.0 endpoint: ${server.url}mcp`);
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.stop(); void handler.close().then(() => runtime.close()).then(() => process.exit(0)); });
