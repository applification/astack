import { mkdir, writeFile, rm } from 'node:fs/promises';
import { z } from 'zod';
import { sourceDigest } from './source-identity';

const probe = 'packages/ui/src/enforcement-probe.tsx';
const domainProbe = 'packages/domain/src/enforcement-probe.ts';
if ((await Bun.file(probe).exists()) || (await Bun.file(domainProbe).exists()))
  throw new Error('Refusing to replace an existing enforcement probe file.');
const configPath = 'packages/ui/tsconfig.json';
const originalConfig = await Bun.file(configPath).text();
const diagnostics = z.array(
  z.object({
    messages: z.array(
      z.object({ ruleId: z.string().nullable(), message: z.string() }),
    ),
  }),
);
const results: {
  case: string;
  outcome: 'pass' | 'fail';
  elapsedMs: number;
  rules: string[];
}[] = [];
async function lint(
  name: string,
  code: string,
  expectedRule?: string,
  path = probe,
) {
  await writeFile(path, code);
  const started = performance.now();
  const process = Bun.spawnSync([
    'bunx',
    '--no-install',
    'eslint',
    path,
    '--format',
    'json',
    '--max-warnings',
    '0',
  ]);
  const parsed = diagnostics.parse(JSON.parse(process.stdout.toString()));
  const rules = parsed.flatMap((file) =>
    file.messages
      .map((message) => message.ruleId)
      .filter((rule): rule is string => rule !== null),
  );
  const pass = expectedRule
    ? process.exitCode !== 0 && rules.includes(expectedRule)
    : process.exitCode === 0;
  results.push({
    case: name,
    outcome: pass ? 'pass' : 'fail',
    elapsedMs: Math.round(performance.now() - started),
    rules,
  });
  if (!pass)
    throw new Error(
      `${name}: expected ${expectedRule ?? 'valid code'}, observed ${JSON.stringify(parsed)}`,
    );
}
try {
  await lint(
    'valid composition (cold)',
    "import type { ReactNode } from 'react'; export function View({ children }: {children: ReactNode}) {return <section>{children}</section>;}\n",
  );
  await lint(
    'valid composition (warm)',
    "import type { ReactNode } from 'react'; export function View({ children }: {children: ReactNode}) {return <section>{children}</section>;}\n",
  );
  await lint(
    'unowned promise',
    "export function unsafe() { Promise.resolve('write'); }\n",
    '@typescript-eslint/no-floating-promises',
  );
  await lint(
    'unsafe unknown boundary',
    'export function unsafe(value: any): string { return value.title; }\n',
    '@typescript-eslint/no-unsafe-member-access',
  );
  await lint(
    'missing accessible name',
    "export function View() { return <img src='record.png' />; }\n",
    'jsx-a11y/alt-text',
  );
  await lint(
    'invalid hook call',
    "import { useState } from 'react'; export function View({ active }: {active:boolean}) { if (active) useState(0); return <p>Hi</p>; }\n",
    'react-hooks/rules-of-hooks',
  );
  await lint(
    'portable public backend import',
    "export { api } from '@foundation/backend/api';\n",
    'foundation/portable-ui',
  );
  await lint(
    'portable relative backend import',
    "export { list } from '../../backend/convex/workItems';\n",
    'foundation/portable-ui',
  );
  await lint(
    'Node builtin without node prefix',
    "export { readFile } from 'fs/promises';\n",
    'foundation/portable-ui',
  );
  await lint(
    'global network alias',
    'export const fetchItems = globalThis.fetch;\n',
    'foundation/portable-ui',
  );
  await lint(
    'domain React dependency',
    "export { useState } from 'react';\n",
    'foundation/portable-ui',
    domainProbe,
  );
  await lint(
    'domain presentation dependency',
    "export { WorkItemList } from '@foundation/ui';\n",
    'foundation/portable-ui',
    domainProbe,
  );
  await lint(
    'domain browser capability',
    'export const browser = document;\n',
    'no-restricted-globals',
    domainProbe,
  );
  await rm(domainProbe, { force: true });
  await writeFile(
    configPath,
    originalConfig.replace(
      '"compilerOptions": {',
      '"compilerOptions": { "baseUrl": ".", "paths": { "@private-backend": ["../backend/convex/workItems.ts"] },',
    ),
  );
  await lint(
    'portable configured alias bypass',
    "export { list } from '@private-backend';\n",
    'foundation/portable-ui',
  );
  await writeFile(configPath, originalConfig);
  await writeFile(probe, 'export const invalid: string = 42;\n');
  const compilerStarted = performance.now();
  const types = Bun.spawnSync([
    'bunx',
    '--no-install',
    'tsc',
    '--noEmit',
    '-p',
    'packages/ui/tsconfig.json',
  ]);
  if (
    types.exitCode === 0 ||
    !types.stdout.toString().includes('enforcement-probe.tsx')
  )
    throw new Error(
      'TS 01: compiler failed to identify the deliberate invalid assignment.',
    );
  results.push({
    case: 'strict compiler detects invalid assignment',
    outcome: 'pass',
    elapsedMs: Math.round(performance.now() - compilerStarted),
    rules: ['TS2322'],
  });
} finally {
  await rm(probe, { force: true });
  await rm(domainProbe, { force: true });
  await writeFile(configPath, originalConfig);
  await mkdir('.proof/enforcement', { recursive: true });
  await writeFile(
    '.proof/enforcement/report.json',
    JSON.stringify(
      {
        scope:
          'adopted detectable rules; semantic composition and test quality require review',
        inputSha256: await sourceDigest(process.cwd()),
        compiler: Bun.spawnSync(['bunx', '--no-install', 'tsc', '--version'])
          .stdout.toString()
          .trim(),
        compilerApi: Bun.spawnSync([
          'bunx',
          '--no-install',
          'tsc6',
          '--version',
        ])
          .stdout.toString()
          .trim(),
        eslint: Bun.spawnSync(['bunx', '--no-install', 'eslint', '--version'])
          .stdout.toString()
          .trim(),
        results,
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(JSON.stringify({ outcome: 'pass', results }, null, 2));
