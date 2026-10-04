import { describe, expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import {
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as ts from 'typescript';
import { z } from 'zod';
import {
  reviewGate,
  runAgent,
  runTrialRounds,
  orderedResults,
  serialWrites,
  seedStatusDefect,
  seedWasObserved,
  trialRounds,
  trialConcurrency,
  descendants,
  redactTrial,
  retainProject,
  retainWorkspaceEvidence,
} from '../scripts/trials';
import { foundationRoot, waitFor } from '../scripts/runtime';

function deferred() {
  let resolve: () => void = () => {
    throw new Error('Deferred was not initialized');
  };
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const delivery = {
  outcome: 'complete',
  summary: 'Delivered',
  checks: ['Observed persistence'],
  gaps: [],
  findings: [],
};
const fullScores = {
  routeIntent: { score: 2, evidence: 'Task matches the selected route.' },
  scopeOwnership: { score: 2, evidence: 'Owner denial observed in R4.' },
  supportedImplementation: {
    score: 2,
    evidence: 'Supported profile dependencies retained.',
  },
  meaningfulProof: {
    score: 2,
    evidence: 'Trusted running acceptance report passes.',
  },
  recoveryRegression: {
    score: 2,
    evidence: 'Retained before/after regression.',
  },
  accurateResult: {
    score: 2,
    evidence: 'Final report matches the observations.',
  },
};
const review = { ...delivery, scores: fullScores, authorizationDefect: false };
const completed = (final: unknown) => ({
  outcome: 'completed' as const,
  final,
});

describe('independent delivery trial gates', () => {
  test('source interpolation survives retention while actual credentials stay redacted', () => {
    const source = 'authorization: `Bearer ${runtime.tokens.mcp}`';
    expect(redactTrial(source)).toBe(source);
    const variable =
      'for (const bearer of tokens) bearer ? use(bearer) : null;';
    expect(redactTrial(variable)).toBe(variable);
    expect(redactTrial('bearer private-api-value')).toBe('Bearer [REDACTED]');
    expect(redactTrial('Bearer private-api-value')).toBe('Bearer [REDACTED]');
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop';
    expect(redactTrial(jwt)).toBe('[REDACTED JWT]');
    expect(redactTrial(`Bearer \${"${jwt}"}`)).not.toContain(jwt);
    expect(redactTrial('WORKOS_API_KEY=private-api-value')).not.toContain(
      'private-api-value',
    );
    for (const quote of ["'", '"', '`']) {
      expect(redactTrial(`${quote}WORKOS_API_KEY=private-value${quote}`)).toBe(
        `${quote}WORKOS_API_KEY=[REDACTED]${quote}`,
      );
      expect(redactTrial(`${quote}Bearer private-value${quote}`)).toBe(
        `${quote}Bearer [REDACTED]${quote}`,
      );
      expect(redactTrial(`WORKOS_API_KEY: ${quote}private-value${quote}`)).toBe(
        `WORKOS_API_KEY: ${quote}[REDACTED]${quote}`,
      );
    }
    expect(redactTrial('\\"WORKOS_API_KEY\\":\\"private-value\\"')).toBe(
      '\\"WORKOS_API_KEY\\":\\"[REDACTED]\\"',
    );
    expect(
      redactTrial(
        '-----BEGIN PRIVATE KEY-----\nprivate material\n-----END PRIVATE KEY-----',
      ),
    ).toBe('[REDACTED PRIVATE KEY]');
  });
  test('every retained foundation TypeScript file still parses and its recorded hashes match its bytes', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-source-parse-'),
    );
    try {
      await retainProject(foundationRoot, directory);
      const manifest = z
        .object({
          files: z.record(
            z.string(),
            z.object({
              originalSha256: z.string(),
              retainedSha256: z.string(),
              transformed: z.boolean(),
            }),
          ),
        })
        .parse(
          JSON.parse(
            await readFile(join(directory, 'retention.json'), 'utf8'),
          ) as unknown,
        );
      const paths: string[] = [];
      let transformed = 0;
      for (const [name, metadata] of Object.entries(manifest.files)) {
        const original = await readFile(join(foundationRoot, name));
        const retained = await readFile(join(directory, 'delivered', name));
        expect(createHash('sha256').update(original).digest('hex')).toBe(
          metadata.originalSha256,
        );
        expect(createHash('sha256').update(retained).digest('hex')).toBe(
          metadata.retainedSha256,
        );
        expect(metadata.transformed).toBe(!original.equals(retained));
        if (metadata.transformed) transformed++;
        if (/\.tsx?$/.test(name))
          paths.push(join(directory, 'delivered', name));
      }
      expect(paths.length).toBeGreaterThan(20);
      expect(transformed).toBeGreaterThan(0);
      const program = ts.createProgram(paths, {
        noEmit: true,
        noResolve: true,
        noLib: true,
        jsx: ts.JsxEmit.ReactJSX,
      });
      expect(
        program.getSyntacticDiagnostics().map((diagnostic) => ({
          file: diagnostic.file.fileName,
          position: diagnostic.start,
          message: ts.flattenDiagnosticMessageText(
            diagnostic.messageText,
            '\n',
          ),
        })),
      ).toEqual([]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('process enumeration failure retains the owned group fallback without claiming detached coverage', () => {
    const unavailable = descendants(100, () => ({
      stdout: null,
      status: null,
      error: new Error('EPERM'),
    }));
    expect(unavailable.pids).toEqual([100]);
    expect(unavailable.available).toBe(false);
    expect(unavailable.observation).toContain('EPERM');
    expect(
      descendants(100, () => {
        throw new Error('denied');
      }).available,
    ).toBe(false);
    expect(
      descendants(100, () => ({
        stdout: '100 1\n101 100\n102 101\n200 1\n',
        status: 0,
      })).pids,
    ).toEqual([102, 101, 100]);
  });
  test('creation sibling evidence is sanitized and byte provenance identifies every transformation', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-retention-test-'),
    );
    const workspace = join(directory, 'workspace'),
      retained = join(directory, 'retained');
    const hash = (text: string) =>
      createHash('sha256').update(text).digest('hex');
    try {
      await mkdir(join(workspace, 'app'), { recursive: true });
      await mkdir(join(workspace, 'evidence/node_modules'), {
        recursive: true,
      });
      const source = 'const authorization = `Bearer ${token}`;\n';
      await writeFile(join(workspace, 'app/main.ts'), source);
      const observation = 'Observed persistence. Bearer private-api-value\n';
      await writeFile(join(workspace, 'evidence/report.md'), observation);
      await writeFile(
        join(workspace, 'evidence/.env.example'),
        'private environment',
      );
      await writeFile(join(workspace, 'evidence/private.pem'), 'private key');
      await writeFile(
        join(workspace, 'evidence/node_modules/dependency.js'),
        'dependency',
      );
      await retainProject(join(workspace, 'app'), retained);
      expect(await readFile(join(retained, 'delivered/main.ts'), 'utf8')).toBe(
        source,
      );
      expect(
        JSON.parse(
          await readFile(join(retained, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        files: {
          'main.ts': {
            originalSha256: hash(source),
            retainedSha256: hash(source),
            transformed: false,
          },
        },
      });
      await retainWorkspaceEvidence(workspace, retained);
      const sibling = join(retained, 'workspace-evidence');
      const sanitized = await readFile(
        join(sibling, 'delivered/report.md'),
        'utf8',
      );
      expect(sanitized).toContain('Observed persistence');
      expect(sanitized).not.toContain('private-api-value');
      expect(
        JSON.parse(
          await readFile(join(sibling, 'retention.json'), 'utf8'),
        ) as unknown,
      ).toMatchObject({
        files: {
          'report.md': {
            originalSha256: hash(observation),
            retainedSha256: hash(sanitized),
            transformed: true,
          },
        },
      });
      for (const name of [
        '.env.example',
        'private.pem',
        'node_modules/dependency.js',
      ])
        expect(await Bun.file(join(sibling, 'delivered', name)).exists()).toBe(
          false,
        );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
  test('concurrent rounds stay bounded and preserve every round’s stage order', async () => {
    for (const value of [0, 3, 1.5, Number.NaN])
      expect(() => trialConcurrency(value)).toThrow();
    expect(trialConcurrency(1)).toBe(1);
    expect(trialConcurrency(2)).toBe(2);
    let active = 0,
      maximum = 0;
    const observed: { round: number; kind: 'creation' | 'feature' | 'bug' }[] =
      [];
    await runTrialRounds(4, 2, async (round) => {
      active += 1;
      maximum = Math.max(maximum, active);
      for (const kind of ['creation', 'feature', 'bug'] as const) {
        observed.push({ round, kind });
        await Bun.sleep(1);
      }
      active -= 1;
    });
    expect(maximum).toBe(2);
    for (let round = 1; round <= 4; round++)
      expect(
        observed
          .filter((entry) => entry.round === round)
          .map((entry) => entry.kind),
      ).toEqual(['creation', 'feature', 'bug']);
    expect(
      orderedResults(observed).map((entry) => `${entry.round}-${entry.kind}`),
    ).toEqual(
      Array.from({ length: 4 }, (_, index) =>
        ['creation', 'feature', 'bug'].map((kind) => `${index + 1}-${kind}`),
      ).flat(),
    );
    const sequential: number[] = [];
    await runTrialRounds(2, 1, async (round) => {
      sequential.push(round);
      await Bun.sleep(1);
    });
    expect(sequential).toEqual([1, 2]);
  });
  test('a failed round prevents new assignments and cleanup waits for every started round', async () => {
    const startedFirst = deferred(),
      startedSecond = deferred();
    const failFirst = deferred(),
      finishSecond = deferred();
    const started: number[] = [];
    const finished: number[] = [];
    let cleanupStarted = false;
    const running = runTrialRounds(4, 2, async (round) => {
      started.push(round);
      if (round === 1) {
        startedFirst.resolve();
        await failFirst.promise;
        throw new Error('round failed');
      }
      startedSecond.resolve();
      await finishSecond.promise;
      finished.push(round);
    }).finally(() => {
      cleanupStarted = true;
    });
    const rejection = assert.rejects(running, /round failed/);
    await Promise.all([startedFirst.promise, startedSecond.promise]);
    failFirst.resolve();
    await Bun.sleep(1);
    expect(cleanupStarted).toBe(false);
    expect(started).toEqual([1, 2]);
    finishSecond.resolve();
    await rejection;
    expect(cleanupStarted).toBe(true);
    expect(finished).toEqual([2]);
    expect(started).toEqual([1, 2]);
  });
  test('report writes cannot overlap and later writes recover after a failure', async () => {
    const enqueue = serialWrites(),
      release = deferred();
    const trace: string[] = [];
    const first = enqueue(async () => {
      trace.push('first started');
      await release.promise;
      trace.push('first finished');
      throw new Error('write failed');
    });
    const rejection = assert.rejects(first, /write failed/);
    const second = enqueue(() => {
      trace.push('second started');
      return Promise.resolve();
    });
    await Bun.sleep(1);
    expect(trace).toEqual(['first started']);
    release.resolve();
    await Promise.all([rejection, second]);
    expect(trace).toEqual([
      'first started',
      'first finished',
      'second started',
    ]);
  });
  test('a green process or a delivery claim cannot substitute for scored review', () => {
    expect(
      reviewGate(completed(delivery), completed(delivery), { outcome: 'pass' })
        .outcome,
    ).toBe('inconclusive');
    expect(
      reviewGate(completed(delivery), completed(review), { outcome: 'pass' })
        .outcome,
    ).toBe('pass');
  });
  test('failed acceptance, incomplete delivery, and unresolved authorization each prevent pass', () => {
    expect(
      reviewGate(completed(delivery), completed(review), { outcome: 'fail' })
        .outcome,
    ).toBe('fail');
    expect(
      reviewGate(
        completed({ ...delivery, outcome: 'partial' }),
        completed(review),
        { outcome: 'pass' },
      ).outcome,
    ).toBe('fail');
    expect(
      reviewGate(
        completed(delivery),
        completed({ ...review, authorizationDefect: true }),
        { outcome: 'pass' },
      ).outcome,
    ).toBe('fail');
  });
  test('the total threshold cannot hide a zero in proof or scope', () => {
    for (const dimension of ['meaningfulProof', 'scopeOwnership'] as const) {
      const scores = {
        ...fullScores,
        [dimension]: { score: 0, evidence: 'Missing required observation.' },
      };
      const gate = reviewGate(
        completed(delivery),
        completed({ ...review, scores }),
        { outcome: 'pass' },
      );
      expect(gate.total).toBe(10);
      expect(gate.outcome).toBe('fail');
    }
  });
  test('missing or out-of-range scores cannot pass; fewer than two rounds cannot run', () => {
    expect(
      reviewGate(
        completed(delivery),
        completed({
          ...review,
          scores: {
            ...fullScores,
            meaningfulProof: { score: 3, evidence: 'Claim' },
          },
        }),
        { outcome: 'pass' },
      ).outcome,
    ).toBe('inconclusive');
    for (const value of [0, 1, 2.5, Number.NaN])
      expect(() => trialRounds(value)).toThrow();
    expect(trialRounds(2)).toBe(2);
  });
  test('the maintained seed changes persisted status only and requires its running R3 failure', () => {
    const source =
      'await ctx.db.patch(args.id, { status: args.status });\nreturn { status: args.status };';
    const seeded = seedStatusDefect(source);
    expect(seeded).toContain(
      "status: args.status === 'done' ? 'open' : 'done'",
    );
    expect(seeded).toContain('return { status: args.status };');
    expect(() => seedStatusDefect(source + source)).toThrow();
    expect(
      seedWasObserved({
        outcome: 'fail',
        report: { outcome: 'fail', checks: [{ id: 'setup', outcome: 'fail' }] },
      }),
    ).toBe(false);
    expect(
      seedWasObserved({
        outcome: 'fail',
        report: { outcome: 'fail', checks: [{ id: 'R3', outcome: 'fail' }] },
      }),
    ).toBe(true);
  });
  test('fresh process accounting retains observed usage and caps a continuing action stream', async () => {
    const directory = await mkdtemp(
      join(tmpdir(), 'astack-trial-process-test-'),
    );
    const previousPath = process.env.PATH;
    try {
      const executable = join(directory, 'codex');
      await writeFile(
        executable,
        `#!/usr/bin/env bun
import { writeFileSync } from 'node:fs';
const args = process.argv;
const finalPath = args[args.indexOf('-o') + 1];
writeFileSync(new URL('invocation.json', import.meta.url).pathname, JSON.stringify(args));
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
console.log(JSON.stringify({type:'thread.started'}));
if (prompt.includes('cap-probe')) {
  console.log(JSON.stringify({type:'item.started',item:{id:'one',type:'command_execution'}}));
  setInterval(() => {}, 100);
} else if (prompt.includes('stream-probe')) {
  const event = Buffer.from(JSON.stringify({type:'item.completed',unicode:'café 🦊',note:'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJvd25lci1hIn0.abcdefghijklmnop Bearer private-token'}));
  const split = event.indexOf(Buffer.from('🦊')) + 2;
  process.stdout.write(event.subarray(0, split));
  await Bun.sleep(20);
  process.stdout.write(event.subarray(split));
  process.stdout.write('\\n');
  while (!(await Bun.file(new URL('release', import.meta.url).pathname).exists())) await Bun.sleep(10);
  writeFileSync(finalPath, JSON.stringify(${JSON.stringify(delivery)}));
  process.stdout.write(JSON.stringify({type:'turn.completed',usage:{input_tokens:20,output_tokens:5}}));
} else {
  writeFileSync(finalPath, JSON.stringify(args[args.indexOf('-s') + 1] === 'read-only' ? ${JSON.stringify(review)} : ${JSON.stringify(delivery)}));
  console.log(JSON.stringify({type:'turn.completed',usage:{input_tokens:20,output_tokens:5}}));
}
`,
      );
      await chmod(executable, 0o755);
      process.env.PATH = `${directory}:${previousPath ?? ''}`;
      const agent = await runAgent({
        cwd: directory,
        directory: join(directory, 'completed'),
        prompt: 'complete-probe',
        config: [],
        model: 'fixture-model',
        timeoutMs: 2000,
        sandbox: 'danger-full-access',
      });
      expect(agent.outcome).toBe('completed');
      expect(agent.usage).toEqual([{ input_tokens: 20, output_tokens: 5 }]);
      expect(agent.sandbox).toBe('danger-full-access');
      expect(
        JSON.parse(
          await readFile(join(directory, 'invocation.json'), 'utf8'),
        ) as unknown,
      ).toContain('danger-full-access');
      expect(
        await readFile(join(directory, 'completed/events.jsonl'), 'utf8'),
      ).toContain('turn.completed');
      await writeFile(
        join(directory, 'ps'),
        '#!/usr/bin/env bun\nprocess.stderr.write("EPERM"); process.exit(1);\n',
      );
      await chmod(join(directory, 'ps'), 0o755);
      const capped = await runAgent({
        cwd: directory,
        directory: join(directory, 'capped'),
        prompt: 'cap-probe',
        config: [],
        model: 'fixture-model',
        actionLimit: 1,
        timeoutMs: 2000,
      });
      expect(capped.outcome).toBe('inconclusive');
      expect(capped.termination).toBe('action limit');
      expect(capped.usage).toEqual([]);
      expect(capped.usageReason).toContain('unavailable');
      expect(capped.processCleanup.descendantEnumeration).toBe('limited');
      const reviewer = await runAgent({
        cwd: directory,
        directory: join(directory, 'reviewed'),
        prompt: 'review-probe',
        config: [],
        model: 'fixture-model',
        reviewer: true,
        sandbox: 'danger-full-access',
        timeoutMs: 2000,
      });
      expect(reviewer.sandbox).toBe('read-only');
      expect(
        JSON.parse(
          await readFile(join(directory, 'invocation.json'), 'utf8'),
        ) as unknown,
      ).toContain('read-only');
      let streamingFinished = false;
      const streaming = runAgent({
        cwd: directory,
        directory: join(directory, 'streamed'),
        prompt: 'stream-probe',
        config: [],
        model: 'fixture-model',
        timeoutMs: 2000,
      }).then((result) => {
        streamingFinished = true;
        return result;
      });
      try {
        const live = await waitFor(
          async () => {
            const text = await readFile(
              join(directory, 'streamed/events.jsonl'),
              'utf8',
            );
            return text.includes('[REDACTED JWT]') ? text : false;
          },
          'redacted live JSONL',
          1000,
        );
        expect(streamingFinished).toBe(false);
        expect(live).toContain('Bearer [REDACTED]');
        expect(live).toContain('café 🦊');
        expect(live).not.toContain('abcdefghijklmnop');
        expect(live).not.toContain('private-token');
      } finally {
        await writeFile(join(directory, 'release'), 'continue');
        await streaming;
      }
      const retained = await readFile(
        join(directory, 'streamed/events.jsonl'),
        'utf8',
      );
      expect(retained).toContain('turn.completed');
      expect(retained).toContain('café 🦊');
      expect(retained.endsWith('\n')).toBe(false);
      expect(retained).not.toContain('private-token');
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
