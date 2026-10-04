import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { ConvexError } from 'convex/values';
import { localEnvironment, redact } from '../scripts/runtime';
import { selfContainedResource, items, denied } from '../scripts/readiness';
import { TrialEvents } from '../scripts/trials';

describe('proof boundary policy', () => {
  test('local subprocesses do not inherit deployment or authentication secrets', () => {
    const env = localEnvironment({
      PATH: '/bin',
      HOME: '/tmp/user',
      CONVEX_DEPLOY_KEY: 'private',
      CONVEX_DEPLOYMENT: 'prod:shared',
      WORKOS_API_KEY: 'private',
      ASTACK_PROOF_TOKEN: 'private',
      OPENAI_API_KEY: 'private',
    });
    expect(env).toEqual({ PATH: '/bin', HOME: '/tmp/user' });
  });
  test('retained logs redact signed tokens and bearer headers', () => {
    expect(
      redact(
        'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop Bearer token',
      ),
    ).toBe('[REDACTED JWT] Bearer [REDACTED]');
  });
  test('external script or stylesheet resources cannot pass packaging proof', () => {
    expect(() => {
      selfContainedResource('<html><script src="/app.js"></script></html>');
    }).toThrow();
    expect(() => {
      selfContainedResource(
        '<html><link rel="stylesheet" href="/app.css"></html>',
      );
    }).toThrow();
    expect(() => {
      selfContainedResource(
        '<html><style>body{color:black}</style><script>console.log(1)</script></html>',
      );
    }).not.toThrow();
  });
  test('a malformed DTO cannot become persisted-state evidence', () => {
    expect(() =>
      items([{ id: 'a', title: 'one', status: 'unknown' }]),
    ).toThrow();
  });
  test('an expected Convex ownership denial is accepted, but a backend crash is not', async () => {
    await denied(() => Promise.reject(new ConvexError({ code: 'FORBIDDEN' })), {
      kind: 'code',
      code: 'FORBIDDEN',
    });
    await assert.rejects(
      denied(
        () => Promise.reject(new Error('fetch failed: connection reset')),
        { kind: 'code', code: 'FORBIDDEN' },
      ),
      /unrelated failure/,
    );
    await assert.rejects(
      denied(
        () => Promise.reject(new ConvexError({ code: 'INTERNAL_ERROR' })),
        { kind: 'code', code: 'FORBIDDEN' },
      ),
      /unrelated failure/,
    );
  });
  test('MCP isError only counts when it contains the expected application denial', async () => {
    const toolError = (text: string) =>
      Promise.resolve({
        isError: true,
        content: [{ type: 'text', text }],
      });
    await denied(
      () =>
        toolError(
          'Uncaught ConvexError: {"code":"FORBIDDEN","message":"Unavailable"}\n    at handler',
        ),
      { kind: 'code', code: 'FORBIDDEN' },
    );
    await assert.rejects(
      denied(() => toolError('Server unavailable'), {
        kind: 'code',
        code: 'FORBIDDEN',
      }),
      /unrelated failure/,
    );
  });
  test('malformed MCP arguments require a validation error for the specified tool and field', async () => {
    await denied(
      () =>
        Promise.resolve({
          isError: true,
          content: [
            {
              type: 'text',
              text: 'MCP error -32602: Input validation error: Invalid arguments for tool work_items_set_status: Invalid option: expected one of "open"|"done" at status',
            },
          ],
        }),
      { kind: 'arguments', tool: 'work_items_set_status', field: 'status' },
    );
    await assert.rejects(
      denied(
        () =>
          Promise.resolve({
            isError: true,
            content: [
              { type: 'text', text: 'MCP error -32602: Internal error' },
            ],
          }),
        { kind: 'arguments', tool: 'work_items_set_status', field: 'status' },
      ),
      /unrelated failure/,
    );
  });
  test('wrong JWT audience evidence requires configured providers, not a bootstrap failure', async () => {
    await denied(
      () =>
        Promise.reject(
          new Error(
            JSON.stringify({
              code: 'NoAuthProvider',
              message:
                "Check that your JWT's issuer and audience match one of your configured providers: [CustomJWT]",
            }),
          ),
        ),
      { kind: 'jwt' },
    );
    await assert.rejects(
      denied(
        () =>
          Promise.reject(
            new Error(
              JSON.stringify({
                code: 'NoAuthProvider',
                message:
                  'No auth provider found matching the given token (no providers configured).',
              }),
            ),
          ),
        { kind: 'jwt' },
      ),
      /unrelated failure/,
    );
  });
  test('trial event accounting keeps usage and excludes conversation text from action caps', () => {
    const events = new TrialEvents();
    for (const event of [
      { type: 'thread.started' },
      { type: 'item.started', item: { id: 'text', type: 'agent_message' } },
      { type: 'item.started', item: { id: 'call', type: 'command_execution' } },
      { type: 'item.started', item: { id: 'call', type: 'command_execution' } },
      { type: 'turn.completed', usage: { input_tokens: 20, output_tokens: 5 } },
    ])
      events.accept(event);
    expect(events.actionIds.size).toBe(1);
    expect(events.completed).toBe(true);
    expect(events.usage).toEqual([{ input_tokens: 20, output_tokens: 5 }]);
  });
});
