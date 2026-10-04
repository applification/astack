import { resolve, relative } from 'node:path';
import { readdir, access } from 'node:fs/promises';

const mode = process.argv[2];
const args = process.argv.slice(3).filter((value) => value !== '--');
const root = process.cwd();
const started = performance.now();
function run(command: string[]) {
  const result = Bun.spawnSync(command, {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (result.exitCode !== 0)
    throw new Error(`Required check failed: ${command.join(' ')}`);
}
function changed(base: string) {
  const diff = Bun.spawnSync(
    ['git', 'diff', '--relative', '--name-only', base, '--', '.'],
    {
      cwd: root,
    },
  );
  if (diff.exitCode !== 0)
    throw new Error(
      'Cannot establish comparison base; use check:ci for complete coverage.',
    );
  const unknown = Bun.spawnSync(
    ['git', 'ls-files', '--others', '--exclude-standard'],
    { cwd: root },
  );
  return [
    ...new Set(
      (diff.stdout.toString() + '\n' + unknown.stdout.toString())
        .split('\n')
        .filter(Boolean),
    ),
  ];
}
if (!['quick', 'affected', 'ci'].includes(mode ?? ''))
  throw new Error(
    'Usage: check.ts quick [files...] | affected [base-ref] | ci',
  );
const dirs = await Promise.all(
  ['apps', 'packages'].map(async (parent) =>
    (await readdir(parent, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${parent}/${entry.name}`),
  ),
);
for (const dir of dirs.flat()) {
  const pkg: unknown = await Bun.file(`${dir}/package.json`).json();
  if (
    !pkg ||
    typeof pkg !== 'object' ||
    !('scripts' in pkg) ||
    !pkg.scripts ||
    typeof pkg.scripts !== 'object' ||
    !('lint' in pkg.scripts) ||
    (dir !== 'packages/config' && !('typecheck' in pkg.scripts))
  )
    throw new Error(
      `LINT 01: ${dir} must inherit lint and typecheck coverage.`,
    );
}
if (mode === 'quick') {
  run(['bun', 'scripts/prepare-check.ts']);
  const paths = args.length ? args : changed('HEAD');
  const candidates = paths
    .map((file) => relative(root, resolve(root, file)))
    .filter(
      (file) =>
        /\.(ts|tsx|js|mjs)$/.test(file) &&
        !file.includes('/_generated/') &&
        !file.includes('/generated/') &&
        !file.startsWith('.proof/'),
    );
  if (candidates.some((file) => file.startsWith('..')))
    throw new Error('Quick files must be inside this project.');
  const files = (
    await Promise.all(
      candidates.map(
        async (file) =>
          await access(file).then(
            () => file,
            () => undefined,
          ),
      ),
    )
  ).filter((file): file is string => file !== undefined);
  console.log(
    `QUICK: typed lint for ${files.length ? files.join(', ') : 'all handwritten source'}; not full verification.`,
  );
  run([
    'bunx',
    '--no-install',
    'eslint',
    ...(files.length ? files : ['.']),
    '--max-warnings',
    '0',
  ]);
} else if (mode === 'affected') {
  run(['bun', 'scripts/prepare-check.ts']);
  const files = changed(args[0] ?? 'HEAD');
  const broad = files.some((file) =>
    /^(packages\/|scripts\/|tests\/|[^/]+$)/.test(file),
  );
  const consumers = [
    ...new Set(
      files
        .map((file) => file.match(/^apps\/([^/]+)\//)?.[1])
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  console.log(
    `AFFECTED: base ${args[0] ?? 'HEAD'}; ${broad || !consumers.length ? 'complete workspace (shared/config change or uncertain scope)' : consumers.join(', ')}. Includes consumer checks.`,
  );
  if (broad || !consumers.length) {
    run(['bun', 'run', 'lint']);
    run(['bun', 'run', 'typecheck']);
    run(['bun', 'test', 'tests']);
  } else {
    run([
      'bunx',
      '--no-install',
      'turbo',
      'lint',
      'typecheck',
      ...consumers.map((name) => `--filter=@foundation/${name}`),
    ]);
  }
} else {
  console.log(
    'CI: format, every handwritten workspace lint/typecheck, domain contracts and both browser bundles. readiness is the separate real integration gate.',
  );
  run(['bun', 'run', 'format:check']);
  run(['bun', 'run', 'build:mcp-ui']);
  run(['bun', 'run', 'lint']);
  run(['bun', 'run', 'typecheck']);
  run(['bun', 'test', 'tests']);
  run(['bun', 'run', '--cwd', 'apps/web', 'build']);
  run(['bun', 'run', '--cwd', 'packages/ui', 'build']);
}
console.log(
  JSON.stringify({
    mode,
    elapsedMs: Math.round(performance.now() - started),
    outcome: 'pass',
  }),
);
