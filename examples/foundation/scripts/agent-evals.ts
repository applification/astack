import { Command } from 'commander';
import { resolve } from 'node:path';
import { z } from 'zod';
import { checkNotebook } from './agent-eval-check';
import { initNotebook, tasks } from './agent-eval-fixture';
import { runComparison } from './agent-eval-run';

const task = z.enum(tasks);
const integer = (maximum: number) =>
  z.coerce.number().int().min(1).max(maximum);
export async function main(argv = process.argv) {
  const program = new Command()
    .name('agent-evals')
    .description(
      'Local notebook agent comparisons; deterministic checking makes no model calls.',
    );
  program
    .command('init')
    .argument('<new-repository>')
    .description(
      'Create a separate neutral Bun notebook Git repository; refuse an existing destination.',
    )
    .action(async (destination: string) => {
      process.stdout.write((await initNotebook(resolve(destination))) + '\n');
    });
  program
    .command('check')
    .description(
      'Run fixed HTTP/disk acceptance; evidence output must be new and outside the repository. Exit 0 pass, 1 fail, 2 inconclusive.',
    )
    .requiredOption('--project <repository>')
    .requiredOption('--task <bug|feature|followup>')
    .requiredOption('--output <new-directory>')
    .action(async (raw: unknown) => {
      const options = z
        .object({ project: z.string(), task, output: z.string() })
        .parse(raw);
      const report = await checkNotebook({
        ...options,
        project: resolve(options.project),
        output: resolve(options.output),
      });
      process.stdout.write(
        JSON.stringify({
          outcome: report.outcome,
          report: resolve(options.output, 'report.json'),
        }) + '\n',
      );
      process.exitCode =
        report.outcome === 'pass' ? 0 : report.outcome === 'fail' ? 1 : 2;
    });
  program
    .command('run')
    .description(
      'Run paired Codex attempts (paid model calls). Quality requires separate calibrated review.',
    )
    .requiredOption('--candidate <commit>')
    .option(
      '--plugin-repo <path>',
      'Git repository containing plugin revisions (defaults to evaluator checkout)',
    )
    .option(
      '--baseline <plain|commit>',
      'Baseline plugin revision or empty explicit plugin configuration',
      'plain',
    )
    .requiredOption('--model <id>', 'Use exactly this model; never substitute')
    .option(
      '--tasks <list>',
      'Comma-separated bug,feature,followup',
      'bug,feature',
    )
    .option('--repeats <n>', 'Independent paired repeats', '1')
    .requiredOption('--output <new-directory>')
    .option('--timeout-ms <n>', 'Per-attempt wall-clock limit', '1200000')
    .option('--action-limit <n>', 'Per-attempt action limit', '80')
    .option('--reasoning <effort>', 'Configured Codex reasoning effort')
    .action(async (raw: unknown) => {
      const options = z
        .object({
          candidate: z.string().min(1),
          pluginRepo: z.string().min(1).optional(),
          baseline: z.string().min(1),
          model: z.string().min(1),
          tasks: z
            .string()
            .transform((value) => value.split(','))
            .pipe(
              z
                .array(task)
                .min(1)
                .refine(
                  (value) => new Set(value).size === value.length,
                  'Duplicate tasks',
                ),
            ),
          repeats: integer(100),
          output: z.string(),
          timeoutMs: integer(3600000),
          actionLimit: integer(1000),
          reasoning: z
            .enum(['minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'])
            .optional(),
        })
        .parse(raw);
      const report = await runComparison({
        ...options,
        pluginRepo:
          options.pluginRepo === undefined
            ? undefined
            : resolve(options.pluginRepo),
        output: resolve(options.output),
      });
      process.stdout.write(
        JSON.stringify({
          stats: report.stats,
          quality: report.quality,
          manifest: resolve(options.output, 'manifest.json'),
        }) + '\n',
      );
      process.exitCode =
        report.cleanupOutcome === 'failed' ||
        report.fatalError ||
        report.stats.notRun ||
        report.stats.unfinished ||
        report.stats.inconclusive
          ? 2
          : report.stats.fail
            ? 1
            : 0;
    });
  await program.parseAsync(argv);
}
if (import.meta.main)
  main().catch((error: unknown) => {
    process.stderr.write(
      (error instanceof Error ? error.message : String(error)) + '\n',
    );
    process.exitCode = 2;
  });
