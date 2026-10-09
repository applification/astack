import { afterAll, expect, test } from 'bun:test';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { z } from 'zod';
import { checkNotebook, verifyEvidence } from '../scripts/agent-eval-check';
import { initNotebook, json, type Task } from '../scripts/agent-eval-fixture';
import {
  blindText,
  conditionConfig,
  runComparison,
} from '../scripts/agent-eval-run';

const root = await mkdtemp(join(tmpdir(), 'agent-evals-tests-'));
const observationReport = z.object({
  checks: z.array(
    z.object({
      id: z.string(),
      actual: z.unknown(),
      expected: z.unknown(),
      outcome: z.string(),
    }),
  ),
});
const dispatchSchema = z.object({
  args: z.array(z.string()),
  prompt: z.string(),
  pid: z.number(),
});
const manifestSchema = z.object({
  attempts: z.array(z.object({ state: z.string() })),
  stats: z.object({
    planned: z.number(),
    pass: z.number(),
    fail: z.number(),
    inconclusive: z.number(),
    notRun: z.number(),
    unfinished: z.number(),
  }),
});
const packetSchema = z
  .object({
    label: z.string(),
    userIntent: z.string(),
    source: z.record(z.string(), z.string()),
    diff: z.string(),
    craftsmanshipRubric: z.string(),
  })
  .strict();
afterAll(async () => {
  await rm(root, { recursive: true, force: true });
});
let serial = 0;
async function project() {
  return initNotebook(join(root, `project-${++serial}`));
}
const output = () => join(root, `evidence-${++serial}`);
async function edit(project: string, transform: (source: string) => string) {
  const path = join(project, 'server.ts');
  await writeFile(path, transform(await readFile(path, 'utf8')));
}
async function rejection(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return 'unexpected success';
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}
const titleBranch = `if (Object.keys(body).join(',') === 'title' && title(body.title)) {
        note.originalCreateTitle ??= note.title;
        note.title = body.title.trim(); saveNotes(notes); return response({ note: publicNote(note) });
      }
      `;
const addTitle = (source: string) =>
  source
    .replace(
      'operationId: string;',
      'operationId: string; originalCreateTitle?: string;',
    )
    .replace(
      "typeof value.operationId === 'string'",
      "typeof value.operationId === 'string' && (value.originalCreateTitle === undefined || typeof value.originalCreateTitle === 'string')",
    )
    .replace(
      'previous.title === body.title.trim()',
      '(previous.originalCreateTitle ?? previous.title) === body.title.trim()',
    )
    .replace(
      /if\s*\(\s*Object\.keys\(body\)\.join\(','\) !== 'done'/,
      titleBranch + "if (Object.keys(body).join(',') !== 'done'",
    );
const fixBug = (source: string) =>
  source.replace('note.done = !body.done;', 'note.done = body.done;');
const addArchive = (source: string) =>
  source
    .replace(
      'note.actor === actor)',
      "note.actor === actor && (!note.archived || new URL(request.url).searchParams.get('includeArchived') === 'true'))",
    )
    .replace(
      /if\s*\(\s*Object\.keys\(body\)\.join\(','\) !== 'done'/,
      "if (Object.keys(body).join(',') === 'archived' && typeof body.archived === 'boolean') {note.archived = body.archived; saveNotes(notes); return response({note: publicNote(note)});}\n      if (Object.keys(body).join(',') !== 'done'",
    );

test('seeded status inversion fails original persistence case; exact correction passes', async () => {
  const repo = await project();
  const red = await checkNotebook({
    project: repo,
    task: 'bug',
    output: output(),
  });
  expect(red.outcome).toBe('fail');
  const dir = output();
  await edit(repo, fixBug);
  const green = await checkNotebook({
    project: repo,
    task: 'bug',
    output: dir,
  });
  expect(green.outcome).toBe('pass');
  expect(await verifyEvidence(dir, green)).toBe('pass');
  const observations = observationReport.parse(
    JSON.parse(await readFile(join(dir, 'observations.json'), 'utf8')),
  );
  expect(
    observations.checks.find(
      (check: { id: string }) => check.id === 'requested-change',
    ),
  ).toEqual({
    id: 'requested-change',
    actual: {
      status: 200,
      body: {
        note: {
          id: 'own-seeded',
          title: 'Plan the weekend',
          done: true,
          archived: false,
        },
      },
    },
    expected: {
      status: 200,
      body: {
        note: {
          id: 'own-seeded',
          title: 'Plan the weekend',
          done: true,
          archived: false,
        },
      },
    },
    outcome: 'pass',
  });
  expect(
    observations.checks.find(
      (check: { id: string }) => check.id === 'restart-change',
    )?.outcome,
  ).toBe('pass');
}, 15000);

test('missing feature fails; title-only correction passes while seeded bug remains', async () => {
  const repo = await project();
  expect(
    (await checkNotebook({ project: repo, task: 'feature', output: output() }))
      .outcome,
  ).toBe('fail');
  await edit(repo, addTitle);
  expect(
    (await checkNotebook({ project: repo, task: 'feature', output: output() }))
      .outcome,
  ).toBe('pass');
  expect(
    (await checkNotebook({ project: repo, task: 'bug', output: output() }))
      .outcome,
  ).toBe('fail');
}, 15000);

test('title edits preserve completed status and reject a reassuring status-reset repair', async () => {
  const repo = await project();
  await edit(repo, (source) =>
    addTitle(source).replace(
      'note.title = body.title.trim();',
      'note.done = false; note.title = body.title.trim();',
    ),
  );
  const badOutput = output();
  expect(
    (await checkNotebook({ project: repo, task: 'feature', output: badOutput }))
      .outcome,
  ).toBe('fail');
  const observed = observationReport.parse(
    JSON.parse(await readFile(join(badOutput, 'observations.json'), 'utf8')),
  );
  expect(
    observed.checks.find(
      (check) => check.id === 'completed-title-preserves-status',
    )?.outcome,
  ).toBe('fail');
  expect(
    observed.checks.find((check) => check.id === 'completed-title-restart')
      ?.outcome,
  ).toBe('fail');
  await edit(repo, (source) =>
    source.replace(
      'note.done = false; note.title = body.title.trim();',
      'note.title = body.title.trim();',
    ),
  );
  expect(
    (await checkNotebook({ project: repo, task: 'feature', output: output() }))
      .outcome,
  ).toBe('pass');
});

test('title edits preserve original create identity across restart with compatible metadata', async () => {
  const repo = await project();
  await edit(repo, (source) =>
    addTitle(source).replace(
      '(previous.originalCreateTitle ?? previous.title) === body.title.trim()',
      'previous.title === body.title.trim()',
    ),
  );
  const badOutput = output();
  expect(
    (await checkNotebook({ project: repo, task: 'feature', output: badOutput }))
      .outcome,
  ).toBe('fail');
  const bad = observationReport.parse(
    JSON.parse(await readFile(join(badOutput, 'observations.json'), 'utf8')),
  );
  for (const id of [
    'edited-legacy-create-retry-restart',
    'edited-new-create-retry-restart',
    'edited-new-create-conflict-restart',
  ])
    expect(bad.checks.find((check) => check.id === id)?.outcome).toBe('fail');
  await edit(repo, (source) =>
    source.replace(
      'previous.title === body.title.trim()',
      '(previous.originalCreateTitle ?? previous.title) === body.title.trim()',
    ),
  );
  const goodOutput = output();
  const goodReport = await checkNotebook({
    project: repo,
    task: 'feature',
    output: goodOutput,
  });
  expect(goodReport.outcome).toBe('pass');
  expect(await verifyEvidence(goodOutput, goodReport)).toBe('pass');
  const persisted = z
    .object({
      disk: z.array(z.object({ phase: z.string(), bytes: z.string() })),
    })
    .parse(
      JSON.parse(await readFile(join(goodOutput, 'observations.json'), 'utf8')),
    );
  const disk = z
    .object({
      notes: z.array(
        z.object({
          id: z.string(),
          originalCreateTitle: z.string().optional(),
        }),
      ),
    })
    .parse(
      JSON.parse(
        z
          .string()
          .parse(
            persisted.disk.find((entry) => entry.phase === 'final-restart')
              ?.bytes,
          ),
      ),
    );
  expect(
    disk.notes.find((note) => note.id === 'own-seeded')?.originalCreateTitle,
  ).toBe('Plan the weekend');
  expect(
    disk.notes.find((note) => note.id === 'adjacent-seeded')
      ?.originalCreateTitle,
  ).toBe('Keep this note');
}, 15000);

test('maintenance archive/restore requires list hiding, restart and preserved neighbors', async () => {
  const repo = await project();
  expect(
    (await checkNotebook({ project: repo, task: 'followup', output: output() }))
      .outcome,
  ).toBe('fail');
  await edit(repo, addArchive);
  expect(
    (await checkNotebook({ project: repo, task: 'followup', output: output() }))
      .outcome,
  ).toBe('pass');
}, 15000);

test('unseen invalid inputs, ownership and retry operations reject plausible wrong repairs', async () => {
  for (const wrong of [
    (source: string) =>
      fixBug(source).replace(/&&\s*entry.actor === actor/, ''),
    (source: string) =>
      fixBug(source).replace(
        /Object\.keys\(body\)\.join\(','\) !== 'done' \|\|\s*typeof body.done !== 'boolean'/,
        "typeof body.done !== 'boolean'",
      ),
    (source: string) =>
      fixBug(source).replace('if (previous)', 'if (false && previous)'),
    (source: string) =>
      fixBug(source).replace(
        'note.actor === actor && note.operationId',
        'note.operationId',
      ),
    (source: string) =>
      fixBug(source).replace(
        'note.done = body.done;',
        'for (const row of notes) row.done = body.done;',
      ),
    (source: string) =>
      addTitle(source).replace(
        'value.trim().length <= 120',
        'value.trim().length <= 1000',
      ),
  ]) {
    const repo = await project();
    await edit(repo, wrong);
    const report = await checkNotebook({
      project: repo,
      task: (await readFile(join(repo, 'server.ts'), 'utf8')).includes(
        'note.title =',
      )
        ? 'feature'
        : 'bug',
      output: output(),
    });
    expect(report.outcome).toBe('fail');
  }
}, 30000);

test('unavailable service and source/config tampering are inconclusive, with retained artifacts', async () => {
  const repo = await project();
  await writeFile(join(repo, 'server.ts'), 'process.exit(1);');
  const dir = output();
  const unavailable = await checkNotebook({
    project: repo,
    task: 'bug',
    output: dir,
    startupMs: 200,
  });
  expect(unavailable.outcome).toBe('inconclusive');
  expect(await verifyEvidence(dir, unavailable)).toBe('inconclusive');
  const second = await project();
  await edit(
    second,
    (source) =>
      "import {writeFileSync as tamper} from 'node:fs';\ntamper('AGENTS.md', 'changed during check');\n" +
      fixBug(source),
  );
  const report = await checkNotebook({
    project: second,
    task: 'bug',
    output: output(),
  });
  expect(report.outcome).toBe('inconclusive');
  expect(report.error).toBe(
    'Delivered source/configuration or fixed suite changed during checking',
  );
}, 15000);

test('hashed artifact inspection cannot pass after observation/report tampering', async () => {
  const repo = await project();
  await edit(repo, fixBug);
  const dir = output();
  const report = await checkNotebook({
    project: repo,
    task: 'bug',
    output: dir,
  });
  expect(report.outcome).toBe('pass');
  await writeFile(join(dir, 'observations.json'), '{}');
  expect(await verifyEvidence(dir, report)).toBe('inconclusive');
  await writeFile(
    join(dir, 'report.json'),
    json({ ...report, observationsSha256: 'forged' }),
  );
  expect(await verifyEvidence(dir, report)).toBe('inconclusive');
}, 15000);

test('existing repo/output is refused and nested evidence cannot be written', async () => {
  const repo = await project();
  expect(await rejection(() => initNotebook(repo))).toContain('EEXIST');
  const dir = output();
  await mkdir(dir);
  expect(
    await rejection(() =>
      checkNotebook({ project: repo, task: 'bug', output: dir }),
    ),
  ).toContain('EEXIST');
  expect(
    await rejection(() =>
      checkNotebook({
        project: repo,
        task: 'bug',
        output: join(repo, 'evidence'),
      }),
    ),
  ).toContain('outside');
  expect(await readFile(join(repo, 'README.md'), 'utf8')).toContain(
    'Local notebook',
  );
});

async function fakeCodex(
  mode: string,
  fn: (directory: string) => Promise<void>,
) {
  const directory = join(root, `fake-${++serial}`);
  await mkdir(directory);
  const binary = join(directory, 'codex');
  await writeFile(
    binary,
    `#!${process.execPath}
import {cpSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const args = process.argv.slice(2);
if (args.includes('--version')) {console.log('codex-cli fake-boundary'); process.exit(0);}
if (args[0] === 'debug') {console.log(args.includes('--help') ? '--bundled' : JSON.stringify({models:[{slug:'test-model-only'}]})); process.exit(0);}
if (args.includes('--help')) {console.log('--ignore-user-config --output-schema --json --model'); process.exit(0);}
const config = args.find(x => x.startsWith('marketplaces={'));
const match = config?.match(/^marketplaces=\\{("[^"]+")=\\{source_type="local",source=("[^"]+")\\}\\}$/);
if (args[0] === 'plugin') {
 if (process.env.FAKE_CODEX_MODE === 'setup-failure' && args[1] === 'add') {console.error('install unavailable'); process.exit(1);}
 if (args[1] === 'add' && match) {
  const destination = join(process.env.CODEX_HOME, 'plugins/cache', JSON.parse(match[1]), 'applification', 'test');
  mkdirSync(destination, {recursive:true}); cpSync(JSON.parse(match[2]), destination, {recursive:true});
 }
 console.log('{}'); process.exit(0);
}
let prompt = ''; for await (const chunk of process.stdin) prompt += chunk;
writeFileSync(join(process.env.FAKE_RECORD_DIR, 'dispatch-' + Date.now() + '.json'), JSON.stringify({args,prompt,pid:process.pid}));
console.log(JSON.stringify({type:'thread.started',thread_id:'fake'}));
if (process.env.FAKE_CODEX_MODE === 'action-limit') {for (let i=0;i<10;i++) console.log(JSON.stringify({type:'item.started',item:{id:String(i),type:'command_execution'}}));}
if (['timeout', 'interrupt', 'action-limit'].includes(process.env.FAKE_CODEX_MODE)) {await Bun.sleep(10000); process.exit(0);}
const cwd = args[args.indexOf('-C') + 1], file = join(cwd, 'server.ts');
writeFileSync(file, readFileSync(file,'utf8').replace('note.done = !body.done;', 'note.done = body.done;'));
writeFileSync(join(cwd, 'report.json'), JSON.stringify({model:'test-model-only',acceptance:'pass',agentScore:99}));
spawnSync('git', ['add', '--intent-to-add', 'report.json'], {cwd});
if (process.env.FAKE_CODEX_MODE === 'startup-failure' && args.some(x => x.startsWith('plugins={') && x !== 'plugins={}')) console.error('failed to load plugin: fake negative control');
writeFileSync(args[args.indexOf('-o') + 1], JSON.stringify({outcome:'complete',summary:'Done',checks:['local'],gaps:[],findings:[]}));
console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:1,output_tokens:1}}));
`,
  );
  await chmod(binary, 0o755);
  const old = {
    PATH: process.env.PATH,
    CODEX_HOME: process.env.CODEX_HOME,
    FAKE_CODEX_MODE: process.env.FAKE_CODEX_MODE,
    FAKE_RECORD_DIR: process.env.FAKE_RECORD_DIR,
  };
  process.env.PATH = `${directory}:${old.PATH ?? ''}`;
  process.env.CODEX_HOME = join(directory, 'home');
  process.env.FAKE_CODEX_MODE = mode;
  process.env.FAKE_RECORD_DIR = directory;
  try {
    await fn(directory);
  } finally {
    for (const [key, value] of Object.entries(old)) {
      if (value === undefined) Reflect.deleteProperty(process.env, key);
      else process.env[key] = value;
    }
  }
}
const runOptions = () => ({
  candidate: '0ff54b0a15ab58fe5353f55175d5a9a62a28bbc5',
  baseline: 'plain',
  model: 'test-model-only',
  tasks: ['bug'] satisfies Task[],
  repeats: 2,
  output: output(),
  timeoutMs: 2000,
  actionLimit: 10,
  reasoning: 'low',
});

test('real runAgent boundary retains all attempts, alternates order, isolates prompt/config and blinds packets', async () => {
  await fakeCodex('complete', async (fake) => {
    const options = runOptions();
    const report = await runComparison(options);
    expect(report.stats).toEqual({
      planned: 4,
      pass: 4,
      fail: 0,
      inconclusive: 0,
      notRun: 0,
      unfinished: 0,
    });
    expect(report.attempts.map((a) => a.condition)).toEqual([
      'baseline',
      'candidate',
      'candidate',
      'baseline',
    ]);
    const { readdir } = await import('node:fs/promises');
    const calls = await Promise.all(
      (await readdir(fake))
        .filter((name) => name.startsWith('dispatch-'))
        .sort()
        .map(async (name) =>
          dispatchSchema.parse(
            JSON.parse(await readFile(join(fake, name), 'utf8')),
          ),
        ),
    );
    expect(calls.length).toBe(4);
    expect(new Set(calls.map((call) => call.prompt)).size).toBe(2);
    const [first, second] = calls;
    if (!first || !second) throw new Error('Missing dispatch records');
    expect(second.prompt).toBe('$applification:astack ' + first.prompt);
    expect(first.prompt).toContain('local-only');
    expect(first.prompt).toContain(
      'no publishing, cloud deployment, remote operations or pull request',
    );
    const promptRecords = z
      .array(
        z.object({
          task: z.string(),
          userGoal: z.string(),
          baseline: z.object({ text: z.string(), sha256: z.string() }),
          candidate: z.object({ text: z.string(), sha256: z.string() }),
        }),
      )
      .parse(
        JSON.parse(
          await readFile(join(options.output, 'prompts.json'), 'utf8'),
        ),
      );
    expect(promptRecords[0]?.baseline.text).toBe(first.prompt);
    expect(promptRecords[0]?.candidate.text).toBe(second.prompt);
    expect(report.treatment).toContain('invocation difference');
    expect(
      z.object({ requestedModelListed: z.boolean() }).parse(report.modelCatalog)
        .requestedModelListed,
    ).toBe(true);
    expect(
      JSON.parse(
        await readFile(join(options.output, 'bundled-models.json'), 'utf8'),
      ),
    ).toEqual({ models: [{ slug: 'test-model-only' }] });
    expect(first.args).toContain('plugins={}');
    expect(first.args).toContain('--ignore-user-config');
    expect(first.args[first.args.indexOf('-m') + 1]).toBe('test-model-only');
    expect(
      second.args.some(
        (arg: string) =>
          arg.startsWith('plugins={') && arg.includes('enabled=true'),
      ),
    ).toBe(true);
    const packetNames = await readdir(join(options.output, 'review-packets'));
    expect(packetNames.length).toBe(4);
    const packet = packetSchema.parse(
      JSON.parse(
        await readFile(
          join(options.output, 'review-packets', packetNames[0] ?? ''),
          'utf8',
        ),
      ),
    );
    expect(Object.keys(packet).sort()).toEqual([
      'craftsmanshipRubric',
      'diff',
      'label',
      'source',
      'userIntent',
    ]);
    expect(JSON.stringify(packet)).not.toMatch(
      /test-model-only|0ff54b0a|agent-eval-|applification|astack|notebook-comparison-/i,
    );
    expect(Object.keys(packet.source)).not.toContain('report.json');
    expect(packet.diff).not.toContain('report.json');
    expect(JSON.stringify(packet)).not.toContain('agentScore');
    expect(report.quality).toContain('unassessed');
    expect(
      await readFile(
        join(options.output, 'private-label-mapping.json'),
        'utf8',
      ),
    ).toContain('attemptId');
  });
}, 30000);

test('a commit baseline explicitly invokes the same skill as candidate and pins the five-dimension rubric', async () => {
  await fakeCodex('complete', async (fake) => {
    const options = runOptions();
    options.baseline = options.candidate;
    options.repeats = 1;
    const report = await runComparison(options);
    expect(report.stats).toEqual({
      planned: 2,
      pass: 2,
      fail: 0,
      inconclusive: 0,
      notRun: 0,
      unfinished: 0,
    });
    const { readdir } = await import('node:fs/promises');
    const calls = await Promise.all(
      (await readdir(fake))
        .filter((name) => name.startsWith('dispatch-'))
        .sort()
        .map(async (name) =>
          dispatchSchema.parse(
            JSON.parse(await readFile(join(fake, name), 'utf8')),
          ),
        ),
    );
    expect(
      calls.map((call) => call.prompt.startsWith('$applification:astack ')),
    ).toEqual([true, true]);
    expect(new Set(calls.map((call) => call.prompt)).size).toBe(1);
    const rubric = await readFile(
      join(options.output, 'craftsmanship-rubric.md'),
      'utf8',
    );
    for (const dimension of [
      'Types and boundaries',
      'Ownership and effects',
      'Simplicity and readability',
      'Test strength',
      'Scope and changeability',
    ])
      expect(rubric).toMatch(new RegExp(`\\|\\s+${dimension}\\s+\\|`));
    expect(report.taskInterpretation).toContain('independent archive task');
  });
}, 15000);

test('fatal plugin setup preserves complete planned denominator without fake success', async () => {
  await fakeCodex('setup-failure', async () => {
    const options = runOptions();
    const report = await runComparison(options);
    expect(report.stats).toEqual({
      planned: 4,
      pass: 0,
      fail: 0,
      inconclusive: 0,
      notRun: 4,
      unfinished: 0,
    });
    expect(report.fatalError).toContain('install unavailable');
    const retained = manifestSchema.parse(
      JSON.parse(await readFile(join(options.output, 'manifest.json'), 'utf8')),
    );
    expect(retained.attempts.map((a: { state: string }) => a.state)).toEqual([
      'not-run',
      'not-run',
      'not-run',
      'not-run',
    ]);
  });
}, 15000);

test('interrupted parent leaves running and planned attempts in the persisted denominator', async () => {
  await fakeCodex('interrupt', async (fake) => {
    const options = runOptions();
    const child = spawn(
      process.execPath,
      [
        join(import.meta.dir, '../scripts/agent-evals.ts'),
        'run',
        '--candidate',
        options.candidate,
        '--baseline',
        'plain',
        '--model',
        options.model,
        '--tasks',
        'bug',
        '--repeats',
        '2',
        '--output',
        options.output,
      ],
      { env: process.env, stdio: 'ignore' },
    );
    let agentPid: number | null = null,
      projectPath: string | null = null;
    try {
      const { readdir } = await import('node:fs/promises');
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        const name = (await readdir(fake)).find((name) =>
          name.startsWith('dispatch-'),
        );
        if (name) {
          const call = dispatchSchema.parse(
            JSON.parse(await readFile(join(fake, name), 'utf8')),
          );
          agentPid = call.pid;
          projectPath = call.args[call.args.indexOf('-C') + 1] ?? null;
          break;
        }
        await Bun.sleep(25);
      }
      expect(typeof agentPid).toBe('number');
      child.kill('SIGKILL');
      await new Promise<void>((done) => {
        child.once('close', () => {
          done();
        });
      });
      const manifest = manifestSchema.parse(
        JSON.parse(
          await readFile(join(options.output, 'manifest.json'), 'utf8'),
        ),
      );
      expect(manifest.attempts.map((a: { state: string }) => a.state)).toEqual([
        'running',
        'planned',
        'planned',
        'planned',
      ]);
      expect(manifest.stats).toEqual({
        planned: 4,
        pass: 0,
        fail: 0,
        inconclusive: 0,
        notRun: 0,
        unfinished: 4,
      });
    } finally {
      child.kill('SIGKILL');
      if (agentPid) {
        try {
          process.kill(-agentPid, 'SIGKILL');
        } catch {}
      }
      if (projectPath)
        await rm(join(projectPath, '..'), { recursive: true, force: true });
    }
  });
}, 15000);

test('timeout and plugin startup failures remain inconclusive even when behavior passes', async () => {
  for (const mode of ['timeout', 'action-limit', 'startup-failure'])
    await fakeCodex(mode, async () => {
      const options = { ...runOptions(), repeats: 1, timeoutMs: 200 };
      const report = await runComparison(options);
      expect(report.stats.planned).toBe(2);
      expect(report.stats.pass).toBe(mode === 'startup-failure' ? 1 : 0);
      expect(report.stats.inconclusive).toBe(
        mode === 'startup-failure' ? 1 : 2,
      );
    });
}, 30000);

test('explicit configuration and blinding keep condition identities out of review text', () => {
  expect(conditionConfig()).toEqual([
    '-c',
    'marketplaces={}',
    '-c',
    'plugins={}',
    '-c',
    'sandbox_workspace_write.exclude_tmpdir_env_var=true',
    '-c',
    'sandbox_workspace_write.exclude_slash_tmp=true',
  ]);
  expect(
    blindText('GPT-6 codex /tmp/secret/workfile candidate deadbeef', [
      'deadbeef',
    ]),
  ).toBe(
    '[model withheld] [tool identity withheld] [workspace withheld] candidate [identity withheld]',
  );
});
