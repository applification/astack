import { StdioServerTransport } from '@modelcontextprotocol/server/stdio';
import { createEventsServer } from './events-server';
import { createRuntime } from './runtime';
const runtime = createRuntime();
const server = createEventsServer(runtime.events);
server.server.onclose = () => { void runtime.close(); };
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void server.close().then(() => runtime.close()).then(() => process.exit(0)); });
await server.connect(new StdioServerTransport());
