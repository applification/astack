import { createHash } from 'node:crypto';
import {
  cp,
  lstat,
  mkdir,
  readFile,
  realpath,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { command, commandBytes } from './runtime';
import { fileDigests } from './trials';

export const fixtureRoot = resolve(import.meta.dir, '../evals/notebook');
export const tasks = ['bug', 'feature', 'followup'] as const;
export type Task = (typeof tasks)[number];
export const sha256 = (bytes: string | Buffer) =>
  createHash('sha256').update(bytes).digest('hex');
export const json = (value: unknown) => JSON.stringify(value, null, 2) + '\n';
export async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path + '.tmp', json(value));
  await rename(path + '.tmp', path);
}
export function within(parent: string, child: string): boolean {
  const path = relative(parent, child);
  return (
    path === '' ||
    (!path.startsWith('..' + sep) && path !== '..' && !path.startsWith(sep))
  );
}
export async function newDirectory(
  path: string,
  outside?: string,
): Promise<string> {
  const absolute = resolve(path);
  let ancestor = resolve(absolute, '..');
  const missing: string[] = [absolute.split(sep).at(-1) ?? ''];
  let canonical: string;
  for (;;) {
    try {
      canonical = await realpath(ancestor);
      break;
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
      missing.unshift(ancestor.split(sep).at(-1) ?? '');
      ancestor = resolve(ancestor, '..');
    }
  }
  const destination = join(canonical, ...missing);
  if (outside && within(await realpath(outside), destination))
    throw new Error('Evidence output must be outside the delivered repository');
  await mkdir(resolve(destination, '..'), { recursive: true });
  await mkdir(destination); // EEXIST is intentional, including empty directories and symlinks.
  return destination;
}
export async function initNotebook(
  destination: string,
  source = fixtureRoot,
): Promise<string> {
  const directory = await newDirectory(destination);
  for (const entry of await readdir(source))
    await cp(join(source, entry), join(directory, entry), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  await command(['git', 'init', '--initial-branch=main'], directory);
  await command(['git', 'add', '.'], directory);
  await command(
    [
      'git',
      '-c',
      'user.name=Notebook fixture',
      '-c',
      'user.email=notebook@invalid.example',
      'commit',
      '-m',
      'Initial local notebook',
    ],
    directory,
  );
  return directory;
}
/** Include all delivered inputs, even hidden config; never follow symlinks. */
export async function projectFiles(
  directory: string,
  prefix = '',
): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort(
    (a, b) => a.name.localeCompare(b.name),
  )) {
    if (['.git', 'node_modules', '.notebook'].includes(entry.name)) continue;
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory())
      Object.assign(
        files,
        await projectFiles(join(directory, entry.name), name),
      );
    else if (entry.isFile())
      files[name] = sha256(await readFile(join(directory, entry.name)));
    else throw new Error(`Unsupported delivered entry: ${name}`);
  }
  return files;
}
export async function projectIdentity(project: string) {
  const root = await realpath(project);
  if (
    (await command(['git', 'rev-parse', '--show-toplevel'], root)).trim() !==
    root
  )
    throw new Error('Project must be the root of its own Git repository');
  const files = await projectFiles(root);
  return {
    revision: (await command(['git', 'rev-parse', 'HEAD'], root)).trim(),
    dirty: (
      await commandBytes(
        ['git', 'status', '--porcelain=v1', '--untracked-files=all'],
        root,
      )
    ).toString('utf8'),
    sourceDigest: sha256(json(files)),
    files,
  };
}
export async function suiteIdentity() {
  const files: Record<string, string> = {};
  for (const name of [
    'agent-evals.ts',
    'agent-eval-fixture.ts',
    'agent-eval-check.ts',
    'agent-eval-run.ts',
    'trials.ts',
    'runtime.ts',
    'source-identity.ts',
    'agent-eval-quality-rubric.md',
  ])
    files[`scripts/${name}`] = sha256(
      await readFile(join(import.meta.dir, name)),
    );
  const fixtureFiles = await fileDigests(fixtureRoot);
  return {
    digest: sha256(json(files)),
    files,
    fixtureDigest: sha256(json(fixtureFiles)),
    fixtureFiles,
  };
}
export async function regularFile(path: string): Promise<void> {
  if (!(await lstat(path)).isFile())
    throw new Error(`Expected a regular file: ${path}`);
}
const localBoundary =
  ' This is a local-only notebook exercise. Complete and validate it locally; no publishing, cloud deployment, remote operations or pull request is needed or authorized.';
export const prompts: Record<Task, string> = {
  bug:
    'Fix the notebook: clicking Done leaves the note open, and Reopen leaves it done. Persist the requested boolean exactly through refresh and server restart. Keep the existing browser controls and API, preserve other notes, actor ownership, input validation and create retry behavior. Run appropriate checks and report changes and any gaps.' +
    localBoundary,
  feature:
    'Add title editing to the notebook in the browser and API. PATCH /api/notes/:id must accept exactly {title: string} as an alternative to {done: boolean}, returning {note}. Trim titles, accept 1–120 characters and reject invalid values with 400. Preserve ownership, persistence, other fields/notes and create retry behavior: the original normalized create input must still return the same note after title edits and server restart; a different create input on that operation remains a conflict. Keep existing disk records compatible. Keep this change focused on title editing. Run appropriate checks and report changes and any gaps.' +
    localBoundary,
  followup:
    'Add archive and restore to the notebook in the browser and API. PATCH /api/notes/:id must accept exactly {archived: boolean} as an alternative to its existing patch. GET /api/notes hides archived notes by default; GET /api/notes?includeArchived=true includes them so the browser can restore them. Preserve ownership, persistence, other fields/notes, validation and create retry behavior. Run appropriate checks and report changes and any gaps.' +
    localBoundary,
};
