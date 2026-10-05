import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { WorkItemSchema } from '@foundation/domain';
import {
  command,
  commandBytes,
  foundationRoot,
  launch,
  localEnvironment,
  redact,
  revisionIdentity,
  stopProcess,
} from './runtime';
import { isSourcePath } from './source-identity';
import { descendants } from './trials';
import { chromium, type Browser } from 'playwright';
import { emulatePassword, emulateUsers } from './workos-emulate';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { saveWorkosConfiguration } from './workos-setup';

// This owns a copy, never the developer's persistent database or environment.
const privateDirectory = await mkdtemp(
  join(tmpdir(), 'astack-development-proof-'),
);
const project = join(privateDirectory, 'app');
const output = join(foundationRoot, '.proof', `development-${Date.now()}`);
await mkdir(output, { recursive: true });
const logs: string[] = [];
const env = localEnvironment();
const observations: Record<string, unknown> = {};
let owned: ReturnType<typeof launch> | undefined;
let failure: unknown;
let browser: Browser | undefined;
const describe = (error: unknown): string =>
  error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : JSON.stringify(error);
async function available(port: number): Promise<void> {
  const server = createServer();
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(port, '127.0.0.1', () => {
      server.close((error) => {
        if (error) fail(error);
        else done();
      });
    });
  });
}
async function waitUntil(
  check: () => Promise<boolean>,
  description: string,
): Promise<void> {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (
      !owned ||
      owned.child.exitCode !== null ||
      owned.child.signalCode !== null
    )
      throw new Error(`Development exited before ${description}.`);
    if (await check().catch(() => false)) return;
    await new Promise<void>((done) => {
      setTimeout(done, 250);
    });
  }
  throw new Error(`Timed out waiting for ${description}.`);
}
async function start(clients = true): Promise<void> {
  const logOffset = logs.length;
  owned = launch(
    ['bun', 'run', clients ? 'dev' : 'dev:backend'],
    project,
    env,
    logs,
  );
  await waitUntil(async () => {
    // On restart, env initialization briefly starts an administrative backend
    // with the previous build ID. Wait for this session's successful push so
    // that its persisted health response cannot masquerade as dev readiness.
    if (!logs.slice(logOffset).join('').includes('Convex functions ready!'))
      return false;
    const response = await fetch('http://127.0.0.1:3211/health');
    if (!response.ok) return false;
    const health: unknown = await response.json();
    return (
      typeof health === 'object' &&
      health !== null &&
      'buildId' in health &&
      health.buildId === observations.sourceIdentity
    );
  }, 'persistent local functions');
  if (clients)
    await waitUntil(async () => {
      const response = await fetch('http://127.0.0.1:5173/src/main.tsx');
      return response.ok &&
        (await response.text()).includes('http://127.0.0.1:3210')
        ? true
        : false;
    }, 'web client compiled with the local backend URL');
}
async function stop(): Promise<void> {
  if (owned) {
    if (owned.child.pid) {
      const processes = descendants(owned.child.pid);
      observations.processEnumeration = processes.observation;
      if (!processes.available)
        throw new Error(
          'Persistent development proof requires process enumeration to clean detached client descendants.',
        );
      for (const pid of processes.pids) {
        try {
          process.kill(pid, 'SIGINT');
        } catch {}
      }
    }
    await stopProcess(owned);
    owned = undefined;
  }
}
const identity = JSON.stringify({ subject: emulateUsers[0].id });
const local = async (args: string[]): Promise<string> =>
  (
    await commandBytes(
      ['bun', 'run', 'convex:local', '--', ...args],
      project,
      env,
    )
  ).toString('utf8');
try {
  // Fixed development ports must be free; never commandeer another running app.
  for (const port of [3210, 3211, 4100, 5173, 5174]) await available(port);
  await cp(foundationRoot, project, {
    recursive: true,
    filter: (path) => isSourcePath(relative(foundationRoot, path)),
  });
  observations.sourceIdentity = await revisionIdentity(project);
  logs.push(
    await command(['bun', 'install', '--frozen-lockfile'], project, env),
  );
  await start();
  browser = await chromium.launch();
  const page = await browser.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill(emulateUsers[0].email);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByLabel('Password', { exact: true }).fill(emulatePassword);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page
    .getByLabel('Title', { exact: true })
    .fill('Emulate browser development');
  await page
    .getByRole('button', { name: 'Add work item', exact: true })
    .click();
  await page
    .getByText('Emulate browser development', { exact: true })
    .waitFor();
  await page.screenshot({
    path: join(output, 'first-run-web.png'),
    fullPage: true,
  });
  await page.goto('http://127.0.0.1:5174/');
  await page
    .getByRole('button', { name: 'Connect with Emulate', exact: true })
    .waitFor();
  const text = await page.locator('body').innerText();
  if (
    text.includes('Method not found') ||
    text.includes('Waiting for the host') ||
    errors.length
  )
    throw new Error(
      'First-run clients still report a missing host or runtime error.',
    );
  await page
    .getByRole('button', { name: 'Connect with Emulate', exact: true })
    .click();
  await page
    .frameLocator('iframe')
    .getByText('Emulate browser development', { exact: true })
    .waitFor();
  await page.screenshot({
    path: join(output, 'first-run-mcp-preview.png'),
    fullPage: true,
  });
  observations.firstRunSurfaces =
    'Fresh development signs in with official AuthKit React against Emulate; MCP preview observes the browser-created item through an Emulate token for the same seeded subject. No staging setup required.';
  const aiState = await Bun.file(
    join(project, 'packages/backend/convex/_generated/ai/ai-files.state.json'),
  ).exists();
  if (!aiState)
    throw new Error('First startup did not install Convex AI files.');
  observations.aiSetup =
    'Managed AI files installed automatically without an interactive prompt; scoped instructions preserved.';
  await browser.close();
  browser = undefined;
  observations.firstStartup =
    'persistent local Convex; clients received loopback URL; no Convex account or deploy key supplied';
  const created = WorkItemSchema.parse(
    JSON.parse(
      await local([
        'run',
        'workItems:create',
        JSON.stringify({ title: 'Persistent local development' }),
        '--identity',
        identity,
      ]),
    ) as unknown,
  );
  const before = WorkItemSchema.array().parse(
    JSON.parse(
      await local(['run', 'workItems:list', '{}', '--identity', identity]),
    ) as unknown,
  );
  if (!before.some((item) => item.id === created.id))
    throw new Error('Initial persisted read did not confirm the created item.');
  await local([
    'env',
    'set',
    'WORKOS_AUTHKIT_DOMAIN',
    'https://development.example',
  ]);
  const settings = await readFile(join(project, 'packages/backend/.env.local'));
  observations.localConfigSha256 = createHash('sha256')
    .update(settings)
    .digest('hex');
  await stop();
  if (
    !settings.equals(
      await readFile(join(project, 'packages/backend/.env.local')),
    )
  )
    throw new Error('Shutdown changed local deployment configuration.');
  await stat(
    join(
      project,
      'packages/backend/.convex/local/default/convex_local_backend.sqlite3',
    ),
  );
  observations.statePreservedOnStop = true;
  // Existing public staging configuration must survive and must not override
  // the default Emulate provider or its stable local ownership.
  await saveWorkosConfiguration(
    project,
    'client_stagingFixture',
    'https://development.example',
  );
  const stagingSettings = await readFile(
    join(project, 'packages/backend/.env.local'),
  );
  await start(false);
  if (
    !stagingSettings.equals(
      await readFile(join(project, 'packages/backend/.env.local')),
    )
  )
    throw new Error('Emulate restart overwrote saved public staging settings.');
  const after = WorkItemSchema.array().parse(
    JSON.parse(
      await local(['run', 'workItems:list', '{}', '--identity', identity]),
    ) as unknown,
  );
  if (JSON.stringify(after) !== JSON.stringify(before))
    throw new Error('The independent read after restart changed local data.');
  if (
    (await local(['env', 'get', 'WORKOS_AUTHKIT_DOMAIN'])).trim() !==
    'https://development.example'
  )
    throw new Error('Startup overwrote configured auth values.');
  observations.persistedItem = created;
  observations.restartRead = after;
  const sessionResponse = await fetch(
    'http://localhost:4100/user_management/authenticate',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: 'client_astackEmulate',
        email: emulateUsers[0].email,
        password: emulatePassword,
      }),
    },
  );
  const session = (await sessionResponse.json()) as { access_token: string };
  if (!sessionResponse.ok || typeof session.access_token !== 'string')
    throw new Error('Emulate restart did not authenticate the seeded user.');
  const authenticated = new ConvexHttpClient('http://127.0.0.1:3210');
  authenticated.setAuth(session.access_token);
  const restartOwned = WorkItemSchema.array().parse(
    await authenticated.query(
      makeFunctionReference<'query'>('workItems:list'),
      {},
    ),
  );
  if (JSON.stringify(restartOwned) !== JSON.stringify(before))
    throw new Error(
      'Emulate subject did not resolve persisted ownership after restart.',
    );
  observations.emulateRestartContinuity = true;
  observations.existingConfigurationPreserved = true;
  await local([
    'export',
    '--include-file-storage',
    '--path',
    join(privateDirectory, 'snapshot.zip'),
  ]);
  const snapshot = await readFile(join(privateDirectory, 'snapshot.zip'));
  if (!snapshot.length) throw new Error('Local snapshot was empty.');
  observations.privateExport = {
    bytes: snapshot.length,
    sha256: createHash('sha256').update(snapshot).digest('hex'),
    retained: false,
  };
  observations.authenticationLimit =
    'Browser AuthKit login and same seeded web/MCP subject established with Emulate; restart uses an Emulate-issued session. CLI administration covers export/configuration. No real WorkOS login or MCP OAuth consent.';
} catch (error) {
  failure = error;
} finally {
  try {
    await browser?.close();
    await stop();
    await rm(privateDirectory, { recursive: true, force: true });
    observations.cleanup = 'complete';
  } catch (error) {
    failure ??= error;
    observations.cleanup = 'failed';
  }
  await writeFile(join(output, 'terminal.log'), redact(logs.join('\n')));
  await writeFile(
    join(output, 'report.json'),
    JSON.stringify(
      {
        outcome: failure ? 'fail' : 'pass',
        observations,
        ...(failure ? { error: redact(describe(failure)) } : {}),
        limits: [
          'No cloud project/deployment was created.',
          'No data transfer or hosted behavior was exercised.',
        ],
      },
      null,
      2,
    ) + '\n',
  );
}
if (failure)
  throw new Error(
    `Persistent development proof failed; see ${output}: ${redact(describe(failure))}`,
  );
console.log(
  `Persistent local development, restart/read and private export passed; report: ${output}`,
);
