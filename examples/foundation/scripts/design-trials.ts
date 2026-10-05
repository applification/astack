import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { command, foundationRoot, redact } from './runtime';
import { designProof } from './design-proof';
import { verify } from './readiness';
import { sourceDigest } from './source-identity';
import {
  fileDigests,
  installedCandidate,
  retainProject,
  reviewGate,
  runAgent,
} from './trials';

/** Two fresh creation trials for the design contract; does not rescore historical F8 deliveries. */
async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      candidate: { type: 'string' },
      output: { type: 'string' },
      model: { type: 'string' },
      reasoning: { type: 'string' },
      rubric: { type: 'string' },
      concurrency: { type: 'string', default: '1' },
    },
  });
  assert.ok(
    values.candidate && values.output && values.model && values.rubric,
    'Usage: design-trials.ts --candidate COMMIT --output NEW_DIRECTORY --model CONFIGURED_MODEL --rubric FILE [--reasoning EFFORT]',
  );
  const repo = resolve(foundationRoot, '../..');
  const candidate = (
    await command(['git', 'rev-parse', `${values.candidate}^{commit}`], repo)
  ).trim();
  const output = resolve(values.output);
  await mkdir(output);
  const rubric = await readFile(resolve(values.rubric), 'utf8');
  const rubricPath = resolve(values.rubric).slice(repo.length + 1);
  assert.equal(
    await command(['git', 'show', `${candidate}:${rubricPath}`], repo),
    rubric,
    'Rubric must be committed with the candidate',
  );
  await writeFile(join(output, 'rubric.md'), rubric);
  const temporary = await mkdtemp(join(tmpdir(), 'astack-design-trials-'));
  const snapshot = join(temporary, 'candidate');
  await mkdir(snapshot);
  const archive = join(temporary, 'candidate.tar');
  await command(
    ['git', 'archive', '--format=tar', '--output', archive, candidate],
    repo,
  );
  await command(['tar', '-xf', archive, '-C', snapshot], repo);
  await writeFile(
    join(snapshot, '.astack/candidate-revision'),
    candidate + '\n',
  );
  const marketplace = `astack-design-${candidate.slice(0, 8)}-${Date.now()}`;
  await writeFile(
    join(snapshot, '.agents/plugins/marketplace.json'),
    JSON.stringify({
      name: marketplace,
      plugins: [
        {
          name: 'applification',
          source: { source: 'local', path: './' },
          policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
        },
      ],
    }),
  );
  const config = [
    '-c',
    `marketplaces.${marketplace}.source_type="local"`,
    '-c',
    `marketplaces.${marketplace}.source=${JSON.stringify(snapshot)}`,
    '-c',
    `plugins={"applification@${marketplace}"={enabled=true}}`,
  ];
  const summary = {
    format: 'astack-design-creation-trials/v1',
    candidate,
    rubricSha256: createHash('sha256').update(rubric).digest('hex'),
    model: values.model,
    reasoning: values.reasoning ?? null,
    humanInterventions: 0,
    monetaryCost: null,
    startedAt: new Date().toISOString(),
    finishedAt: '',
    outcome: 'inconclusive',
    cleanup: 'pending',
    rounds: [] as unknown[],
  };
  let installed = false;
  try {
    const expected = await fileDigests(snapshot);
    await command(
      [
        'codex',
        'plugin',
        'add',
        `applification@${marketplace}`,
        '--json',
        ...config,
      ],
      snapshot,
    );
    installed = true;
    const actual = await installedCandidate(marketplace, expected);
    await command(
      ['bun', 'install', '--frozen-lockfile'],
      join(snapshot, 'examples/foundation'),
    );
    await writeFile(
      join(output, 'candidate.json'),
      JSON.stringify(
        {
          candidate,
          marketplace,
          installedDigest: actual.digest,
          installedFiles: actual.files,
          profileSha256: await sourceDigest(
            join(snapshot, 'examples/foundation'),
          ),
          versions: {
            codex: (await command(['codex', '--version'], repo)).trim(),
            bun: Bun.version,
            node: process.version,
          },
          deliverySandbox: 'danger-full-access',
          reviewerSandbox: 'read-only',
          isolation:
            'Fresh ephemeral CLI processes, ignored user config, exact installed candidate, two separate disposable Git workspaces; candidate exports/spec available and no Pen write connector provisioned in the isolated CLI.',
        },
        null,
        2,
      ) + '\n',
    );
    const runRound = async (round: number) => {
      const workspace = join(temporary, `round-${round}`),
        directory = join(output, `round-${round}`);
      await mkdir(workspace);
      await mkdir(directory);
      await command(['git', 'init'], workspace);
      await command(
        [
          'git',
          '-c',
          'user.name=astack trial',
          '-c',
          'user.email=trial@invalid.example',
          'commit',
          '--allow-empty',
          '-m',
          'Empty design creation workspace',
        ],
        workspace,
      );
      const baseline = (
        await command(['git', 'rev-parse', 'HEAD'], workspace)
      ).trim();
      const project = join(workspace, 'app');
      const task = `Create the supported foundation in app/ using ${join(snapshot, 'scripts/create-foundation.ts')}. Its reference UI was implemented from Pen. Treat app/.astack/design/work-items.pen as an opaque editable design source: do not read it with text/file tools. Read the design record and MCP-exported spec.json, inspect at least the desktop and narrow PNG frames with image tools, and identify their frame IDs before judging the UI. Install the frozen lock; verify the generated project with check:ci, design:verify and readiness. Inspect the rendered screenshots against the chosen design frames. Preserve the design, proof commands, auth/ownership and shared UI boundaries. Retain source and evidence; a correct reference can be copied without inventing an unnecessary feature.`;
      console.log(`Round ${round}: fresh design-aware creation started.`);
      const agent = await runAgent({
        cwd: workspace,
        directory: join(directory, 'delivery'),
        config,
        model: values.model ?? '',
        reasoning: values.reasoning,
        sandbox: 'danger-full-access',
        prompt: `$applification:astack ${task}\n\nAuthorized disposable local trial. Do not publish, push, merge, contact anyone, recursively delegate, inspect the evaluator rubric or weaken/change the design specification or proof commands. The caller enforces 20 minutes and 80 tool actions. Report actual results and live WorkOS/installed ChatGPT gaps. Return structured final output.`,
      });
      console.log(
        `Round ${round}: delivery ended; trusted acceptance started.`,
      );
      let acceptance: unknown;
      let outcome = 'inconclusive';
      try {
        const startup = await readFile(
          join(directory, 'delivery/stderr.log'),
          'utf8',
        );
        assert.ok(
          !(
            startup.includes('failed to load plugin') &&
            startup.includes(marketplace)
          ),
          'Candidate plugin failed to load in the delivery process',
        );
        const design = await designProof({
          projectRoot: project,
          evidence: join(directory, 'trusted-design'),
        });
        const readiness = await verify({
          projectRoot: project,
          evidenceDirectory: join(directory, 'trusted-readiness'),
        });
        const exactDesign = await fileDigests(
          join(snapshot, 'examples/foundation/.astack/design'),
        );
        assert.deepEqual(
          await fileDigests(join(project, '.astack/design')),
          exactDesign,
          'Selected design was changed',
        );
        assert.equal(
          await readFile(join(project, 'scripts/design-proof.ts'), 'utf8'),
          await readFile(
            join(snapshot, 'examples/foundation/scripts/design-proof.ts'),
            'utf8',
          ),
          'Design verifier was changed',
        );
        outcome =
          design.outcome === 'pass' && readiness.outcome === 'pass'
            ? 'pass'
            : 'fail';
        acceptance = { outcome, design, readiness };
      } catch (error) {
        acceptance = { outcome, error: redact(String(error)) };
      }
      await writeFile(
        join(directory, 'acceptance.json'),
        JSON.stringify(acceptance, null, 2) + '\n',
      );
      const hashes = await retainProject(
        project,
        join(directory, 'project'),
        true,
      );
      await writeFile(
        join(directory, 'source-hashes.json'),
        JSON.stringify(hashes, null, 2) + '\n',
      );
      const reviewer = await runAgent({
        cwd: workspace,
        directory: join(directory, 'review'),
        config,
        model: values.model ?? '',
        reasoning: values.reasoning,
        reviewer: true,
        prompt: `Independently review the generated app against ${baseline}. Intended task:\n${task}\n\nPredeclared rubric:\n${rubric}\n\nTrusted acceptance:\n${JSON.stringify(acceptance)}\n\nDelivery report:\n${JSON.stringify(agent.final)}\n\nInspect the original Pen-exported frames in app/.astack/design/frames and the rendered media in ${directory}. Inspect relevant source and actual raw delivery events at ${join(directory, 'delivery/events.jsonl')}, including whether the agent consumed the selected design. Do not read .pen with text/file tools. Score the six schema dimensions 0–2 with concrete evidence. Do not edit, publish, delegate or contact anyone. Mark authorizationDefect for an unresolved authorization defect. Return complete when your independent review is complete, even if the delivery fails.`,
      });
      const reviewStartup = await readFile(
        join(directory, 'review/stderr.log'),
        'utf8',
      );
      if (
        reviewStartup.includes('failed to load plugin') &&
        reviewStartup.includes(marketplace)
      )
        outcome = 'inconclusive';
      const gate = reviewGate(agent, reviewer, {
        outcome: outcome as 'pass' | 'fail' | 'inconclusive',
      });
      const result = {
        round,
        gate,
        delivery: agent,
        review: reviewer,
        acceptance: 'acceptance.json',
      };
      await writeFile(
        join(directory, 'result.json'),
        JSON.stringify(result, null, 2) + '\n',
      );
      console.log(
        `Round ${round}: ${gate.outcome}, ${gate.total ?? 'unavailable'}/12.`,
      );
      return { round, ...gate };
    };
    const concurrency = Number(values.concurrency);
    assert.ok(
      concurrency === 1 || concurrency === 2,
      'Concurrency must be one or two.',
    );
    const settled: PromiseSettledResult<
      Awaited<ReturnType<typeof runRound>>
    >[] = [];
    if (concurrency === 2)
      settled.push(...(await Promise.allSettled([1, 2].map(runRound))));
    else
      for (const round of [1, 2]) {
        settled.push(...(await Promise.allSettled([runRound(round)])));
      }
    const results = settled.map((result, index) =>
      result.status === 'fulfilled'
        ? result.value
        : {
            round: index + 1,
            outcome: 'inconclusive',
            error: redact(String(result.reason)),
          },
    );
    summary.rounds = results;
    summary.outcome = results.every((result) => result.outcome === 'pass')
      ? 'pass'
      : results.some((result) => result.outcome === 'fail')
        ? 'fail'
        : 'inconclusive';
  } finally {
    const cleanupErrors: string[] = [];
    if (installed) {
      await command(
        [
          'codex',
          'plugin',
          'remove',
          `applification@${marketplace}`,
          ...config,
        ],
        snapshot,
      ).catch((error: unknown) => {
        cleanupErrors.push(redact(String(error)));
      });
    }
    await retainProject(temporary, join(output, 'interrupted-source'), false, [
      'round-1',
      'round-2',
    ]).catch((error: unknown) => {
      cleanupErrors.push(redact(String(error)));
    });
    await rm(temporary, { recursive: true, force: true }).catch(
      (error: unknown) => {
        cleanupErrors.push(redact(String(error)));
      },
    );
    summary.cleanup = cleanupErrors.length ? 'failed' : 'complete';
    if (cleanupErrors.length) {
      summary.outcome = 'inconclusive';
      await writeFile(
        join(output, 'cleanup-errors.json'),
        JSON.stringify(cleanupErrors),
      );
    }
    summary.finishedAt = new Date().toISOString();
    await writeFile(
      join(output, 'summary.json'),
      JSON.stringify(summary, null, 2) + '\n',
    );
  }
  console.log(JSON.stringify(summary));
  if (summary.outcome !== 'pass') process.exitCode = 1;
}
if (import.meta.main) await main();
