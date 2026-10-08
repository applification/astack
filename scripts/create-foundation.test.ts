import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtemp, mkdir, cp, writeFile, readFile, rm, symlink, lstat, rename } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative, sep, isAbsolute } from 'node:path';

let directory: string;
let source: string;
let script: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'astack-scaffold-contract-'));
  source = join(directory, 'candidate', 'examples', 'foundation');
  script = join(directory, 'candidate', 'scripts', 'create-foundation.ts');
  await mkdir(join(source, 'scripts'), { recursive: true });
  await mkdir(resolve(script, '..'), { recursive: true });
  await mkdir(join(directory, 'candidate', '.astack'));
  await cp(resolve(import.meta.dir, 'create-foundation.ts'), script);
  await cp(resolve(import.meta.dir, '../examples/foundation/scripts/source-identity.ts'), join(source, 'scripts/source-identity.ts'));
  await writeFile(join(directory, 'candidate', '.astack/candidate-revision'), 'contract-fixture\n');
  await writeFile(join(source, 'bun.lock'), 'fixture lock\n');
  await writeFile(join(source, 'README.md'), 'public reference\n');
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

function create(destination: string) {
  return Bun.spawnSync(['bun', script, destination], { cwd: directory });
}

test('scaffold keeps source and environment examples while excluding local state and generated hooks', async () => {
  for (const name of ['node_modules', '.convex', '.auth-fixtures', 'dist', '.husky/_']) {
    await mkdir(join(source, name), { recursive: true });
    await writeFile(join(source, name, 'local'), 'excluded fixture');
  }
  await writeFile(join(source, '.env.local'), 'EXAMPLE_SECRET=fixture');
  await writeFile(join(source, '.env.example'), 'EXAMPLE_SECRET=');
  await writeFile(join(source, '.husky/pre-commit'), 'handwritten hook');
  const destination = join(directory, 'new project');
  const result = create(destination);
  expect(result.exitCode).toBe(0);
  expect(await readFile(join(destination, 'README.md'), 'utf8')).toBe('public reference\n');
  expect(await readFile(join(destination, '.env.example'), 'utf8')).toBe('EXAMPLE_SECRET=');
  expect(await readFile(join(destination, '.husky/pre-commit'), 'utf8')).toBe('handwritten hook');
  for (const name of ['node_modules', '.convex', '.auth-fixtures', 'dist', '.env.local', '.husky/_']) {
    expect(await lstat(join(destination, name)).then(() => true, () => false)).toBe(false);
  }
  const metadata = JSON.parse(await readFile(join(destination, '.astack/scaffold.json'), 'utf8'));
  expect(metadata.sourceRevision).toBe('contract-fixture');
  expect(metadata.sourceSha256).toMatch(/^[a-f0-9]{64}$/);
});

test('scaffold preserves an existing destination and refuses a dangling symlink', async () => {
  const existing = join(directory, 'existing');
  await mkdir(existing);
  await writeFile(join(existing, 'owner.txt'), 'keep this');
  expect(create(existing).exitCode).not.toBe(0);
  expect(await readFile(join(existing, 'owner.txt'), 'utf8')).toBe('keep this');
  const link = join(directory, 'linked');
  await symlink(join(directory, 'missing'), link);
  expect(create(link).exitCode).not.toBe(0);
  expect((await lstat(link)).isSymbolicLink()).toBe(true);
});

test('scaffold refuses destinations inside its reference', async () => {
  const destination = join(source, 'nested');
  expect(create(destination).exitCode).not.toBe(0);
  expect(await lstat(destination).then(() => true, () => false)).toBe(false);
  const alias = join(directory, 'reference-alias');
  await symlink(source, alias);
  expect(create(join(alias, 'also-nested')).exitCode).not.toBe(0);
  expect(await lstat(join(source, 'also-nested')).then(() => true, () => false)).toBe(false);
  const dotted = join(source, '..still-inside');
  expect(create(dotted).exitCode).not.toBe(0);
  expect(await lstat(dotted).then(() => true, () => false)).toBe(false);
});

test('real scaffold retains reachable project instructions after relocation', async () => {
  const destination = join(directory, 'generated project');
  const result = Bun.spawnSync(['bun', resolve(import.meta.dir, 'create-foundation.ts'), destination], { cwd: directory });
  expect(result.exitCode).toBe(0);
  const relocated = join(directory, 'relocated project');
  await rename(destination, relocated);
  const reference = resolve(import.meta.dir, '../examples/foundation');
  for (const name of ['AGENTS.md', 'CLAUDE.md', '.astack/project.md']) {
    const content = await readFile(join(relocated, name), 'utf8');
    expect(content).toBe(await readFile(join(reference, name), 'utf8'));
    // Check local relationships, not instruction wording. A source-checkout or
    // installed-cache pointer would fail containment after generation/moving.
    const links = [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const url = link[1];
      if (!url) throw new Error('Missing link target');
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) continue;
      const target = resolve(dirname(join(relocated, name)), decodeURIComponent(url.split('#')[0] ?? ''));
      const relation = relative(relocated, target);
      expect(isAbsolute(relation) || relation === '..' || relation.startsWith(`..${sep}`)).toBe(false);
      expect((await lstat(target)).isFile()).toBe(true);
    }
  }
});
