import { McpServer, createMcpHandler, inputRequired, inputResponse, acceptedContent } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { Events, SubscribeSchema, UnsubscribeSchema } from './events';
import { recordId, readRecord } from './records';
export function createEventsServer(events: Events, owner = 'reference-user') {
  const server = new McpServer({ name: 'astack-reference-events', version: '0.1.0' });
  const capabilities = { tools: {}, events: {} };
  server.server.registerCapabilities(capabilities);
  // Draft event methods aren't built into the SDK; register their explicit schemas.
  server.server.setRequestHandler('events/list', { params: z.object({}).strict(), result: z.object({ events: z.array(z.unknown()) }) }, async () => events.list(owner));
  server.server.setRequestHandler('events/subscribe', { params: SubscribeSchema, result: z.object({ id: z.string(), refreshBefore: z.string(), cursor: z.null(), truncated: z.boolean() }) }, async params => events.subscribe(owner, params));
  server.server.setRequestHandler('events/unsubscribe', { params: UnsubscribeSchema, result: z.object({}) }, async params => events.unsubscribe(owner, params));
  server.registerTool('records.choose', { description: 'Ask the user to select a neutral reference record. This is a read-only MRTR fixture.', inputSchema: z.object({}), annotations: { readOnlyHint: true } }, async (_args, ctx) => {
    const response = inputResponse(ctx.mcpReq.inputResponses, 'record');
    if (response.kind === 'elicit' && response.action !== 'accept') return { content: [{ type: 'text', text: 'Selection cancelled.' }] };
    const selection = acceptedContent(ctx.mcpReq.inputResponses, 'record', z.object({ record_id: recordId }).strict());
    if (!selection && ctx.mcpReq.inputResponses?.record !== undefined) return { isError: true, content: [{ type: 'text', text: 'Invalid record selection.' }] };
    if (!selection) return inputRequired({ inputRequests: { record: inputRequired.elicit({ message: 'Choose a reference record', requestedSchema: z.object({ record_id: recordId }) }) } });
    return { content: [{ type: 'text', text: readRecord(selection.record_id).title }], structuredContent: { record: readRecord(selection.record_id) } };
  });
  server.registerTool('records.emit', { description: 'Queue a synthetic update to an existing user-authorized subscription. Development fixture only.', inputSchema: z.object({ record_id: recordId, summary: z.string().min(1).max(4000) }), annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } }, async args => ({ content: [{ type: 'text', text: 'Synthetic event queued.' }], structuredContent: { eventId: events.emit(owner, args.record_id, args.summary) } }));
  return server;
}
export const eventsHandler = (events: Events) => createMcpHandler(() => createEventsServer(events));
