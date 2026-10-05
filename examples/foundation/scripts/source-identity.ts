import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';

export function isSourcePath(path: string): boolean {
  const parts = path.split('/');
  return !parts.some(
    (part, index) =>
      [
        'node_modules',
        '.git',
        '.convex',
        '.proof',
        '.turbo',
        'dist',
        'storybook-static',
        'generated',
        'evidence',
        '.agents',
        '.claude',
        'skills-lock.json',
      ].includes(part) ||
      (part === '_generated' && parts[index + 1] === 'ai') ||
      (part.startsWith('.env') && part !== '.env.example') ||
      (part === '.husky' && parts[index + 1] === '_'),
  );
}
/** Includes untracked input source and lockfiles; excludes credentials and build/proof output. */
export async function sourceDigest(project: string): Promise<string> {
  const hash = createHash('sha256');
  async function visit(directory: string): Promise<void> {
    for (const entry of (
      await readdir(directory, { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const path = join(directory, entry.name);
      const name = relative(project, path);
      if (!isSourcePath(name)) continue;
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) {
        hash.update(name + '\0');
        hash.update(
          createHash('sha256')
            .update(await readFile(path))
            .digest('hex'),
        );
        hash.update('\0');
      } else throw new Error(`Unsupported source entry: ${name}`);
    }
  }
  await visit(project);
  return hash.digest('hex');
}
