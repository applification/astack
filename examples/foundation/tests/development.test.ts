import { expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  assertLocalTarget,
  convexAiFilesInstalled,
  localClientEnvironment,
  localCommand,
  localEnvironment,
} from '../scripts/development';

test('AI setup observes files created after its initial missing-file check', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'astack-ai-install-'));
  try {
    expect(await convexAiFilesInstalled(directory)).toBe(false);
    const generated = join(directory, 'convex/_generated/ai');
    await mkdir(generated, { recursive: true });
    await writeFile(join(generated, 'ai-files.state.json'), '{}');
    expect(await convexAiFilesInstalled(directory)).toBe(false);
    await writeFile(join(generated, 'guidelines.md'), 'Installed guidance');
    expect(await convexAiFilesInstalled(directory)).toBe(true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local startup rejects cloud selection, deploy keys and self-hosted overrides', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'astack-dev-guard-'));
  try {
    for (const values of [
      { CONVEX_DEPLOYMENT: 'dev:cloud-target' },
      { CONVEX_DEPLOYMENT: 'prod:cloud-target' },
      { CONVEX_DEPLOY_KEY: 'deployment-scoped-test-key' },
      { CONVEX_SELF_HOSTED_URL: 'https://external.example' },
      { CONVEX_SELF_HOSTED_ADMIN_KEY: 'test-key' },
      { CONVEX_URL: 'https://external.convex.cloud' },
    ])
      expect(() => {
        assertLocalTarget(values);
      }).toThrow();
    expect((await localEnvironment(directory, {})).CONVEX_AGENT_MODE).toBe(
      'anonymous',
    );
    await writeFile(
      join(directory, '.env'),
      'CONVEX_DEPLOYMENT=dev:cloud-target\n',
    );
    await writeFile(
      join(directory, '.env.local'),
      'CONVEX_DEPLOYMENT=anonymous:local-target\n',
    );
    const rejected = await localEnvironment(directory, {}).then(
      () => null,
      (error: unknown) => error,
    );
    expect(rejected).toBeInstanceOf(Error);
    expect(String(rejected)).toContain('not local');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('clients follow the persisted local backend rather than a stale cloud frontend URL', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'astack-dev-client-'));
  try {
    const rejected = await localClientEnvironment(directory, {}).then(
      () => null,
      (error: unknown) => error,
    );
    expect(rejected).toBeInstanceOf(Error);
    expect(String(rejected)).toContain('Start the local backend');
    const settings =
      'CONVEX_DEPLOYMENT="anonymous:local-target" # persisted\nCONVEX_URL=http://127.0.0.1:3210\n';
    await writeFile(join(directory, '.env.local'), settings);
    const env = await localClientEnvironment(directory, {
      VITE_CONVEX_URL: 'https://old.convex.cloud',
    });
    expect(env.VITE_CONVEX_URL).toBe('http://127.0.0.1:3210');
    expect(await Bun.file(join(directory, '.env.local')).text()).toBe(settings);
    await writeFile(
      join(directory, '.env.local'),
      'CONVEX_DEPLOYMENT=local:linked-local\nCONVEX_URL=http://localhost:3210\n',
    );
    expect((await localClientEnvironment(directory, {})).VITE_CONVEX_URL).toBe(
      'http://localhost:3210',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('local administrative commands cannot retarget a write or export to cloud', () => {
  expect(localCommand(['export', '--path', '.proof/local.zip'])).toContain(
    'export',
  );
  for (const args of [
    ['deploy'],
    ['deployment', 'select', 'dev'],
    ['env', 'set', 'NAME', 'value', '--prod'],
    ['import', 'snapshot.zip', '--deployment=prod'],
    ['run', 'workItems:list', '--env-file', '.env.cloud'],
    ['run', 'workItems:list', '--url=https://cloud.example'],
  ])
    expect(() => localCommand(args)).toThrow();
});
