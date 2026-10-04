#!/usr/bin/env bun
import { Command } from 'commander';
import { resolve } from 'node:path';
import { doctor, verify } from '../../../scripts/readiness';

const projectRoot = resolve(import.meta.dir, '../../..');
const program = new Command()
  .name('astack-work-items')
  .description(
    'Inspect and prove the running Work items web + Convex + MCP product.',
  );
program
  .command('doctor')
  .description(
    'Read-only inspection of the checkout, revision, tooling and proof prerequisites.',
  )
  .option('--json', 'Print machine-readable results')
  .action(async () => {
    console.log(JSON.stringify(await doctor(projectRoot), null, 2));
  });
program
  .command('verify')
  .description(
    'Create a disposable local runtime; drive web and MCP; capture evidence; stop owned processes.',
  )
  .option('--json', 'Print machine-readable results')
  .option(
    '--evidence <directory>',
    'Retain redacted report and screenshots in this directory',
  )
  .action(async (options: { evidence?: string }) => {
    const report = await verify({
      projectRoot,
      evidenceDirectory: options.evidence,
    });
    console.log(JSON.stringify(report, null, 2));
    if (report.outcome !== 'pass') process.exitCode = 1;
  });
await program.parseAsync();
