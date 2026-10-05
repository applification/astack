import { test, expect } from 'bun:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { saveWorkosConfiguration } from '../scripts/workos-setup';
import { PreviewOAuth } from '../apps/mcp-ui/src/preview-oauth';
import { isLocalMcpResource } from '../packages/backend/convex/lib/identity';

test('WorkOS setup is repeatable, preserves local state and refuses to replace another environment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'astack-workos-setup-'));
  try {
    await mkdir(join(root, 'packages/backend'), { recursive: true });
    await mkdir(join(root, 'apps/web'), { recursive: true });
    const path = join(root, 'packages/backend/.env.local');
    const initial =
      'CONVEX_DEPLOYMENT=anonymous:keep-local\nCONVEX_URL=http://127.0.0.1:3210\nWORKOS_CLIENT_ID=\n';
    await writeFile(path, initial);
    await saveWorkosConfiguration(
      root,
      'client_astacktest',
      'https://example.authkit.app/',
    );
    const configured = await readFile(path, 'utf8');
    expect(configured).toContain('CONVEX_DEPLOYMENT=anonymous:keep-local');
    expect(configured.match(/WORKOS_CLIENT_ID=/g)).toHaveLength(1);
    await saveWorkosConfiguration(
      root,
      'client_astacktest',
      'https://example.authkit.app',
    );
    expect(await readFile(path, 'utf8')).toBe(configured);
    const rejected = await saveWorkosConfiguration(
      root,
      'client_other',
      'https://other.authkit.app',
    ).then(
      () => null,
      (error: unknown) => error,
    );
    expect(rejected).toBeInstanceOf(Error);
    expect(await readFile(path, 'utf8')).toBe(configured);
    expect(await readFile(join(root, 'apps/web/.env.local'), 'utf8')).toContain(
      'VITE_WORKOS_CLIENT_ID=client_astacktest',
    );
    expect(configured).not.toContain('API_KEY');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('plain HTTP WorkOS resources are limited to the exact local Convex MCP endpoint', () => {
  expect(
    isLocalMcpResource('http://127.0.0.1:3211', 'http://127.0.0.1:3211/mcp'),
  ).toBe(true);
  for (const [site, resource] of [
    ['https://cloud.convex.site', 'http://127.0.0.1:3211/mcp'],
    ['http://127.0.0.1:3211', 'http://127.0.0.1:4321/mcp'],
    ['http://127.0.0.1:3211', 'http://localhost:3211/mcp'],
    ['http://127.0.0.1:3211', 'http://user:secret@127.0.0.1:3211/mcp'],
    ['http://127.0.0.1:3211', 'http://127.0.0.1:3211/mcp?redirect=other'],
    ['http://127.0.0.1:3211', 'http://127.0.0.1:3211/other'],
  ])
    expect(isLocalMcpResource(site, resource ?? '')).toBe(false);
});

test('MCP OAuth callbacks need a one-use state and cannot reuse another resource session', () => {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear() {
      values.clear();
    },
    key(index) {
      return [...values.keys()][index] ?? null;
    },
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
  const oauth = new PreviewOAuth(
    'http://127.0.0.1:3211/mcp',
    'http://127.0.0.1:5174',
    storage,
    () => {},
  );
  expect(oauth.acceptState(null)).toBe(false);
  const state = oauth.state();
  expect(oauth.acceptState(state)).toBe(true);
  expect(oauth.acceptState(state)).toBe(false);
  oauth.saveTokens({
    access_token: 'private-test-access',
    token_type: 'Bearer',
    issuer: 'https://example.authkit.app',
  });
  expect(oauth.tokens()?.issuer).toBe('https://example.authkit.app');
  oauth.saveClientInformation({
    client_id: 'dynamic-test',
    issuer: 'https://example.authkit.app',
    ...oauth.clientMetadata,
  });
  expect(oauth.clientInformation()?.issuer).toBe('https://example.authkit.app');
  const other = new PreviewOAuth(
    'http://127.0.0.1:4321/mcp',
    'http://127.0.0.1:5174',
    storage,
    () => {},
  );
  expect(other.tokens()).toBeUndefined();
  oauth.invalidateCredentials('tokens');
  expect(oauth.tokens()).toBeUndefined();
});
