import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { command, commandBytes } from './runtime';
import {
  fileDigests,
  installedCandidate,
  redactTrial,
  runAgent,
} from './trials';
import { checkNotebook } from './agent-eval-check';
import {
  fixtureRoot,
  initNotebook,
  json,
  newDirectory,
  projectFiles,
  projectIdentity,
  prompts,
  sha256,
  suiteIdentity,
  writeJson,
  type Task,
} from './agent-eval-fixture';

type Condition = 'baseline' | 'candidate';
type Planned = {
  id: string;
  task: Task;
  repeat: number;
  condition: Condition;
  prompt: string;
  promptSha256: string;
};
type Attempt = Planned &
  (
    | { state: 'planned' }
    | { state: 'running'; startedAt: string }
    | { state: 'not-run'; reason: string }
    | {
        state: 'finished';
        outcome: 'pass' | 'fail' | 'inconclusive';
        result: unknown;
      }
  );
export function conditionPrompt(
  task: Task,
  condition: Condition,
  baseline: string,
): string {
  return condition === 'candidate' || baseline !== 'plain'
    ? '$applification:astack ' + prompts[task]
    : prompts[task];
}
export function planAttempts(
  tasks: Task[],
  repeats: number,
  baseline = 'plain',
): Attempt[] {
  const planned: Attempt[] = [];
  for (let repeat = 1; repeat <= repeats; repeat++)
    for (const task of tasks)
      for (const condition of repeat % 2 === 1
        ? (['baseline', 'candidate'] as const)
        : (['candidate', 'baseline'] as const))
        planned.push({
          id: `${repeat}-${task}-${condition}`,
          task,
          repeat,
          condition,
          prompt: conditionPrompt(task, condition, baseline),
          promptSha256: sha256(conditionPrompt(task, condition, baseline)),
          state: 'planned',
        });
  return planned;
}
export function correctnessStats(attempts: Attempt[]) {
  return {
    planned: attempts.length,
    pass: attempts.filter((a) => a.state === 'finished' && a.outcome === 'pass')
      .length,
    fail: attempts.filter((a) => a.state === 'finished' && a.outcome === 'fail')
      .length,
    inconclusive: attempts.filter(
      (a) => a.state === 'finished' && a.outcome === 'inconclusive',
    ).length,
    notRun: attempts.filter((a) => a.state === 'not-run').length,
    unfinished: attempts.filter(
      (a) => a.state === 'planned' || a.state === 'running',
    ).length,
  };
}
export function conditionConfig(marketplace?: {
  name: string;
  source: string;
}): string[] {
  return [
    '-c',
    marketplace
      ? `marketplaces={${JSON.stringify(marketplace.name)}={source_type="local",source=${JSON.stringify(marketplace.source)}}}`
      : 'marketplaces={}',
    '-c',
    marketplace
      ? `plugins={${JSON.stringify('applification@' + marketplace.name)}={enabled=true}}`
      : 'plugins={}',
    '-c',
    'sandbox_workspace_write.exclude_tmpdir_env_var=true',
    '-c',
    'sandbox_workspace_write.exclude_slash_tmp=true',
  ];
}
export const craftsmanshipRubric = readFileSync(
  join(import.meta.dir, 'agent-eval-quality-rubric.md'),
  'utf8',
);
export const craftsmanshipRubricIdentity = {
  version: 'notebook-craftsmanship/v1',
  source: 'fixed copy of skills/code-review/references/quality-rubric.md',
  sha256: sha256(craftsmanshipRubric),
};
export function blindText(input: string, identities: string[]): string {
  let text = redactTrial(input);
  for (const identity of [...identities]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length))
    text = text.split(identity).join('[identity withheld]');
  return text
    .replace(
      /\b(?:applification|astack|codex|openai)\b/gi,
      '[tool identity withheld]',
    )
    .replace(/\b(?:gpt|claude|gemini|o[134])[-\w.]*\b/gi, '[model withheld]')
    .replace(
      /\/(?:private\/)?(?:tmp|Users|home|var)\/[^\s"'`<>]+/g,
      '[workspace withheld]',
    );
}
function reviewSourcePath(name: string): boolean {
  return (
    !name
      .split('/')
      .some(
        (part) =>
          part.startsWith('.') ||
          [
            'evidence',
            'proof',
            'results',
            'reports',
            'coverage',
            'dist',
            'node_modules',
          ].includes(part),
      ) &&
    (/\.(?:ts|tsx|js|jsx|html|css)$/.test(name) ||
      /(?:^|\/)(?:package|tsconfig)\.json$/.test(name))
  );
}

const commandItem = z.object({
  type: z.literal('item.completed'),
  item: z.object({ type: z.literal('command_execution'), command: z.string() }),
});
async function skillEvidence(directory: string, installedPath: string | null) {
  const fileReads: { eventLine: number; command: string }[] = [];
  const events = (
    await readFile(join(directory, 'events.jsonl'), 'utf8')
  ).split('\n');
  for (const [index, line] of events.entries()) {
    try {
      const parsed = commandItem.safeParse(JSON.parse(line));
      if (
        installedPath &&
        parsed.success &&
        parsed.data.item.command.includes(installedPath) &&
        /SKILL\.md/.test(parsed.data.item.command)
      )
        fileReads.push({
          eventLine: index + 1,
          command: parsed.data.item.command,
        });
    } catch {}
  }
  return {
    installation: installedPath
      ? 'verified exact installed bytes'
      : 'plain explicit empty plugin map',
    nativeSkillSelection: 'not established by the CLI event schema',
    skillFileReadEvidence: fileReads,
    interpretation:
      'Installation and configuration do not prove native skill selection. Recorded command text only establishes an attempted skill-file read, not successful selection or use.',
  };
}

export async function runComparison(options: {
  candidate: string;
  pluginRepo?: string | undefined;
  baseline: string;
  model: string;
  tasks: Task[];
  repeats: number;
  output: string;
  timeoutMs: number;
  actionLimit: number;
  reasoning?: string | undefined;
}) {
  const output = await newDirectory(options.output);
  const attempts = planAttempts(
    options.tasks,
    options.repeats,
    options.baseline,
  );
  const manifest: {
    format: string;
    options: typeof options;
    attempts: Attempt[];
    setup: unknown[];
    fatalError: string | null;
    quality: string;
    stats: ReturnType<typeof correctnessStats>;
    [key: string]: unknown;
  } = {
    format: 'notebook-comparison/v1',
    options,
    attempts,
    setup: [],
    fatalError: null,
    quality:
      'unassessed: independent calibrated review and maintenance follow-up required',
    stats: correctnessStats(attempts),
  };
  const persist = async () => {
    manifest.stats = correctnessStats(attempts);
    await writeJson(join(output, 'manifest.json'), manifest);
  };
  manifest.treatment =
    'Plugin conditions load the pinned plugin and explicitly invoke $applification:astack; plain receives the identical local-only user goal without that prefix. This invocation difference is part of the treatment.';
  manifest.conditionPrompts = options.tasks.map((task) => ({
    task,
    userGoal: prompts[task],
    userGoalSha256: sha256(prompts[task]),
    baseline: {
      text: conditionPrompt(task, 'baseline', options.baseline),
      sha256: sha256(conditionPrompt(task, 'baseline', options.baseline)),
    },
    candidate: {
      text: conditionPrompt(task, 'candidate', options.baseline),
      sha256: sha256(conditionPrompt(task, 'candidate', options.baseline)),
    },
  }));
  manifest.craftsmanshipRubric = craftsmanshipRubricIdentity;
  manifest.environment = {
    bun: process.versions.bun,
    nodeCompatibility: process.version,
    platform: process.platform,
    architecture: process.arch,
  };
  manifest.taskInterpretation =
    'Each task starts from the frozen seed. followup measures an independent archive task; it does not establish maintainability of a prior delivery. The manual sequential fresh-agent follow-up is separate.';
  manifest.correctnessScope =
    'Attempt correctness covers the fixed HTTP/disk API suite. Browser interaction and complete user-facing task acceptance require separate manual validation.';
  // Persist the entire denominator and exact treatment prompts before capability discovery, candidate resolution or setup.
  await persist();
  const ownedPlugins: {
    name: string;
    source: string;
    config: string[];
    cleanupRequired: boolean;
  }[] = [];
  let temporary: string | null = null;
  const labels: { label: string; attemptId: string }[] = [];
  try {
    const fixedSuite = await suiteIdentity();
    manifest.fixedSuite = fixedSuite;
    await cp(fixtureRoot, join(output, 'frozen-fixture'), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
    await writeJson(join(output, 'prompts.json'), manifest.conditionPrompts);
    await writeFile(
      join(output, 'craftsmanship-rubric.md'),
      craftsmanshipRubric,
    );
    const version = (await command(['codex', '--version'], output)).trim();
    const help = await command(['codex', 'exec', '--help'], output);
    await writeFile(join(output, 'codex-exec-help.txt'), help);
    if (
      !['--ignore-user-config', '--output-schema', '--json', '--model'].every(
        (flag) => help.includes(flag),
      )
    )
      throw new Error('Codex exec lacks required capabilities');
    manifest.capabilities = {
      version,
      helpSha256: sha256(help),
      model: options.model,
      modelSubstitution:
        'never; an unavailable configured model remains an inconclusive attempt',
    };
    try {
      const catalogHelp = await command(
        ['codex', 'debug', 'models', '--help'],
        output,
        undefined,
        10000,
      );
      if (catalogHelp.includes('--bundled')) {
        const bytes = await commandBytes(
          ['codex', 'debug', 'models', '--bundled'],
          output,
          undefined,
          10000,
        );
        const catalog = z
          .object({ models: z.array(z.object({ slug: z.string() }).loose()) })
          .parse(JSON.parse(bytes.toString('utf8')));
        await writeFile(join(output, 'bundled-models.json'), bytes);
        manifest.modelCatalog = {
          source:
            'codex debug models --bundled (offline; no refresh or provider call)',
          sha256: sha256(bytes),
          requestedModelListed: catalog.models.some(
            (model) => model.slug === options.model,
          ),
          interpretation:
            'Bundled model metadata is not live access verification or a complete custom-model catalog. The requested model is never substituted.',
        };
      } else
        manifest.modelCatalog = {
          available: false,
          reason: 'This CLI does not expose offline bundled discovery',
        };
    } catch (error) {
      manifest.modelCatalog = {
        available: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
    manifest.isolation =
      'Ephemeral sessions, workspace-write with default temp writable roots excluded, --ignore-user-config, explicit plugin maps, same user goals/settings/budgets, explicit skill invocation only for plugin conditions, separate neutral Git repositories. Evaluator and retained artifacts are outside the agent workspace. System/managed/personal skills are not proven excluded.';
    temporary = await mkdtemp(join(tmpdir(), 'notebook-comparison-'));
    const repo = (
      await command(
        ['git', 'rev-parse', '--show-toplevel'],
        options.pluginRepo ?? import.meta.dir,
      )
    ).trim();
    manifest.pluginRepository = repo;
    const plugin = async (ref: string, condition: Condition) => {
      const revision = (
        await command(
          [
            'git',
            'rev-parse',
            '--verify',
            '--end-of-options',
            `${ref}^{commit}`,
          ],
          repo,
        )
      ).trim();
      const source = join(temporary ?? '', condition + '-plugin');
      await mkdir(source);
      const archive = join(temporary ?? '', condition + '.tar');
      await command(
        ['git', 'archive', '--format=tar', '-o', archive, revision],
        repo,
      );
      await command(['tar', '-xf', archive, '-C', source], repo);
      const name = `agent-eval-${randomUUID()}`;
      await writeFile(
        join(source, '.agents/plugins/marketplace.json'),
        json({
          name,
          plugins: [
            {
              name: 'applification',
              source: { source: 'local', path: './' },
              policy: {
                installation: 'AVAILABLE',
                authentication: 'ON_INSTALL',
              },
            },
          ],
        }),
      );
      const expected = await fileDigests(source),
        config = conditionConfig({ name, source });
      const owned = { name, source, config, cleanupRequired: true };
      ownedPlugins.push(owned);
      manifest.setup.push({
        condition,
        revision,
        source,
        marketplace: name,
        expectedFiles: expected,
        config,
        state: 'installing',
      });
      await persist();
      // An installation failure may have left a partial owned cache; cleanup still targets only this unique plugin.
      const install = await command(
        [
          'codex',
          'plugin',
          'add',
          `applification@${name}`,
          '--json',
          ...config,
        ],
        source,
        process.env,
      );
      const verified = await installedCandidate(name, expected);
      const details = {
        condition,
        revision,
        source,
        marketplace: name,
        expectedFiles: expected,
        installed: verified,
        config,
        install,
      };
      manifest.setup.push(details);
      await persist();
      return details;
    };
    const baseline =
      options.baseline === 'plain'
        ? null
        : await plugin(options.baseline, 'baseline');
    const candidate = await plugin(options.candidate, 'candidate');
    manifest.effectiveConfigs = {
      baseline: baseline?.config ?? conditionConfig(),
      candidate: candidate.config,
    };
    await persist();
    await mkdir(join(output, 'attempts'));
    await mkdir(join(output, 'review-packets'));
    for (const [index, planned] of attempts.entries()) {
      const selected = planned.condition === 'candidate' ? candidate : baseline;
      const directory = join(output, 'attempts', planned.id);
      await mkdir(directory);
      const project = join(temporary, planned.id);
      attempts[index] = {
        ...planned,
        state: 'running',
        startedAt: new Date().toISOString(),
      };
      await persist();
      let result: unknown = null,
        outcome: 'pass' | 'fail' | 'inconclusive' = 'inconclusive';
      try {
        if (
          sha256(json(await fileDigests(join(output, 'frozen-fixture')))) !==
          fixedSuite.fixtureDigest
        )
          throw new Error('Frozen fixture changed');
        if (
          JSON.stringify(await suiteIdentity()) !== JSON.stringify(fixedSuite)
        )
          throw new Error('Fixed suite changed');
        if (selected)
          await installedCandidate(
            selected.marketplace,
            selected.expectedFiles,
          );
        await initNotebook(project, join(output, 'frozen-fixture'));
        const before = await projectIdentity(project);
        await writeJson(join(directory, 'before.json'), before);
        const config = selected?.config ?? conditionConfig();
        const agent = await runAgent({
          cwd: project,
          directory: join(directory, 'agent'),
          prompt: planned.prompt,
          config,
          model: options.model,
          reasoning: options.reasoning,
          timeoutMs: options.timeoutMs,
          actionLimit: options.actionLimit,
        });
        // Fixed command and checker source; ignore delivered package scripts and self-reported acceptance.
        const acceptance = await checkNotebook({
          project,
          task: planned.task,
          output: join(directory, 'acceptance'),
        });
        const after = await projectIdentity(project);
        const files = await projectFiles(project);
        const deliverable: Record<string, string> = {};
        for (const name of Object.keys(files)) {
          const text = await readFile(join(project, name), 'utf8');
          deliverable[name] = redactTrial(text);
        }
        await writeJson(join(directory, 'delivered-source.json'), deliverable);
        const source = Object.fromEntries(
          Object.entries(deliverable).filter(([name]) =>
            reviewSourcePath(name),
          ),
        );
        const reviewPaths = [
          ...new Set([
            ...Object.keys(before.files).filter(reviewSourcePath),
            ...Object.keys(source),
          ]),
        ];
        const diff = redactTrial(
          (
            await commandBytes(
              [
                'git',
                'diff',
                '--no-ext-diff',
                '--no-textconv',
                before.revision,
                '--',
                ...reviewPaths,
              ],
              project,
            )
          ).toString('utf8'),
        );
        await writeFile(join(directory, 'diff.patch'), diff);
        const activation = {
          requestedInvocation: selected ? '$applification:astack' : null,
          ...(await skillEvidence(
            join(directory, 'agent'),
            selected?.installed.path ?? null,
          )),
        };
        outcome =
          agent.outcome === 'completed' ? acceptance.outcome : 'inconclusive';
        result = {
          agent,
          acceptance,
          activation,
          before,
          after,
          config,
          deliverableSha256: sha256(json(deliverable)),
          diffSha256: sha256(diff),
        };
        const label = randomUUID();
        labels.push({ label, attemptId: planned.id });
        const identities = [
          project,
          temporary,
          output,
          options.model,
          candidate.revision,
          candidate.revision.slice(0, 7),
          candidate.revision.slice(0, 8),
          candidate.revision.slice(0, 12),
          options.candidate,
          candidate.marketplace,
          candidate.source,
          candidate.installed.path,
          ...(baseline
            ? [
                baseline.revision,
                baseline.revision.slice(0, 7),
                baseline.revision.slice(0, 8),
                baseline.revision.slice(0, 12),
                options.baseline,
                baseline.marketplace,
                baseline.source,
                baseline.installed.path,
              ]
            : []),
        ];
        // Review packet contains only label, user intent, source/diff and rubric. No claims, model, condition or outcomes.
        await writeJson(join(output, 'review-packets', label + '.json'), {
          label,
          userIntent: prompts[planned.task],
          source: Object.fromEntries(
            Object.entries(source).map(([name, text]) => [
              blindText(name, identities),
              blindText(text, identities),
            ]),
          ),
          diff: blindText(diff, identities),
          craftsmanshipRubric,
        });
      } catch (caught) {
        outcome = 'inconclusive';
        result = {
          error: caught instanceof Error ? caught.message : String(caught),
        };
      }
      attempts[index] = { ...planned, state: 'finished', outcome, result };
      await persist();
      await writeJson(join(output, 'private-label-mapping.json'), labels);
    }
  } catch (caught) {
    manifest.fatalError =
      caught instanceof Error ? caught.message : String(caught);
    for (const [index, attempt] of attempts.entries()) {
      if (attempt.state === 'planned')
        attempts[index] = {
          ...attempt,
          state: 'not-run',
          reason: 'Fatal setup interrupted dispatch: ' + manifest.fatalError,
        };
      else if (attempt.state === 'running')
        attempts[index] = {
          ...attempt,
          state: 'finished',
          outcome: 'inconclusive',
          result: { error: manifest.fatalError },
        };
    }
  } finally {
    const cleanup: unknown[] = [];
    for (const plugin of ownedPlugins) {
      try {
        if (plugin.cleanupRequired)
          cleanup.push({
            marketplace: plugin.name,
            output: await command(
              [
                'codex',
                'plugin',
                'remove',
                `applification@${plugin.name}`,
                '--json',
                ...plugin.config,
              ],
              plugin.source,
              process.env,
            ),
          });
      } catch (caught) {
        cleanup.push({ marketplace: plugin.name, error: String(caught) });
      }
    }
    if (temporary) {
      try {
        await rm(temporary, { recursive: true, force: true });
      } catch (caught) {
        cleanup.push({ error: String(caught) });
      }
    }
    manifest.cleanup = cleanup;
    manifest.cleanupOutcome = cleanup.some(
      (entry) =>
        typeof entry === 'object' && entry !== null && 'error' in entry,
    )
      ? 'failed'
      : 'complete';
    manifest.taskStats = options.tasks.map((task) => ({
      task,
      baseline: correctnessStats(
        attempts.filter((a) => a.task === task && a.condition === 'baseline'),
      ),
      candidate: correctnessStats(
        attempts.filter((a) => a.task === task && a.condition === 'candidate'),
      ),
    }));
    manifest.interpretation =
      'Paired exploratory comparison, not certification or evidence of statistical improvement. Every planned attempt remains in the denominator. Correctness is independent of craftsmanship; skill selection and browser/manual acceptance remain separate observations.';
    await persist();
  }
  return manifest;
}
