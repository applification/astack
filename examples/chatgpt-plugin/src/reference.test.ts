import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, cpSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport as LegacyStdio } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { InMemoryTransport as LegacyTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { acquireOwner } from './owner';
import { Webhook } from 'standardwebhooks';
import { z } from 'zod';
import { createUiServer, UI_URI, builtHtml } from './ui-server';
import { Events, freshState } from './events';
import { createEventsServer, eventsHandler } from './events-server';
import { FileStore } from './store';
import { isPublicAddress, sendCallback, type CallbackSender } from './webhook';
import { FileDraft } from './ui/file-draft';
import { recordFromRoute, HostSelection } from './ui/navigation';
let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'astack-reference-')); });
afterEach(() => rmSync(directory, { recursive: true, force: true }));
const secret = () => 'whsec_' + randomBytes(32).toString('base64');
const input = (key: string, id = 'alpha', url = 'https://callback.example/events') => ({ name: 'record.updated', arguments: { record_id: id }, delivery: { mode: 'webhook', url, secret: key } });
const receiver: CallbackSender = async (_url, body) => { const event = JSON.parse(body); return { status: 200, body: JSON.stringify({ challenge: event.challenge }) }; };
const store = () => new FileStore(join(directory, 'events.json'), freshState());
test('released OpenAI helper registers launch, resources, settings and mentions through a real client', async () => {
  const server = createUiServer(builtHtml());
  const client = new LegacyClient({ name: 'proof', version: '1' });
  const [a, b] = LegacyTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try {
    const listed = await client.listTools();
    const launch = listed.tools.find(tool => tool.name === 'records.open')!;
    expect(launch._meta?.ui).toMatchObject({ resourceUri: UI_URI });
    expect(launch._meta?.['openai/ui']).toMatchObject({ entrypoints: [{ type: 'global' }, { type: 'thread' }] });
    const opened = await client.callTool({ name: 'records.open', arguments: {} });
    expect(opened.structuredContent).toHaveProperty('records');
    const html = await client.readResource({ uri: UI_URI });
    expect(html.contents[0]).toMatchObject({ mimeType: 'text/html;profile=mcp-app' });
    expect('text' in html.contents[0] && html.contents[0].text).toContain('<script type="module">');
    const settings = client.getServerCapabilities()?.extensions?.['openai/settings'] as { readTool: string; updateTool: string };
    expect(settings).toBeDefined();
    await client.callTool({ name: settings.updateTool, arguments: { set: { compact: true } } });
    expect((await client.callTool({ name: settings.readTool, arguments: {} })).structuredContent).toMatchObject({ values: { compact: true } });
    const mentions = listed.tools.find(tool => (tool._meta?.['openai/extensions'] as Record<string, unknown>)?.['mentions/search'])!;
    expect(mentions).toBeDefined();
    const found = await client.callTool({ name: mentions.name, arguments: { query: '' } });
    expect(found.structuredContent).toMatchObject({ items: [{ uri: 'reference://records/alpha' }, { uri: 'reference://records/beta' }] });
    const invalid = await client.callTool({ name: 'records.read', arguments: { id: 'missing' } });
    expect(invalid.isError).toBe(true);
  } finally { await client.close(); await server.close(); }
});
test('MRTR 2026-07-28 completes selection and cancellation using a real v2 client', async () => {
  const server = createEventsServer(new Events(store(), receiver));
  let action: 'accept' | 'cancel' = 'accept';
  const client = new Client({ name: 'proof-v2', version: '1' }, { capabilities: { elicitation: { form: {} } } });
  client.setRequestHandler('elicitation/create', async () => ({ action, ...(action === 'accept' ? { content: { record_id: 'beta' } } : {}) }));
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b); await client.connect(a);
  try {
    const selected = await client.callTool({ name: 'records.choose', arguments: {} });
    expect(selected.structuredContent).toMatchObject({ record: { id: 'beta' } });
    action = 'cancel';
    const cancelled = await client.callTool({ name: 'records.choose', arguments: {} });
    expect(cancelled.content).toEqual([{ type: 'text', text: 'Selection cancelled.' }]);
    const events = await client.request({ method: 'events/list', params: {} }, z.object({ events: z.array(z.unknown()) }));
    expect(events.events).toHaveLength(1);
  } finally { await client.close(); await server.close(); }
});
test('modern HTTP wire exposes discovery and returns input_required before retry', async () => {
  const handler = eventsHandler(new Events(store(), receiver));
  const call = async (method: string, params: object = {}) => {
    const response = await handler.fetch(new Request('http://localhost/mcp', { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': method, ...('name' in params ? { 'Mcp-Name': String(params.name) } : {}) }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: { ...params, _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientInfo': { name: 'raw-proof', version: '1' }, 'io.modelcontextprotocol/clientCapabilities': { elicitation: { form: {} } } } } }) }));
    return response.json() as Promise<any>;
  };
  try {
    const discovery = await call('server/discover');
    expect(discovery.result.supportedVersions).toContain('2026-07-28');
    expect(discovery.result.capabilities.events).toEqual({});
    const first = await call('tools/call', { name: 'records.choose', arguments: {} });
    expect(first.result.resultType).toBe('input_required');
    expect(first.result.inputRequests.record.method).toBe('elicitation/create');
    const next = await call('tools/call', { name: 'records.choose', arguments: {}, inputResponses: { record: { action: 'accept', content: { record_id: 'alpha' } } } });
    expect(next.result.structuredContent.record.id).toBe('alpha');
    const callbackFailure = await call('events/subscribe', input(secret()));
    expect(callbackFailure.result?.id).toStartWith('sub_');
    const invalid = await call('tools/call', { name: 'records.choose', arguments: {}, inputResponses: { record: { action: 'accept', content: { record_id: 'unknown' } } } });
    expect(invalid.error ?? invalid.result.isError).toBeTruthy();
  } finally { await handler.close(); }
});
test('subscriptions persist, refresh one identity, filter delivery and unsubscribe queued work', async () => {
  const key = secret(); const state = store(); const events = new Events(state, receiver);
  const one = await events.subscribe('reference-user', input(key));
  const two = await events.subscribe('reference-user', input(key));
  expect(one.id).toBe(two.id);
  expect(Object.keys(state.read().subscriptions)).toHaveLength(1);
  const restarted = new Events(store(), receiver);
  expect(restarted.emit('reference-user', 'beta', 'Nonmatching')).toStartWith('evt_');
  expect(store().read().jobs).toHaveLength(0);
  restarted.emit('reference-user', 'alpha', 'Matching');
  expect(store().read().jobs).toHaveLength(1);
  restarted.unsubscribe('reference-user', { name: 'record.updated', arguments: { record_id: 'alpha' }, delivery: { mode: 'webhook', url: input(key).delivery.url } });
  expect(store().read().jobs).toHaveLength(0);
  expect(await restarted.deliver()).toEqual([]);
  expect(() => events.list('outsider')).toThrow('Forbidden');
});
test('signatures verify exact bytes; retries retain IDs and rotate keys', async () => {
  let now = Date.now(); const old = secret(); const next = secret(); let attempts = 0; let verifications = 0; const deliveries: any[] = [];
  const receive: CallbackSender = async (_url, body, headers) => {
    const event = JSON.parse(body);
    if (event.type === 'verification') { new Webhook(verifications++ === 0 ? old : next).verify(body, headers); return receiver(_url, body, headers); }
    deliveries.push({ event, headers, body });
    new Webhook(next).verify(body, headers);
    new Webhook(old).verify(body, headers);
    return { status: ++attempts === 1 ? 503 : 200, body: '{}' };
  };
  const events = new Events(store(), receive, () => now);
  await events.subscribe('reference-user', input(old));
  await events.subscribe('reference-user', input(next));
  events.emit('reference-user', 'alpha', 'Updated');
  expect((await events.deliver())[0].outcome).toBe('retry');
  now += 1000;
  expect((await events.deliver())[0].outcome).toBe('accepted');
  expect(deliveries[0].event.eventId).toBe(deliveries[1].event.eventId);
  expect(deliveries[0].headers['webhook-timestamp']).not.toBe(deliveries[1].headers['webhook-timestamp']);
  expect(store().read().jobs).toHaveLength(0);
});
test('challenge failure, expiry, terminal statuses and callback addresses are bounded', async () => {
  const key = secret();
  const events = new Events(store(), async () => ({ status: 200, body: '{"challenge":"wrong"}' }));
  await expect(events.subscribe('reference-user', input(key))).rejects.toThrow('challenge');
  expect(Object.keys(store().read().subscriptions)).toHaveLength(0);
  await expect(events.subscribe('reference-user', input('whsec_YQ=='))).rejects.toThrow('length');
  let now = Date.now(); const expiry = new Events(store(), receiver, () => now);
  await expiry.subscribe('reference-user', { ...input(key), ttlMs: 1000 });
  expiry.emit('reference-user', 'alpha', 'Before expiry'); now += 1001;
  expect((await expiry.deliver())[0].outcome).toBe('expired');
  for (const status of [410, 413]) {
    const terminal = new Events(store(), async (url, body, headers) => JSON.parse(body).type === 'verification' ? receiver(url, body, headers) : { status, body: '{}' });
    await terminal.subscribe('reference-user', input(key)); terminal.emit('reference-user', 'alpha', 'Terminal');
    expect((await terminal.deliver())[0].outcome).toBe('failed'); expect(store().read().jobs).toHaveLength(0);
  }
  for (const address of ['127.0.0.1', '10.0.0.1', '169.254.1.1', '::1', '::ffff:127.0.0.1', 'fc00::1', '224.0.0.1']) expect(isPublicAddress(address)).toBe(false);
  expect(isPublicAddress('8.8.8.8')).toBe(true);
  await expect(sendCallback('https://127.0.0.1/events', '{}', {})).rejects.toThrow('non-public');
  await expect(sendCallback('http://example.com/events', '{}', {})).rejects.toThrow('HTTPS');
});
test('deep links accept only known application routes', () => {
  expect(recordFromRoute('/records/beta?view=compact')).toBe('beta');
  expect(recordFromRoute('/')).toBeUndefined();
  for (const route of ['//external.example', '/records/unknown', '/records/alpha#fragment', 'https://external.example']) expect(() => recordFromRoute(route)).toThrow();
});

test('two runtime owners cannot overwrite the file fixture', () => {
  const path = join(directory, 'events.json');
  const release = acquireOwner(path);
  expect(() => acquireOwner(path)).toThrow('owning process');
  release();
  const restarted = acquireOwner(path); restarted();
});

test('callback failure is a categorized protocol error on the HTTP wire', async () => {
  for (const [reason, send] of [
    ['challenge_failed', async () => ({ status: 200, body: '{"challenge":"wrong"}' })],
    ['timeout', async () => { throw new Error('Callback timed out'); }],
  ] as const) {
    const handler = eventsHandler(new Events(store(), send));
    try {
      const response = await handler.fetch(new Request('http://localhost/mcp', { method: 'POST', headers: {
        'content-type': 'application/json', accept: 'application/json, text/event-stream', 'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'events/subscribe',
      }, body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'events/subscribe', params: { ...input(secret()),
        _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} } } }) }));
      const wire = await response.json() as { error: { code: number; data: { reason: string } } };
      expect(wire.error.code).toBe(-32015); expect(wire.error.data.reason).toBe(reason);
    } finally { await handler.close(); }
  }
});
test('theme notifications retain local selection; changed context and removal apply once', () => {
  const navigation = new HostSelection(); const link = { url: '/records/beta' };
  expect(navigation.apply(undefined, link, null)).toBe('beta');
  expect(navigation.apply('alpha', link, null)).toBe('alpha');
  const context = { updateId: 'one', structuredContent: { recordId: 'beta' } };
  expect(navigation.apply('alpha', link, context)).toBe('beta');
  expect(navigation.apply('alpha', link, context)).toBe('alpha');
  expect(navigation.apply('alpha', link, null)).toBeUndefined();
  expect(navigation.apply('beta', link, null)).toBe('beta');
});
test('file notifications preserve edits and reset permissions when changing resource', () => {
  const draft = new FileDraft(); draft.open('host://one'); draft.receive('host://one', 'original', 'v1', true);
  draft.edit('my changes'); expect(draft.notified()).toBe(false);
  draft.receive('host://one', 'external change', 'v2', true);
  expect(draft.text).toBe('my changes'); expect(draft.etag).toBe('v1'); expect(draft.stale).toBe(true);
  expect(() => draft.open('host://two')).toThrow('current draft');
  draft.receive('host://one', 'external change', 'v2', true, true);
  draft.open('host://two'); expect(draft.writable).toBe(false); expect(draft.etag).toBeUndefined();
  draft.receive('host://one', 'late response', 'v3', true); expect(draft.text).toBe('');
});

test('relocated portable artifact runs both Node stdio profiles and persists settings across restart', async () => {
  const packagePath = join(directory, 'portable');
  cpSync(new URL('../dist/plugin', import.meta.url), packagePath, { recursive: true });
  const preferences = join(directory, 'preferences.json');
  for (const first of [true, false]) {
    const client = new LegacyClient({ name: 'relocation', version: '1' });
    await client.connect(new LegacyStdio({ command: 'node', args: [join(packagePath, 'ui.mjs')], cwd: directory, env: { REFERENCE_UI_DATA: preferences } }));
    try {
      const tools = await client.listTools(); expect(tools.tools.some(tool => tool.name === 'records.open')).toBe(true);
      expect((await client.readResource({ uri: UI_URI })).contents).toHaveLength(1);
      if (first) await client.callTool({ name: 'settings.update', arguments: { set: { compact: true } } });
      expect((await client.callTool({ name: 'settings.read', arguments: {} })).structuredContent).toMatchObject({ values: { compact: true } });
    } finally { await client.close(); }
  }
  const client = new Client({ name: 'relocation-v2', version: '1' }, { capabilities: { elicitation: { form: {} } } });
  client.setRequestHandler('elicitation/create', async () => ({ action: 'accept', content: { record_id: 'beta' } }));
  await client.connect(new StdioClientTransport({ command: 'node', args: [join(packagePath, 'events.mjs')], cwd: directory, env: { REFERENCE_DATA: join(directory, 'events.json') } }));
  try {
    expect((await client.request({ method: 'events/list', params: {} }, z.object({ events: z.array(z.unknown()) }))).events).toHaveLength(1);
    expect((await client.callTool({ name: 'records.choose', arguments: {} })).structuredContent).toMatchObject({ record: { id: 'beta' } });
  } finally { await client.close(); }
});
test('an event emitted during delivery remains queued for the next pass', async () => {
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  let began!: () => void; const started = new Promise<void>(resolve => { began = resolve; });
  const events = new Events(store(), async (url, body, headers) => {
    if (JSON.parse(body).type === 'verification') return receiver(url, body, headers);
    began(); await gate; return { status: 200, body: '{}' };
  });
  await events.subscribe('reference-user', input(secret()));
  events.emit('reference-user', 'alpha', 'First'); const delivery = events.deliver(); await started;
  const second = events.emit('reference-user', 'alpha', 'Second'); release(); await delivery;
  expect(store().read().jobs.map(job => job.event.eventId)).toEqual([second]);
});

test('running HTTP endpoint requires bearer auth and rejects browser origins', async () => {
  const token = randomBytes(24).toString('hex');
  const child = Bun.spawn([process.execPath, new URL('./events-http.ts', import.meta.url).pathname], {
    env: { ...process.env, REFERENCE_MCP_TOKEN: token, REFERENCE_PORT: '0', REFERENCE_DATA: join(directory, 'http.json') },
    stdout: 'ignore', stderr: 'pipe',
  });
  try {
    const reader = child.stderr.getReader(); const ready = await reader.read();
    const url = new TextDecoder().decode(ready.value).match(/http:\/\/127\.0\.0\.1:\d+\/mcp/)?.[0];
    if (!url) throw new Error('HTTP fixture did not start');
    reader.releaseLock();
    expect((await fetch(url, { method: 'POST' })).status).toBe(401);
    expect((await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${token}`, origin: 'https://external.example' } })).status).toBe(403);
    const response = await fetch(url, { method: 'POST', headers: {
      authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': '2026-07-28', 'Mcp-Method': 'server/discover',
    }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {},
    } } }) });
    const wire = await response.json() as { result: { capabilities: { events: unknown } } };
    expect(wire.result.capabilities.events).toEqual({});
  } finally { child.kill(); await child.exited; }
}, 10_000);

test('stale owner locks require explicit recovery without replacing another owner', () => {
  const path = join(directory, 'stale.json'); writeFileSync(`${path}.lock`, '2147483647');
  expect(() => acquireOwner(path)).toThrow('Stale owner lock');
  expect(() => acquireOwner(path)).toThrow('Stale owner lock');
});
