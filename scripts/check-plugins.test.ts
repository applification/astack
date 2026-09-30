import { test, expect, beforeEach, afterEach } from 'bun:test';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkPlugin } from './check-plugins';
let path: string;
beforeEach(() => { path = mkdtempSync(join(tmpdir(), 'astack-portable-')); cpSync(resolve(import.meta.dir, '../plugins/applification'), path, { recursive: true }); });
afterEach(() => rmSync(path, { recursive: true, force: true }));
test('portable package retains existing publisher identity', () => expect(checkPlugin(path)).toBe('applification'));
test('legacy fallback cannot silently coexist with the portable package', () => {
  mkdirSync(join(path, '.codex-plugin')); writeFileSync(join(path, '.codex-plugin/plugin.json'), '{}');
  expect(() => checkPlugin(path)).toThrow('Fallback format');
});
test('packaged server cannot reference a missing executable asset', () => {
  const file = join(path, 'mcp.json'); const mcp = JSON.parse(readFileSync(file, 'utf8'));
  mcp.mcpServers.test = { type: 'stdio', command: 'node', args: ['${PLUGIN_ROOT}/missing.mjs'] };
  writeFileSync(file, JSON.stringify(mcp)); expect(() => checkPlugin(path)).toThrow('Missing package path');
});
