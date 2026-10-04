import { describe, expect, test } from 'bun:test';
import { chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  reviewGate,
  runAgent,
  seedStatusDefect,
  seedWasObserved,
  trialRounds,
} from '../scripts/trials';

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
let prompt = '';
for await (const chunk of process.stdin) prompt += chunk;
console.log(JSON.stringify({type:'thread.started'}));
if (prompt.includes('cap-probe')) {
  console.log(JSON.stringify({type:'item.started',item:{id:'one',type:'command_execution'}}));
  setInterval(() => {}, 100);
} else {
  writeFileSync(finalPath, JSON.stringify(${JSON.stringify(delivery)}));
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
      });
      expect(agent.outcome).toBe('completed');
      expect(agent.usage).toEqual([{ input_tokens: 20, output_tokens: 5 }]);
      expect(
        await readFile(join(directory, 'completed/events.jsonl'), 'utf8'),
      ).toContain('turn.completed');
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
    } finally {
      if (previousPath === undefined) delete process.env.PATH;
      else process.env.PATH = previousPath;
      await rm(directory, { recursive: true, force: true });
    }
  });
});
