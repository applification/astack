import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (process.argv.length !== 4)
  throw new Error(
    'Usage: bun scripts/prove-foundation-hooks.ts <source-repository> <new-evidence-directory>',
  );
const source = resolve(process.argv[2] ?? '');
const evidence = resolve(process.argv[3] ?? '');
await mkdir(evidence);
const temporary = await mkdtemp(join(tmpdir(), 'astack-hook-proof-'));
const observations: { id: string; exitCode: number; elapsedMs: number }[] = [];
const cases: { id: string; outcome: 'pass' | 'fail'; detail: string }[] = [];
const snapshots: unknown[] = [];
let transcript = '';
const env: Record<string, string> = {};
for (const key of ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'SHELL']) {
  const value = process.env[key];
  if (value !== undefined) env[key] = value;
}
env['GIT_CONFIG_GLOBAL'] = '/dev/null';
env['GIT_CONFIG_NOSYSTEM'] = '1';
env['GIT_TERMINAL_PROMPT'] = '0';
env['FORCE_COLOR'] = '0';
env['NO_COLOR'] = '1';
function redact(text: string): string {
  const safe = text
    .replaceAll(temporary, '<disposable-directory>')
    .replaceAll(source, '<source-repository>')
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[REDACTED JWT]',
    )
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(/\u001b\[[0-9;]*m/g, '');
  return env['HOME'] === undefined
    ? safe
    : safe.replaceAll(env['HOME'], '<user-home>');
}
async function run(id: string, command: string[], cwd: string) {
  const started = performance.now();
  const child = Bun.spawn(command, {
    cwd,
    env,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  const output = redact(stdout + stderr)
    .replace(/[ \t]+$/gm, '')
    .trimEnd();
  const observation = {
    id,
    exitCode,
    elapsedMs: Math.round(performance.now() - started),
  };
  observations.push(observation);
  transcript += `${id} | exit=${exitCode} | ${observation.elapsedMs}ms\n${output}\n\n`;
  console.log(JSON.stringify(observation));
  return { ...observation, output };
}
function pass(result: { id: string; exitCode: number }) {
  assert.equal(result.exitCode, 0, `${result.id} failed; see commands.log`);
}
async function check(id: string, operation: () => Promise<string>) {
  try {
    cases.push({ id, outcome: 'pass', detail: await operation() });
  } catch (error) {
    cases.push({
      id,
      outcome: 'fail',
      detail: redact(error instanceof Error ? error.message : String(error)),
    });
  }
}
async function scaffold(name: string, nested: boolean) {
  const repository = join(temporary, name);
  const project = nested ? join(repository, 'client app') : repository;
  await mkdir(repository);
  if (!nested) await rm(repository, { recursive: true });
  pass(
    await run(
      `${name}-scaffold`,
      ['bun', 'scripts/create-foundation.ts', project],
      source,
    ),
  );
  snapshots.push(
    JSON.parse(
      await readFile(join(project, '.astack/scaffold.json'), 'utf8'),
    ) as unknown,
  );
  pass(
    await run(
      `${name}-git-init`,
      ['git', 'init', '--initial-branch=hook-proof'],
      repository,
    ),
  );
  pass(
    await run(
      `${name}-git-name`,
      ['git', 'config', '--local', 'user.name', 'Astack disposable hook proof'],
      repository,
    ),
  );
  pass(
    await run(
      `${name}-git-email`,
      [
        'git',
        'config',
        '--local',
        'user.email',
        'astack-hook-proof@example.invalid',
      ],
      repository,
    ),
  );
  pass(
    await run(
      `${name}-git-no-signing`,
      ['git', 'config', '--local', 'commit.gpgsign', 'false'],
      repository,
    ),
  );
  return {
    repository,
    project,
    expected: nested ? 'client app/.husky/_' : '.husky/_',
  };
}
async function installedCase(name: string, nested: boolean) {
  const { repository, project, expected } = await scaffold(name, nested);
  pass(
    await run(
      `${name}-frozen-install`,
      ['bun', 'install', '--frozen-lockfile'],
      project,
    ),
  );
  const hookPath = await run(
    `${name}-hook-path`,
    ['git', 'config', '--get', 'core.hooksPath'],
    repository,
  );
  pass(hookPath);
  assert.equal(hookPath.output.trim(), expected);
  const embedded = join(project, 'packages/backend/convex/generated/mcp_ui.ts');
  assert.equal(
    await Bun.file(embedded).exists(),
    false,
    'Fresh scaffold unexpectedly includes build output',
  );
  pass(await run(`${name}-initial-add`, ['git', 'add', '.'], repository));
  const initial = await run(
    `${name}-initial-commit`,
    ['git', 'commit', '-m', 'First source commit must execute installed hooks'],
    repository,
  );
  pass(initial);
  assert.match(initial.output, /bun scripts\/prepare-check\.ts/);
  assert.match(initial.output, /eslint --no-warn-ignored --max-warnings 0/);
  assert.equal(
    await Bun.file(embedded).exists(),
    true,
    'Initial hook failed to prepare embedded UI',
  );
  const generated = await run(
    `${name}-generated-tracked`,
    [
      'git',
      'ls-files',
      '--',
      ...(nested
        ? ['client app/packages/backend/convex/_generated']
        : ['packages/backend/convex/_generated']),
    ],
    repository,
  );
  pass(generated);
  assert.match(generated.output, /_generated\/api\.ts/);
  assert.doesNotMatch(
    initial.output,
    /File ignored because of a matching ignore pattern/,
  );
  const uiRelative = nested
    ? 'client app/apps/mcp-ui/src/main.tsx'
    : 'apps/mcp-ui/src/main.tsx';
  const ui = join(repository, uiRelative);
  const original = await readFile(ui, 'utf8');
  const staged =
    original + "\nexport const hookPartialStageProbe = 'staged-valid';\n";
  const unstaged = staged + '\nconst hookUnstagedSyntax = ;\n';
  await writeFile(ui, staged);
  pass(
    await run(
      `${name}-partial-add`,
      ['git', 'add', '--', uiRelative],
      repository,
    ),
  );
  await writeFile(ui, unstaged);
  await rm(join(project, 'packages/backend/convex/generated'), {
    recursive: true,
    force: true,
  });
  await rm(join(project, 'apps/mcp-ui/dist'), { recursive: true, force: true });
  const partial = await run(
    `${name}-partial-commit`,
    [
      'git',
      'commit',
      '-m',
      'Build staged MCP UI while preserving invalid unstaged syntax',
    ],
    repository,
  );
  pass(partial);
  assert.match(partial.output, /Hiding unstaged changes/);
  assert.equal(
    await readFile(ui, 'utf8'),
    unstaged,
    'Unstaged syntax bytes were changed or lost',
  );
  assert.equal(await Bun.file(embedded).exists(), true);
  const committed = await run(
    `${name}-partial-committed`,
    ['git', 'show', `HEAD:${uiRelative}`],
    repository,
  );
  pass(committed);
  assert.match(committed.output, /hookPartialStageProbe/);
  assert.doesNotMatch(committed.output, /hookUnstagedSyntax/);
  pass(
    await run(
      `${name}-partial-restore`,
      ['git', 'restore', '--worktree', '--', uiRelative],
      repository,
    ),
  );
  const domainRelative = nested
    ? 'client app/packages/domain/src/index.ts'
    : 'packages/domain/src/index.ts';
  const domain = join(repository, domainRelative);
  const before = await run(
    `${name}-head-before-rejection`,
    ['git', 'rev-parse', 'HEAD'],
    repository,
  );
  pass(before);
  await writeFile(
    domain,
    (await readFile(domain, 'utf8')) +
      "\nPromise.resolve('staged-floating-probe');\n",
  );
  pass(
    await run(
      `${name}-invalid-add`,
      ['git', 'add', '--', domainRelative],
      repository,
    ),
  );
  const rejected = await run(
    `${name}-invalid-commit`,
    ['git', 'commit', '-m', 'This floating promise must be rejected'],
    repository,
  );
  assert.notEqual(rejected.exitCode, 0);
  assert.match(rejected.output, /@typescript-eslint\/no-floating-promises/);
  const after = await run(
    `${name}-head-after-rejection`,
    ['git', 'rev-parse', 'HEAD'],
    repository,
  );
  pass(after);
  assert.equal(before.output, after.output, 'Rejected commit changed HEAD');
  const remaining = await run(
    `${name}-invalid-staged-preserved`,
    ['git', 'diff', '--cached', '--', domainRelative],
    repository,
  );
  pass(remaining);
  assert.match(remaining.output, /staged-floating-probe/);
  return `${expected}: first commit ran real installed hooks with generated types and absent embedded output; partially staged MCP UI built successfully and retained exact invalid unstaged syntax; staged floating promise rejected with unchanged HEAD and staged data preserved.`;
}
async function existingCase(name: string, configured: boolean) {
  const { repository, project, expected } = await scaffold(name, true);
  const directory = configured
    ? join(repository, 'existing-hooks')
    : join(repository, '.git/hooks');
  await mkdir(directory, { recursive: true });
  const hook = join(directory, 'pre-commit');
  const original = '#!/bin/sh\nexit 0\n';
  await writeFile(hook, original, { mode: 0o755 });
  if (configured)
    pass(
      await run(
        `${name}-existing-config`,
        ['git', 'config', 'core.hooksPath', 'existing-hooks'],
        repository,
      ),
    );
  const install = await run(
    `${name}-frozen-install`,
    ['bun', 'install', '--frozen-lockfile'],
    project,
  );
  pass(install);
  assert.match(install.output, /Existing repository hooks were preserved/);
  assert.equal(await readFile(hook, 'utf8'), original);
  const current = await run(
    `${name}-preserved-hook-path`,
    ['git', 'config', '--get', 'core.hooksPath'],
    repository,
  );
  assert.equal(current.exitCode, configured ? 0 : 1);
  assert.equal(current.output.trim(), configured ? 'existing-hooks' : '');
  assert.equal(
    await Bun.file(join(project, '.husky/_/pre-commit')).exists(),
    false,
  );
  if (configured) {
    pass(
      await run(
        `${name}-explicit-opt-in`,
        ['bun', 'run', 'hooks:install', '--', '--replace-existing-hooks'],
        project,
      ),
    );
    const activated = await run(
      `${name}-opt-in-hook-path`,
      ['git', 'config', '--get', 'core.hooksPath'],
      repository,
    );
    pass(activated);
    assert.equal(activated.output.trim(), expected);
    assert.equal(await readFile(hook, 'utf8'), original);
  }
  return configured
    ? 'Configured hooks remain active after install; explicit opt-in activates the app hook and preserves old hook files.'
    : 'Default repository hook files and unset hook configuration survive install; the app hook remains inactive.';
}
async function occupiedParentCase(tracked: boolean) {
  const name = tracked ? 'tracked parent' : 'untracked parent';
  const { repository, project, expected } = await scaffold(name, true);
  await writeFile(join(repository, 'package.json'), '{"private":true}\n');
  if (tracked)
    pass(
      await run(
        `${name}-track-owner-file`,
        ['git', 'add', '--', 'package.json'],
        repository,
      ),
    );
  const install = await run(
    `${name}-frozen-install`,
    ['bun', 'install', '--frozen-lockfile'],
    project,
  );
  pass(install);
  assert.match(install.output, /enclosing repository has other files/);
  const current = await run(
    `${name}-preserved-hook-path`,
    ['git', 'config', '--get', 'core.hooksPath'],
    repository,
  );
  assert.equal(current.exitCode, 1);
  assert.equal(
    await Bun.file(join(project, '.husky/_/pre-commit')).exists(),
    false,
  );
  pass(
    await run(
      `${name}-explicit-opt-in`,
      ['bun', 'run', 'hooks:install', '--', '--replace-existing-hooks'],
      project,
    ),
  );
  const activated = await run(
    `${name}-opt-in-hook-path`,
    ['git', 'config', '--get', 'core.hooksPath'],
    repository,
  );
  pass(activated);
  assert.equal(activated.output.trim(), expected);
  return `${tracked ? 'Tracked' : 'Untracked'} files outside the project prevent automatic repository hook takeover; explicit opt-in installs the project hook.`;
}
async function failedInstallationCase(configured: boolean) {
  const name = configured
    ? 'failed configured install'
    : 'failed default install';
  const { repository, project } = await scaffold(name, true);
  const directory = configured
    ? join(repository, 'existing-hooks')
    : join(repository, '.git/hooks');
  await mkdir(directory, { recursive: true });
  const hook = join(directory, 'pre-commit');
  const original =
    '#!/bin/sh\nprintf "retained-hook-active\\n" > .hook-activity\n';
  await writeFile(hook, original, { mode: 0o755 });
  if (configured)
    pass(
      await run(
        `${name}-existing-config`,
        ['git', 'config', '--local', 'core.hooksPath', 'existing-hooks'],
        repository,
      ),
    );
  pass(
    await run(
      `${name}-frozen-install`,
      ['bun', 'install', '--frozen-lockfile'],
      project,
    ),
  );
  await writeFile(
    join(project, '.husky/_'),
    'Deliberately block Husky shim provisioning.\n',
  );
  const failed = await run(
    `${name}-failed-explicit-install`,
    ['bun', 'run', 'hooks:install', '--', '--replace-existing-hooks'],
    project,
  );
  assert.notEqual(failed.exitCode, 0);
  assert.match(failed.output, /previous Git hook configuration was restored/);
  const current = await run(
    `${name}-restored-hook-path`,
    ['git', 'config', '--local', '--get', 'core.hooksPath'],
    repository,
  );
  assert.equal(current.exitCode, configured ? 0 : 1);
  assert.equal(current.output.trim(), configured ? 'existing-hooks' : '');
  assert.equal(await readFile(hook, 'utf8'), original);
  await writeFile(
    join(repository, 'owner-proof.txt'),
    'Existing repository hook must remain active.\n',
  );
  pass(
    await run(
      `${name}-owner-add`,
      ['git', 'add', '--', 'owner-proof.txt'],
      repository,
    ),
  );
  pass(
    await run(
      `${name}-owner-commit`,
      [
        'git',
        'commit',
        '-m',
        'Verify previous hook executes after failed replacement',
      ],
      repository,
    ),
  );
  assert.equal(
    await readFile(join(repository, '.hook-activity'), 'utf8'),
    'retained-hook-active\n',
  );
  return `${configured ? 'Configured' : 'Default'} hook configuration and bytes survive failed shim provisioning, and a real subsequent commit executes the previous hook.`;
}
const startedAt = new Date().toISOString();
try {
  await check('standalone-initial-partial-and-rejection', () =>
    installedCase('standalone', false),
  );
  await check('nested-initial-partial-and-rejection', () =>
    installedCase('nested parent', true),
  );
  await check('preserve-default-hooks', () =>
    existingCase('default hooks', false),
  );
  await check('preserve-configured-hooks-and-explicit-opt-in', () =>
    existingCase('configured hooks', true),
  );
  await check('preserve-occupied-tracked-parent', () =>
    occupiedParentCase(true),
  );
  await check('preserve-occupied-untracked-parent', () =>
    occupiedParentCase(false),
  );
  await check('restore-default-hooks-on-install-failure', () =>
    failedInstallationCase(false),
  );
  await check('restore-configured-hooks-on-install-failure', () =>
    failedInstallationCase(true),
  );
} finally {
  await rm(temporary, { recursive: true, force: true });
  const outcome =
    cases.length === 8 && cases.every((item) => item.outcome === 'pass')
      ? 'pass'
      : 'fail';
  await writeFile(join(evidence, 'commands.log'), transcript.trimEnd() + '\n');
  await writeFile(
    join(evidence, 'report.json'),
    JSON.stringify(
      {
        scope:
          'Disposable Git hook integration only; no HUSKY bypass, runtime, authentication or deployment work.',
        startedAt,
        finishedAt: new Date().toISOString(),
        outcome,
        snapshots,
        cases,
        observations,
        commandsLogSha256: createHash('sha256')
          .update(transcript.trimEnd() + '\n')
          .digest('hex'),
        failureCoverage: [
          'The first standalone and nested commit must execute installed hooks with checked-in generated Convex source and missing embedded UI.',
          'Partially staged MCP UI with invalid unstaged syntax must build staged content and preserve exact unstaged bytes.',
          'Staged handwritten floating promises must fail by the expected rule, preserve staged data and leave HEAD unchanged.',
          'Configured and default repository hooks must be preserved unless the fixture explicitly opts in to replacement.',
          'Tracked and untracked owner files outside a nested project must prevent automatic hook installation.',
          'Failed Husky shim provisioning must restore exact prior hook configuration and preserve real prior hook activity.',
        ],
        cleanup: 'complete',
        limits: [
          'Git fixtures use local identities and ignore host global/system Git configuration. All commits execute their actual installed hooks; no initial baseline bypass is used.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
  console.log(JSON.stringify({ outcome, cases }));
  if (outcome !== 'pass') process.exitCode = 1;
}
