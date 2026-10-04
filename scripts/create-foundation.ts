import { cp, mkdir, realpath, lstat, writeFile } from 'node:fs/promises';
import { resolve, relative, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { sourceDigest } from '../examples/foundation/scripts/source-identity';

const source = await realpath(fileURLToPath(new URL('../examples/foundation', import.meta.url)));
const supplied = process.argv[2];
if (!supplied || process.argv.length !== 3) throw new Error('Usage: bun scripts/create-foundation.ts <new-directory>');
const destination = resolve(supplied);
const relation = relative(source, destination);
if (!relation || (!relation.startsWith('..') && !relation.startsWith('/'))) throw new Error('Choose a destination outside the reference source.');
if (await lstat(destination).then(() => true, () => false)) throw new Error(`Refusing existing destination: ${destination}`);
const excluded = new Set(['node_modules', '.git', '.convex', '.turbo', '.proof', 'dist', 'storybook-static']);
await mkdir(destination, { recursive: true });
await cp(source, destination, { recursive: true, filter(path) {
  const parts = relative(source, path).split('/');
  return !parts.some(part => excluded.has(part) || (part.startsWith('.env') && part !== '.env.example')) && !parts.includes('generated');
} });
const revision = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: source }).stdout.toString().trim() ||
  await Bun.file(new URL('../.astack/candidate-revision', import.meta.url)).text().then(value => value.trim(), () => 'unversioned');
const lock = await Bun.file(resolve(source, 'bun.lock')).text();
const sourceSha256 = await sourceDigest(destination);
await mkdir(resolve(destination, '.astack'), { recursive: true });
await writeFile(resolve(destination, '.astack/scaffold.json'), JSON.stringify({ profile: 'convex-workos-mcp-v1', sourceRevision: revision, sourceSha256, lockSha256: createHash('sha256').update(lock).digest('hex') }, null, 2) + '\n');
console.log(`Created ${basename(destination)} at ${destination}. Run bun install --frozen-lockfile, then bun run check:ci and bun run readiness. WorkOS setup is described in README.md.`);
