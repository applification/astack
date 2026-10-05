import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

type Observation = {
  id: string;
  command: string[];
  exitCode: number;
  elapsedMs: number;
  log: string;
};
type Check = { id: string; outcome: 'pass' | 'fail'; detail: string };
type Task = { id: string; cacheStatus: unknown; hash: unknown };

const reference = resolve(process.argv[2] ?? '');
const evidence = resolve(process.argv[3] ?? '');
const override = process.argv[5];
if (
  process.argv.length !== 4 &&
  !(process.argv.length === 6 && process.argv[4] === '--turbo-config')
)
  throw new Error(
    'Usage: bun scripts/prove-foundation-feedback.ts <reference-repository> <new-evidence-directory> [--turbo-config <candidate-turbo.json>]',
  );
await mkdir(evidence, { recursive: false });
const directory = await mkdtemp(join(tmpdir(), 'astack-feedback-proof-'));
const project = join(directory, 'app');
const observations: Observation[] = [];
const checks: Check[] = [];
const env: Record<string, string> = {};
for (const key of ['PATH', 'HOME', 'USER', 'LOGNAME', 'TMPDIR', 'SHELL']) {
  const value = process.env[key];
  if (value !== undefined) env[key] = value;
}
env.FORCE_COLOR = '0';
env.NO_COLOR = '1';
env.TURBO_TELEMETRY_DISABLED = '1';
env.GIT_TERMINAL_PROMPT = '0';

function sanitized(text: string): string {
  const value = text
    .replaceAll(project, '<disposable-project>')
    .replaceAll(directory, '<disposable-directory>')
    .replaceAll(reference, '<reference-repository>')
    .replaceAll(evidence, '<evidence-directory>')
    .replace(/\u001b\[[0-9;]*m/g, '')
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      '[REDACTED JWT]',
    )
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]');
  return env['HOME'] === undefined
    ? value
    : value.replaceAll(env['HOME'], '<user-home>');
}
async function run(
  id: string,
  command: string[],
  cwd = project,
): Promise<Observation> {
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
  const log = `${id}.log`;
  const normalizedLog = sanitized(stdout + stderr)
    .replace(/[ \t]+$/gm, '')
    .trimEnd();
  await writeFile(
    join(evidence, log),
    normalizedLog ? normalizedLog + '\n' : '',
  );
  const result = {
    id,
    command: command.map(sanitized),
    exitCode,
    elapsedMs: Math.round(performance.now() - started),
    log,
  };
  observations.push(result);
  console.log(JSON.stringify(result));
  return result;
}
function mustPass(value: Observation): void {
  assert.equal(value.exitCode, 0, `${value.id} failed; see ${value.log}`);
}
async function check(
  id: string,
  operation: () => Promise<string>,
): Promise<void> {
  try {
    checks.push({ id, outcome: 'pass', detail: await operation() });
  } catch (error) {
    checks.push({
      id,
      outcome: 'fail',
      detail: sanitized(error instanceof Error ? error.message : String(error)),
    });
  }
}
async function text(observation: Observation): Promise<string> {
  return await readFile(join(evidence, observation.log), 'utf8');
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(
    value !== null && typeof value === 'object' && !Array.isArray(value),
  );
  return value as Record<string, unknown>;
}
async function turbo(id: string): Promise<Task[]> {
  const runs = join(project, '.turbo', 'runs');
  const before: string[] = await readdir(runs).catch((): string[] => []);
  const observation = await run(id, [
    'bunx',
    '--no-install',
    'turbo',
    'run',
    'lint',
    'typecheck',
    '--summarize',
  ]);
  mustPass(observation);
  const files = (await readdir(runs)).filter(
    (name) => !before.includes(name) && name.endsWith('.json'),
  );
  assert.equal(files.length, 1, 'Expected one retained Turbo run summary');
  const filename = files[0];
  assert.ok(filename);
  const summary = record(
    JSON.parse(await readFile(join(runs, filename), 'utf8')) as unknown,
  );
  await writeFile(
    join(evidence, `${id}-summary.json`),
    sanitized(JSON.stringify(summary, null, 2)) + '\n',
  );
  assert.ok(Array.isArray(summary.tasks));
  const tasks = summary.tasks.map((value: unknown) => {
    const task = record(value);
    assert.equal(typeof task.taskId, 'string');
    return {
      id: String(task.taskId),
      cacheStatus: record(task.cache).status,
      hash: task.hash,
    };
  });
  await writeFile(
    join(evidence, `${id}-tasks.json`),
    JSON.stringify(tasks, null, 2) + '\n',
  );
  return tasks;
}

const report: Record<string, unknown> = {
  scope:
    'Disposable local scaffold; feedback and Git hooks only. No live identity, runtime, remote cache, or installed-host claim.',
  startedAt: new Date().toISOString(),
  observations,
  checks,
  failureCoverage: [
    'An explicit floating promise must produce the no-floating-promises diagnostic in quick feedback.',
    'A shared UI change must typecheck standalone web and MCP UI consumers.',
    'A shared compiler-config byte change must miss every warmed lint/typecheck cache task.',
    'A valid staged change with invalid unstaged lines must commit only the staged change and preserve unstaged bytes.',
    'A staged floating promise must reject commit, preserve HEAD and retain the staged edit.',
  ],
  limits: [
    'CLI timing uses fresh processes and ordinary warm filesystem caches; no caches are flushed.',
    'Quick feedback measures one domain source file; its scope is deliberately narrower than affected checks.',
    'The initial Git baseline is committed before Husky is installed in the new repository; all acceptance commits execute installed hooks.',
    'These probes cover the listed failures; they do not establish every lint rule or every Git recovery scenario.',
  ],
};
try {
  mustPass(
    await run(
      'scaffold',
      ['bun', 'scripts/create-foundation.ts', project],
      reference,
    ),
  );
  const scaffold = JSON.parse(
    await readFile(join(project, '.astack/scaffold.json'), 'utf8'),
  ) as unknown;
  report.snapshot = scaffold;
  if (override !== undefined) {
    const candidate = await readFile(resolve(override));
    await writeFile(join(project, 'turbo.json'), candidate);
    report.turboOverride = {
      sha256: createHash('sha256').update(candidate).digest('hex'),
      contents: JSON.parse(candidate.toString()) as unknown,
    };
  }
  const fingerprint = await run('post-scaffold-source-fingerprint', [
    'bun',
    '--eval',
    "import {sourceDigest} from './scripts/source-identity.ts'; console.log(await sourceDigest(process.cwd()));",
  ]);
  mustPass(fingerprint);
  report.postScaffoldSourceSha256 = (await text(fingerprint)).trim();
  report.manifestSha256 = createHash('sha256')
    .update(await readFile(join(project, 'package.json')))
    .digest('hex');
  report.manifest = JSON.parse(
    await readFile(join(project, 'package.json'), 'utf8'),
  ) as unknown;
  mustPass(
    await run('frozen-install-before-git', [
      'bun',
      'install',
      '--frozen-lockfile',
    ]),
  );
  mustPass(
    await run('git-init', ['git', 'init', '--initial-branch=feedback-proof']),
  );
  mustPass(
    await run('git-local-name', [
      'git',
      'config',
      '--local',
      'user.name',
      'Astack disposable feedback proof',
    ]),
  );
  mustPass(
    await run('git-local-email', [
      'git',
      'config',
      '--local',
      'user.email',
      'astack-feedback-proof@example.invalid',
    ]),
  );
  mustPass(
    await run('git-local-no-signing', [
      'git',
      'config',
      '--local',
      'commit.gpgsign',
      'false',
    ]),
  );
  mustPass(await run('git-baseline-add', ['git', 'add', '.']));
  mustPass(
    await run('git-baseline-commit', [
      'git',
      'commit',
      '-m',
      'Disposable scaffold baseline before hook installation',
    ]),
  );
  mustPass(
    await run('frozen-install-husky', ['bun', 'install', '--frozen-lockfile']),
  );
  const hooks = await run('installed-hooks', [
    'git',
    'config',
    '--local',
    '--get',
    'core.hooksPath',
  ]);
  mustPass(hooks);
  assert.equal((await text(hooks)).trim(), '.husky/_');
  await check('quick-valid-first-and-repeat', async () => {
    for (const id of ['quick-valid-first', 'quick-valid-repeat'])
      mustPass(
        await run(id, [
          'bun',
          'run',
          'check:quick',
          '--',
          'packages/domain/src/index.ts',
        ]),
      );
    return 'The same valid selected file passes twice; durations are retained independently.';
  });
  const domainPath = join(project, 'packages/domain/src/index.ts');
  const domainOriginal = await readFile(domainPath, 'utf8');
  await check('quick-floating-promise', async () => {
    await writeFile(
      domainPath,
      domainOriginal + "\nPromise.resolve('quick-floating-probe');\n",
    );
    const result = await run('quick-floating-promise', [
      'bun',
      'run',
      'check:quick',
      '--',
      'packages/domain/src/index.ts',
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.match(
      await text(result),
      /@typescript-eslint\/no-floating-promises/,
    );
    return 'Quick feedback rejects the intended floating-promise rule, not a generic process failure.';
  });
  await writeFile(domainPath, domainOriginal);
  const uiPath = join(project, 'packages/ui/src/index.tsx');
  const uiOriginal = await readFile(uiPath, 'utf8');
  await check('affected-shared-ui-consumers', async () => {
    await writeFile(
      uiPath,
      uiOriginal + "\nexport const feedbackScopeProbe = 'shared-ui';\n",
    );
    const result = await run('affected-shared-ui', [
      'bun',
      'run',
      'check:affected',
      '--',
      'HEAD',
    ]);
    mustPass(result);
    const output = await text(result);
    assert.match(output, /AFFECTED:.*complete workspace/);
    assert.match(output, /@foundation\/web:typecheck/);
    assert.match(output, /@foundation\/mcp-ui:typecheck/);
    return 'A shared UI change broadens affected checks and executes web plus MCP UI typechecks.';
  });
  await writeFile(uiPath, uiOriginal);
  const configPath = join(project, 'packages/config/typescript.json');
  const configOriginal = await readFile(configPath, 'utf8');
  await check('warm-cache-and-shared-config-invalidation', async () => {
    const first = await turbo('turbo-populate');
    const warm = await turbo('turbo-warm-repeat');
    assert.ok(first.length > 0);
    assert.equal(warm.length, first.length);
    assert.ok(
      warm.every((task) => task.cacheStatus === 'HIT'),
      'Repeat did not hit every cache task',
    );
    await writeFile(configPath, configOriginal + '\n');
    const changed = await turbo('turbo-shared-config-change');
    assert.equal(changed.length, warm.length);
    assert.ok(
      changed.every((task) => task.cacheStatus === 'MISS'),
      'Compiler configuration failed to invalidate a warmed task',
    );
    assert.ok(
      changed.every(
        (task) => task.hash !== warm.find((old) => old.id === task.id)?.hash,
      ),
      'A task retained its old configuration hash',
    );
    report.cacheTasks = { populated: first, warm, configChanged: changed };
    return `${warm.length} warmed tasks hit; changing shared compiler configuration makes all ${changed.length} tasks miss and changes their hashes.`;
  });
  await writeFile(configPath, configOriginal);
  await check('partial-stage-preservation', async () => {
    const valid =
      domainOriginal + "\nexport const feedbackStageProbe = 'staged-valid';\n";
    const invalid = valid + "\nPromise.resolve('unstaged-invalid');\n";
    await writeFile(domainPath, valid);
    mustPass(
      await run('partial-stage-add', [
        'git',
        'add',
        'packages/domain/src/index.ts',
      ]),
    );
    await writeFile(domainPath, invalid);
    mustPass(
      await run('partial-stage-commit', [
        'git',
        'commit',
        '-m',
        'Prove partial staged hook preservation',
      ]),
    );
    const committed = await run('partial-stage-committed-source', [
      'git',
      'show',
      'HEAD:packages/domain/src/index.ts',
    ]);
    mustPass(committed);
    assert.match(await text(committed), /feedbackStageProbe/);
    assert.doesNotMatch(await text(committed), /unstaged-invalid/);
    assert.equal(
      await readFile(domainPath, 'utf8'),
      invalid,
      'Hook changed or lost unstaged bytes',
    );
    const remaining = await run('partial-stage-unstaged-diff', [
      'git',
      'diff',
      '--',
      'packages/domain/src/index.ts',
    ]);
    assert.match(await text(remaining), /unstaged-invalid/);
    const lint = await run('partial-stage-remaining-invalid-feedback', [
      'bun',
      'run',
      'check:quick',
      '--',
      'packages/domain/src/index.ts',
    ]);
    assert.notEqual(lint.exitCode, 0);
    assert.match(await text(lint), /@typescript-eslint\/no-floating-promises/);
    return 'Installed hooks committed the valid staged content, excluded the invalid unstaged promise, and preserved its exact working-tree bytes.';
  });
  mustPass(
    await run('partial-stage-restore', [
      'git',
      'restore',
      '--staged',
      '--worktree',
      'packages/domain/src/index.ts',
    ]),
  );
  await check('staged-floating-promise-rejected', async () => {
    const before = await run('staged-failure-head-before', [
      'git',
      'rev-parse',
      'HEAD',
    ]);
    mustPass(before);
    const original = await readFile(domainPath, 'utf8');
    await writeFile(
      domainPath,
      original + "\nPromise.resolve('staged-invalid');\n",
    );
    mustPass(
      await run('staged-failure-add', [
        'git',
        'add',
        'packages/domain/src/index.ts',
      ]),
    );
    const result = await run('staged-floating-commit-rejected', [
      'git',
      'commit',
      '-m',
      'This floating promise must be rejected',
    ]);
    assert.notEqual(result.exitCode, 0);
    assert.match(
      await text(result),
      /@typescript-eslint\/no-floating-promises/,
    );
    const after = await run('staged-failure-head-after', [
      'git',
      'rev-parse',
      'HEAD',
    ]);
    assert.equal(
      await text(before),
      await text(after),
      'Rejected hook advanced HEAD',
    );
    const staged = await run('staged-failure-retained-diff', [
      'git',
      'diff',
      '--cached',
      '--',
      'packages/domain/src/index.ts',
    ]);
    assert.match(await text(staged), /staged-invalid/);
    assert.match(await readFile(domainPath, 'utf8'), /staged-invalid/);
    return 'The installed pre-commit hook rejects the intended rule, leaves HEAD unchanged, and retains the staged change.';
  });
} catch (error) {
  report.setupError = sanitized(
    error instanceof Error ? error.message : String(error),
  );
} finally {
  report.finishedAt = new Date().toISOString();
  report.outcome =
    !report.setupError &&
    checks.length === 6 &&
    checks.every((item) => item.outcome === 'pass')
      ? 'pass'
      : 'fail';
  await writeFile(
    join(evidence, 'report.json'),
    JSON.stringify(report, null, 2) + '\n',
  );
  await rm(directory, { recursive: true, force: true });
  console.log(
    JSON.stringify({
      outcome: report.outcome,
      checks,
      evidence: '<evidence-directory>',
    }),
  );
  if (report.outcome !== 'pass') process.exitCode = 1;
}
