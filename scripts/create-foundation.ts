import { cp, mkdir, realpath, lstat, writeFile } from 'node:fs/promises';
import { resolve, relative, basename, dirname, sep, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from '../examples/foundation/scripts/source-identity';

const source = await realpath(fileURLToPath(new URL('../examples/foundation', import.meta.url)));
const supplied = process.argv[2];
if (!supplied || process.argv.length !== 3) throw new Error('Usage: bun scripts/create-foundation.ts <new-directory>');
const requested = resolve(supplied);
if (await lstat(requested).then(() => true, (error: unknown) => {
  if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
  return false;
})) throw new Error(`Refusing existing destination: ${requested}`);
// Resolve existing parents before containment checks; macOS aliases and parent
// symlinks must not turn a source-contained destination into an apparent sibling.
let ancestor = dirname(requested);
const missing = [basename(requested)];
let destination: string;
while (true) {
  try {
    destination = resolve(await realpath(ancestor), ...missing);
    break;
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') throw error;
    const parent = dirname(ancestor);
    if (parent === ancestor) throw error;
    missing.unshift(basename(ancestor));
    ancestor = parent;
  }
}
const relation = relative(source, destination);
if (!relation || !(relation === '..' || relation.startsWith(`..${sep}`) || isAbsolute(relation))) throw new Error('Choose a destination outside the reference source.');
const excluded = new Set(['node_modules', '.git', '.convex', '.turbo', '.proof', 'dist', 'storybook-static', '.agents', '.claude', 'skills-lock.json']);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, filter(path) {
  const parts = relative(source, path).split('/');
  return !parts.some((part, index) => excluded.has(part) || (part === '_generated' && parts[index + 1] === 'ai') || (part.startsWith('.env') && part !== '.env.example') || (part === '.husky' && parts[index + 1] === '_')) && !parts.includes('generated');
} });
const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: source }).stdout.toString().trim() ||
  await Bun.file(new URL('../.astack/candidate-revision', import.meta.url)).text().then(value => value.trim(), () => 'unversioned');
const lock = await Bun.file(resolve(source, 'bun.lock')).text();
const sourceSha256 = await sourceDigest(destination);
await mkdir(resolve(destination, '.astack'), { recursive: true });
await writeFile(resolve(destination, '.astack/scaffold.json'), JSON.stringify({ profile: 'convex-workos-mcp-v1', sourceRevision: revision, sourceSha256, lockSha256: createHash('sha256').update(lock).digest('hex') }, null, 2) + '\n');
console.log(`Created ${basename(destination)} at ${destination}. Run bun install --frozen-lockfile, then bun run check:ci and bun run readiness. WorkOS setup is described in README.md.`);
