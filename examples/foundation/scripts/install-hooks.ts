import { readdir, realpath } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const arguments_ = process.argv.slice(2);
if (arguments_.some((argument) => argument !== '--replace-existing-hooks'))
  throw new Error(
    'Usage: bun scripts/install-hooks.ts [--replace-existing-hooks]',
  );
if (process.env['HUSKY'] === '0') {
  console.log('HUSKY=0: hook installation skipped.');
  process.exit(0);
}
const project = await realpath(fileURLToPath(new URL('../', import.meta.url)));
function git(args: string[]) {
  return Bun.spawnSync(['git', ...args], {
    cwd: project,
    stdout: 'pipe',
    stderr: 'pipe',
  });
}
const enclosing = git(['rev-parse', '--show-toplevel']);
if (enclosing.exitCode !== 0) {
  console.log(
    'Hooks not installed: no Git repository. Run git init, then bun run hooks:install.',
  );
  process.exit(0);
}
const repository = await realpath(enclosing.stdout.toString().trim());
const path = relative(repository, project);
if (isAbsolute(path) || path.split(sep).includes('..'))
  throw new Error('The project must be inside its Git repository.');
const hookDirectory = [path.split(sep).join('/'), '.husky']
  .filter(Boolean)
  .join('/');
const expected = `${hookDirectory}/_`;
const configured = git(['config', '--get', 'core.hooksPath']);
if (![0, 1].includes(configured.exitCode))
  throw new Error(
    'Cannot inspect Git hook configuration; existing hooks were preserved.',
  );
const current = configured.stdout.toString().trim();
const repositoryFiles = git([
  '-C',
  repository,
  'ls-files',
  '--full-name',
  '--cached',
  '--others',
  '--exclude-standard',
  '-z',
]);
if (repositoryFiles.exitCode !== 0)
  throw new Error(
    'Cannot inspect the enclosing repository; hooks were preserved.',
  );
const prefix = path.split(sep).join('/') + '/';
const occupiedParent =
  path !== '' &&
  repositoryFiles.stdout
    .toString()
    .split('\0')
    .some((file) => file !== '' && !file.startsWith(prefix));
const defaultPath = git(['rev-parse', '--git-path', 'hooks']);
if (defaultPath.exitCode !== 0)
  throw new Error('Cannot inspect the repository hook directory.');
let defaultHooks: string[];
try {
  defaultHooks = (
    await readdir(resolve(project, defaultPath.stdout.toString().trim()))
  ).filter((name) => !name.endsWith('.sample') && name !== '.gitignore');
} catch (error) {
  if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
    defaultHooks = [];
  else throw error;
}
const occupied =
  (current ? current !== expected : defaultHooks.length > 0) ||
  (occupiedParent && current !== expected);
if (occupied && !arguments_.includes('--replace-existing-hooks')) {
  console.warn(
    'Existing repository hooks were preserved; this project hook was not installed. The enclosing repository has other files or hook configuration. Use bun run hooks:install -- --replace-existing-hooks only after choosing to replace the repository hook configuration.',
  );
  process.exit(0);
}
const require = createRequire(import.meta.url);
const executable = join(dirname(require.resolve('husky')), 'bin.js');
const previousLocal = git([
  'config',
  '--local',
  '--null',
  '--get-all',
  'core.hooksPath',
]);
if (![0, 1].includes(previousLocal.exitCode))
  throw new Error('Cannot preserve local Git hook configuration.');
try {
  const installation = Bun.spawnSync(
    [process.execPath, executable, hookDirectory],
    {
      cwd: repository,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  );
  const diagnostic = installation.stdout.toString().trim();
  if (installation.exitCode !== 0 || diagnostic)
    throw new Error(
      `Hook installation failed: ${diagnostic || installation.stderr.toString().trim()}`,
    );
  const installed = git(['config', '--get', 'core.hooksPath']);
  if (
    installed.exitCode !== 0 ||
    installed.stdout.toString().trim() !== expected
  )
    throw new Error('Git did not activate the project hook directory.');
} catch (error) {
  const unset = git(['config', '--local', '--unset-all', 'core.hooksPath']);
  if (![0, 5].includes(unset.exitCode))
    throw new Error(
      'Hook installation failed and prior configuration could not be restored.',
      { cause: error },
    );
  const values = previousLocal.stdout.toString().split('\0');
  values.pop();
  for (const value of values) {
    const restored = git([
      'config',
      '--local',
      '--add',
      'core.hooksPath',
      value,
    ]);
    if (restored.exitCode !== 0)
      throw new Error(
        'Hook installation failed and prior configuration could not be restored.',
        { cause: error },
      );
  }
  const restoredLocal = git([
    'config',
    '--local',
    '--null',
    '--get-all',
    'core.hooksPath',
  ]);
  const restoredEffective = git(['config', '--get', 'core.hooksPath']);
  if (
    restoredLocal.exitCode !== previousLocal.exitCode ||
    !restoredLocal.stdout.equals(previousLocal.stdout) ||
    restoredEffective.exitCode !== configured.exitCode ||
    !restoredEffective.stdout.equals(configured.stdout)
  )
    throw new Error(
      'Hook installation failed and prior configuration could not be verified.',
      { cause: error },
    );
  throw new Error(
    'Hook installation failed; the previous Git hook configuration was restored.',
    { cause: error },
  );
}
console.log(
  `Installed project hooks at ${expected}; checks run from the project directory.`,
);
