import { expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { roles, resolveRole } from '../skills/setup-astack/scripts/models.mjs';

const catalog = { providers: [
  { providerInstanceId: 'writer', canRunChildTask: true, models: [{ id: 'write-v1', options: [
    { id: 'reasoning', type: 'select', options: [{ id: 'high' }, { id: 'medium' }] },
    { id: 'fast', type: 'boolean' },
  ] }] },
  { providerInstanceId: 'critic', canRunChildTask: true, models: [{ id: 'review-v1' }] },
  { providerInstanceId: 'offline', canRunChildTask: false, models: [{ id: 'cached-v1' }] },
] };
const writer = { providerInstanceId: 'writer', model: 'write-v1', options: { reasoning: 'high', fast: false } };

test('missing setup and omitted roles inherit without a model catalog', () => {
  for (const role of roles) expect(resolveRole(undefined, role)).toBeNull();
  expect(resolveRole({ roles: { implementation: 'inherit' } }, 'review')).toBeNull();
});
test('roles preserve different providers and supported options for dispatch', () => {
  const critic = { providerInstanceId: 'critic', model: 'review-v1' };
  const config = { roles: { implementation: writer, review: critic } };
  expect(resolveRole(config, 'implementation', catalog)).toEqual(writer);
  expect(resolveRole(config, 'review', catalog)).toEqual(critic);
});
test('stale, disabled or undiscovered selections cannot silently inherit', () => {
  for (const target of [
    { providerInstanceId: 'writer', model: 'deleted-model' },
    { providerInstanceId: 'offline', model: 'cached-v1' },
    { providerInstanceId: 'missing', model: 'write-v1' },
  ]) expect(() => resolveRole({ roles: { implementation: target } }, 'implementation', catalog)).toThrow(/unavailable/);
  expect(() => resolveRole({ roles: { implementation: writer } }, 'implementation')).toThrow('Provider unavailable');
});
test('unknown options, unsupported values and incorrect boolean types fail', () => {
  for (const options of [{ reasoning: 'max' }, { fast: 'false' }, { secret: 'value' }]) {
    expect(() => resolveRole({ roles: { implementation: { ...writer, options } } }, 'implementation', catalog)).toThrow('Unsupported model option');
  }
});
test('malformed preferences and unknown roles fail before dispatch', () => {
  for (const config of [null, {}, [], { roles: [] }, { roles: { typo: 'inherit' } },
    { roles: { review: { model: 'review-v1' } } }, { roles: {}, token: 'not-a-config-field' },
    { roles: { implementation: { ...writer, options: { fast: 1 } } } }]) {
    expect(() => resolveRole(config, 'implementation', catalog)).toThrow();
  }
  expect(() => resolveRole(undefined, 'typo')).toThrow('Unknown model role');
});
test('the packaged CLI reads project preferences and emits the dispatch target', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-models-'));
  const script = resolve(import.meta.dir, '../skills/setup-astack/scripts/models.mjs');
  const run = (...args) => spawnSync('node', [script, project, 'implementation', ...args], { encoding: 'utf8' });
  try {
    expect(run().stdout.trim()).toBe('null');
    mkdirSync(join(project, '.astack'));
    writeFileSync(join(project, '.astack/models.json'), JSON.stringify({ roles: { implementation: writer } }));
    const catalogFile = join(project, 'catalog.json');
    writeFileSync(catalogFile, JSON.stringify(catalog));
    const good = run(catalogFile);
    expect(good.status).toBe(0);
    expect(JSON.parse(good.stdout)).toEqual(writer);
    const missing = run();
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('Provider unavailable');
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('the CLI runs through an installed path containing a directory symlink', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-models-alias-'));
  try {
    const alias = join(project, 'installed-skill');
    symlinkSync(resolve(import.meta.dir, '../skills/setup-astack'), alias, 'dir');
    const result = spawnSync('node', [join(alias, 'scripts/models.mjs'), project, 'research'], { encoding: 'utf8' });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('null');
    expect(result.stderr).toBe('');
    const preserved = spawnSync('node', ['--preserve-symlinks-main', join(alias, 'scripts/models.mjs'), project, 'research'], { encoding: 'utf8' });
    expect(preserved.status).toBe(0);
    expect(preserved.stdout.trim()).toBe('null');
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('setup can import the resolver with role arguments or stdin', () => {
  const url = pathToFileURL(resolve(import.meta.dir, '../skills/setup-astack/scripts/models.mjs')).href;
  const code = `import {resolveRole} from ${JSON.stringify(url)};console.log(JSON.stringify(resolveRole(undefined,process.argv.at(-1))));`;
  for (const [runtime, args, input] of [
    ['node', ['--input-type=module', '-e', code, 'research']],
    ['node', ['--input-type=module', '-', 'research'], code],
    ['bun', ['-e', code, 'research']],
  ]) {
    const result = spawnSync(runtime, args, { encoding: 'utf8', input });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('null');
    expect(result.stderr).toBe('');
  }
});
test('a missing project directory is an error rather than inheritance', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-models-missing-'));
  try {
    const script = resolve(import.meta.dir, '../skills/setup-astack/scripts/models.mjs');
    const result = spawnSync('node', [script, join(project, 'missing'), 'research'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('Project directory unavailable');
  } finally { rmSync(project, { recursive: true, force: true }); }
});
