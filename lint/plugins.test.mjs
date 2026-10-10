import { test, expect, beforeEach, afterEach } from 'bun:test';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkPlugin } from './plugins.mjs';
let path;
beforeEach(() => {
  path = mkdtempSync(join(tmpdir(), 'astack-portable-'));
  const root = resolve(import.meta.dir, '..');
  for (const entry of ['plugin.json', 'mcp.json', 'LICENSE', 'NOTICE.md', 'assets', 'skills']) {
    cpSync(join(root, entry), join(path, entry), { recursive: true });
  }
});
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
test('a local reference must identify an existing heading', () => {
  const file = join(path, 'skills/pr/SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8') + '\n[case](../testing/SKILL.md#missing-case)\n');
  expect(() => checkPlugin(path)).toThrow('Missing skill anchor');
});
test('template links in fenced examples do not refer to packaged project files', () => {
  const file = join(path, 'skills/pr/SKILL.md');
  writeFileSync(file, readFileSync(file, 'utf8') + '\n```markdown\n[project glossary](./src/context/GLOSSARY.md)\n```\n');
  expect(checkPlugin(path)).toBe('applification');
});
test('the installable package and the plugin share one version', () => {
  const root = resolve(import.meta.dir, '..');
  const version = (file) => JSON.parse(readFileSync(join(root, file), 'utf8')).version;
  expect(version('package.json')).toBe(version('plugin.json'));
  expect(version('.claude-plugin/plugin.json')).toBe(version('plugin.json'));
});
test('a playbook cannot dispatch an unknown role', () => {
  const file = join(path, 'skills/astack/playbooks/feature.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('**review**:', '**reveiw**:'));
  expect(() => checkPlugin(path)).toThrow('Invalid playbook role');
});
test('playbook routes cannot silently collide', () => {
  const file = join(path, 'skills/astack/playbooks/feature.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('route: feature', 'route: bug'));
  expect(() => checkPlugin(path)).toThrow('Invalid or duplicate playbook identity');
});
test('every playbook step must have a role', () => {
  const file = join(path, 'skills/astack/playbooks/feature.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('5. **lead**:', '5. Merge and release.\n6. **lead**:'));
  expect(() => checkPlugin(path)).toThrow('Invalid playbook role');
});
test('PR delivery belongs to a final lead step', () => {
  const file = join(path, 'skills/astack/playbooks/feature.md');
  const source = readFileSync(file, 'utf8');
  for (const mutation of [
    source.replace('Return findings and proof gaps.', 'Finish through [pr](../../pr/SKILL.md).'),
    source.replace(/^5\. \*\*lead\*\*:.*\n/m, ''),
  ]) {
    writeFileSync(file, mutation);
    expect(() => checkPlugin(path)).toThrow('Invalid playbook delivery owner');
  }
});
test('review contributions must challenge the diff', () => {
  const file = join(path, 'skills/astack/playbooks/feature.md');
  writeFileSync(file, readFileSync(file, 'utf8').replace('[code-review](../../code-review/SKILL.md) and ', ''));
  expect(() => checkPlugin(path)).toThrow('Missing playbook diff review');
});
