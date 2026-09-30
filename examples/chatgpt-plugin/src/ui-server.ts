import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { OpenAIExtensions } from '@openai/mcp-extensions/server';
import { readFileSync } from 'node:fs';
import { FileStore } from './store';
import { z } from 'zod';
import { records, recordId, readRecord } from './records';
export const UI_URI = 'ui://astack-reference/records/v1.html';
export function createUiServer(html: string, preferences?: FileStore<{ compact: boolean }>) {
  let memory = { compact: false };
  const server = new McpServer({ name: 'astack-reference-ui', version: '0.1.0' });
  const extensions = new OpenAIExtensions(server);
  registerAppResource(server, 'records-ui', UI_URI, {}, async () => ({ contents: [{ uri: UI_URI,
    mimeType: RESOURCE_MIME_TYPE, text: html, _meta: { ui: { csp: { connectDomains: [], resourceDomains: [] } },
      'openai/ui': { availableDisplayModes: ['inline', 'fullscreen'], preferredDisplayMode: 'fullscreen' } } }] }));
  const tool = { title: 'Reference records', description: 'Open the reference records library.', inputSchema: {},
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: UI_URI, visibility: ['app'] as ('app' | 'model')[] },
      'openai/ui': { entrypoints: [{ type: 'global' as const }, { type: 'thread' as const }] } } };
  registerAppTool(server, 'records.open', tool, async () => ({ content: [{ type: 'text', text: 'Two reference records.' }], structuredContent: { records } }));
  registerAppTool(server, 'records.file', { title: 'Reference text editor', description: 'View a reference text file.',
    inputSchema: { file: z.object({ name: z.string(), resourceUri: z.string() }) },
    annotations: { readOnlyHint: true }, _meta: { ui: { resourceUri: UI_URI, visibility: ['app'] },
      'openai/ui': { entrypoints: [{ type: 'file', extensions: ['.txt'] }] } } }, async () => ({ content: [] }));
  server.registerTool('records.list', { description: 'List the two neutral reference records.', inputSchema: {}, annotations: { readOnlyHint: true, openWorldHint: false } }, async () => ({ content: [{ type: 'text', text: records.map(item => `${item.id}: ${item.title}`).join('\n') }], structuredContent: { records } }));
  server.registerTool('records.read', { description: 'Read a reference record by its exact ID.', inputSchema: { id: recordId }, annotations: { readOnlyHint: true } }, async ({ id }) => ({ content: [{ type: 'text', text: readRecord(id).summary }], structuredContent: { record: readRecord(id) } }));
  extensions.mentions.setHandler(async ({ query }) => ({ items: records.filter(item => `${item.title} ${item.id}`.toLowerCase().includes(query.toLowerCase())).map(item => ({ type: 'resource_link', uri: `reference://records/${item.id}`, name: item.title, description: item.summary, mimeType: 'text/plain' })) }));
  for (const item of records) server.registerResource(item.id, `reference://records/${item.id}`, {}, async () => ({ contents: [{ uri: `reference://records/${item.id}`, mimeType: 'text/plain', text: item.summary }] }));
  extensions.settings.register({ fields: { compact: { schema: z.boolean(), title: 'Compact view' } },
    read: async () => preferences?.read() ?? memory, update: async set => {
      if (preferences) { preferences.update(value => Object.assign(value, set)); return preferences.read(); }
      memory = { ...memory, ...set }; return memory;
    } });
  return server;
}
export const builtHtml = () => readFileSync(new URL('../dist/records.html', import.meta.url), 'utf8');
