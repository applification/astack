import { expect, test } from 'bun:test';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { roles, resolveConfig, resolveRole, setupProject } from '../skills/setup-astack/scripts/models.mjs';

const catalog = { providers: [
  { providerInstanceId: 'writer', canRunChildTask: true, models: [{ id: 'write-v1', options: [
    { id: 'reasoning', type: 'select', options: [{ id: 'high' }, { id: 'medium' }] },
    { id: 'fast', type: 'boolean' },
  ] }] },
  { providerInstanceId: 'critic', canRunChildTask: true, models: [{ id: 'review-v1' }] },
  { providerInstanceId: 'offline', canRunChildTask: false, models: [{ id: 'cached-v1' }] },
] };
const writer = { providerInstanceId: 'writer', model: 'write-v1', options: { reasoning: 'high', fast: false } };
const critic = { providerInstanceId: 'critic', model: 'review-v1' };

test('setup creates explicit inheritance and reads back valid project settings', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-setup-'));
  try {
    const result = setupProject(project);
    expect(result.config).toEqual({ roles: { research: 'inherit', design: 'inherit', implementation: 'inherit', review: 'inherit' } });
    expect(result.resolved).toEqual({ research: null, design: null, implementation: null, review: null });
    expect(JSON.parse(readFileSync(join(project, '.astack/models.json'), 'utf8'))).toEqual(result.config);
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('rerunning setup preserves saved single-reviewer choices and fills only omitted roles', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-setup-rerun-'));
  try {
    mkdirSync(join(project, '.astack'));
    writeFileSync(join(project, '.astack/models.json'), JSON.stringify({ roles: { implementation: writer, review: critic } }));
    const first = setupProject(project, { roles: {} }, catalog);
    expect(first.config).toEqual({ roles: { research: 'inherit', design: 'inherit', implementation: writer, review: critic } });
    const bytes = readFileSync(join(project, '.astack/models.json'), 'utf8');
    expect(setupProject(project, { roles: {} }, catalog)).toEqual(first);
    expect(readFileSync(join(project, '.astack/models.json'), 'utf8')).toBe(bytes);
    expect(first.resolved.review).toEqual(critic);
    const updated = setupProject(project, { roles: { design: writer } }, catalog);
    expect(updated.config.roles).toEqual({ research: 'inherit', design: writer, implementation: writer, review: critic });
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('configured panels select both targets and explicit null restores the preserved single reviewer', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-setup-panel-'));
  try {
    const first = setupProject(project, { roles: { review: critic }, reviewPanel: [writer, critic] }, catalog);
    expect(first.resolved.review).toEqual([writer, critic]);
    expect(setupProject(project, { roles: {} }, catalog)).toEqual(first);
    expect(resolveRole(first.config, 'implementation', catalog)).toBeNull();
    expect(setupProject(project, { roles: {}, reviewPanel: null }, catalog).resolved.review).toEqual(critic);
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('invalid panel shapes cannot turn into single-reviewer work', () => {
  for (const reviewPanel of [[], [writer], [writer, critic, writer], ['inherit', critic], [writer, writer], {}, false]) {
    expect(() => resolveRole({ roles: {}, reviewPanel }, 'review', catalog)).toThrow(/reviewPanel/);
  }
});
test('a panel member failure rejects the whole review with the target and index', () => {
  expect(() => resolveRole({ roles: {}, reviewPanel: [writer, { ...critic, model: 'removed' }] }, 'review', catalog))
    .toThrow('Model unavailable for reviewPanel[1]: critic/removed. Available models: review-v1');
  expect(() => resolveRole({ roles: {}, reviewPanel: [{ ...writer, options: { reasoning: 'max' } }, critic] }, 'review', catalog))
    .toThrow('reviewPanel[0] (writer/write-v1): reasoning=max. Allowed: high, medium');
});
test('T3 cross-provider capability and disabled-provider constraints are enforced', () => {
  const live = { inheritedProviderInstanceId: 'writer', providers: [
    catalog.providers[0], { ...catalog.providers[1], canRunCrossProviderChildTask: false },
    { ...catalog.providers[2], constraints: ['Provider instance is disabled.'] },
  ] };
  expect(resolveRole({ roles: { review: writer } }, 'review', live)).toEqual(writer);
  expect(() => resolveRole({ roles: { review: critic } }, 'review', live)).toThrow('Cross-provider delegation unavailable for review: critic');
  expect(() => resolveRole({ roles: { review: { providerInstanceId: 'offline', model: 'cached-v1' } } }, 'review', live))
    .toThrow('Provider instance is disabled.');
  live.providers[1].canRunCrossProviderChildTask = true;
  expect(resolveRole({ roles: {}, reviewPanel: [writer, critic] }, 'review', live)).toEqual([writer, critic]);
});
test('failed setup leaves existing choices intact and does not create an invalid file', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-setup-failure-'));
  try {
    const bad = { roles: { review: { ...critic, model: 'missing' } } };
    expect(() => setupProject(project, bad, catalog)).toThrow('critic/missing');
    expect(existsSync(join(project, '.astack/models.json'))).toBe(false);
    setupProject(project, { roles: { implementation: writer, review: critic } }, catalog);
    const bytes = readFileSync(join(project, '.astack/models.json'), 'utf8');
    expect(() => setupProject(project, bad, catalog)).toThrow('critic/missing');
    expect(() => setupProject(project, { roles: {} })).toThrow('Supply the live host catalog');
    expect(readFileSync(join(project, '.astack/models.json'), 'utf8')).toBe(bytes);
    expect(() => resolveConfig({ roles: bad.roles, reviewPanel: [writer, critic] }, catalog)).toThrow('roles.review: critic/missing');
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('setup rejects corrupt saved settings instead of replacing them with defaults', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-setup-corrupt-'));
  try {
    mkdirSync(join(project, '.astack'));
    for (const bytes of ['{broken', '{"roles":{"typo":"inherit"}}']) {
      writeFileSync(join(project, '.astack/models.json'), bytes);
      expect(() => setupProject(project)).toThrow();
      expect(readFileSync(join(project, '.astack/models.json'), 'utf8')).toBe(bytes);
    }
  } finally { rmSync(project, { recursive: true, force: true }); }
});
test('the setup CLI saves, checks and selects a panel using the same resolver', () => {
  const project = mkdtempSync(join(tmpdir(), 'astack-setup-cli-'));
  const script = resolve(import.meta.dir, '../skills/setup-astack/scripts/models.mjs');
  const run = (...args) => spawnSync('node', [script, ...args], { encoding: 'utf8' });
  try {
    const absent = run(project, '--check');
    expect(absent.status).toBe(1);
    expect(absent.stderr).toContain('Run setup first');
    const choicesFile = join(project, 'choices.json');
    const catalogFile = join(project, 'catalog.json');
    writeFileSync(choicesFile, JSON.stringify({ roles: {}, reviewPanel: [writer, critic] }));
    writeFileSync(catalogFile, JSON.stringify(catalog));
    const setup = run('--setup', project, choicesFile, catalogFile);
    expect(setup.status).toBe(0);
    expect(JSON.parse(setup.stdout).config.roles).toEqual({ research: 'inherit', design: 'inherit', implementation: 'inherit', review: 'inherit' });
    const check = run(project, '--check', catalogFile);
    expect(check.status).toBe(0);
    expect(JSON.parse(check.stdout).review).toEqual([writer, critic]);
    const review = run(project, 'review', catalogFile);
    expect(review.status).toBe(0);
    expect(JSON.parse(review.stdout)).toEqual([writer, critic]);
    const bad = run(project, 'review');
    expect(bad.status).toBe(1);
    expect(bad.stdout).toBe('');
    expect(bad.stderr).toContain('reviewPanel[0]');
  } finally { rmSync(project, { recursive: true, force: true }); }
});

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
