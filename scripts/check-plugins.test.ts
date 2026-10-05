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
test('a callable skill must have its own matching identity', () => {
  const file = join(path, 'skills/show-me/SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('name: show-me', 'name: pr'));
  expect(() => checkPlugin(path)).toThrow(/Duplicate skill name|Skill name differs from folder/);
});
test('relocated skill composition cannot point at missing instructions', () => {
  const file = join(path, 'skills/pr/SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8') + '\n[missing skill](../missing/SKILL.md)\n');
  expect(() => checkPlugin(path)).toThrow('Missing skill link');
});
test('skill references must remain inside the portable package', () => {
  const file = join(path, 'skills/astack/SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8') + '\n[outside](../../../)\n');
  expect(() => checkPlugin(path)).toThrow('Skill link escapes package');
});
test('every callable skill has packaged UI metadata', () => {
  rmSync(join(path, 'skills/show-me/agents/openai.yaml'));
  expect(() => checkPlugin(path)).toThrow('Missing package path');
});
test('skill frontmatter identity is parsed as YAML strings', () => {
  const file = join(path, 'skills/show-me/SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace(/^description:.*$/m, 'description: [a, b]'));
  expect(() => checkPlugin(path)).toThrow('invalid skill identity');
});
test('a skill invocation prompt selects its owning skill', () => {
  const file = join(path, 'skills/show-me/agents/openai.yaml');
  writeFileSync(file, readFileSync(file, 'utf8').replace('$applification:show-me', '$applification:verify'));
  expect(() => checkPlugin(path)).toThrow('Skill invocation prompt differs from identity');
});
