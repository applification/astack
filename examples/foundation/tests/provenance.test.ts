import { test, expect } from 'bun:test';
import { mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { sourceDigest } from '../scripts/source-identity';

test('source identity changes for untracked inputs but excludes secrets and observations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'astack-identity-'));
  try {
    await writeFile(join(directory, 'source.ts'), 'export const value = 1;');
    const initial = await sourceDigest(directory);
    await writeFile(join(directory, '.env.staging'), 'EXAMPLE_SECRET=local');
    await mkdir(join(directory, '.proof'));
    await writeFile(join(directory, '.proof', 'report.json'), '{}');
    await mkdir(join(directory, '.husky', '_'), { recursive: true });
    await writeFile(
      join(directory, '.husky', '_', 'pre-commit'),
      'generated hook wrapper',
    );
    expect(await sourceDigest(directory)).toBe(initial);
    await writeFile(join(directory, 'new.ts'), 'export const value = 2;');
    expect(await sourceDigest(directory)).not.toBe(initial);
    const withSource = await sourceDigest(directory);
    await writeFile(join(directory, '.env.example'), 'CONFIGURATION=');
    expect(await sourceDigest(directory)).not.toBe(withSource);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
