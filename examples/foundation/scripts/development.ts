import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createConnection } from 'node:net';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';
import { sourceDigest } from './source-identity';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const backend = join(root, 'packages/backend');

export function assertLocalTarget(values: NodeJS.ProcessEnv): void {
  for (const name of [
    'CONVEX_DEPLOY_KEY',
    'CONVEX_SELF_HOSTED_URL',
    'CONVEX_SELF_HOSTED_ADMIN_KEY',
  ]) {
    if (values[name])
      throw new Error(
        `${name} is incompatible with local development. Use the cloud transition workflow in .astack/cloud.md.`,
      );
  }
  const deployment = values.CONVEX_DEPLOYMENT;
  if (deployment && !/^(anonymous|local):[\w-]+$/.test(deployment))
    throw new Error(
      'The selected Convex deployment is not local. Preserve its configuration and restore/select the local deployment before starting development.',
    );
  if (values.CONVEX_URL) assertLoopback(values.CONVEX_URL);
}

function assertLoopback(value: string): string {
  const url = new URL(value);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error('Local development requires a loopback Convex URL.');
  return value;
}

async function readSettings(path: string): Promise<NodeJS.ProcessEnv> {
  try {
    return parseEnv(await readFile(path, 'utf8'));
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return {};
    throw error;
  }
}

export async function localEnvironment(
  directory: string,
  inherited: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  const settings = await Promise.all(
    ['.env', '.env.local'].map((name) => readSettings(join(directory, name))),
  );
  // Inspect every source, even one shadowed by a higher-priority local value.
  for (const values of [inherited, ...settings]) assertLocalTarget(values);
  return { ...inherited, CONVEX_AGENT_MODE: 'anonymous' };
}

export async function localClientEnvironment(
  directory: string,
  inherited: NodeJS.ProcessEnv = process.env,
): Promise<NodeJS.ProcessEnv> {
  const env = await localEnvironment(directory, inherited);
  const values = {
    ...(await readSettings(join(directory, '.env'))),
    ...(await readSettings(join(directory, '.env.local'))),
  };
  const url = values.CONVEX_URL;
  if (!url || !values.CONVEX_DEPLOYMENT)
    throw new Error(
      'Start the local backend before its clients; its .env.local must identify the local deployment and CONVEX_URL.',
    );
  return { ...env, VITE_CONVEX_URL: assertLoopback(url) };
}

export function localCommand(args: string[]): string[] {
  if (
    !['env', 'export', 'import', 'run', 'data', 'logs', 'dashboard'].includes(
      args[0] ?? '',
    )
  )
    throw new Error(
      'convex:local supports env, export, import, run, data, logs and dashboard. Start the backend with dev:backend; move to cloud through .astack/cloud.md.',
    );
  const forbidden = [
    '--prod',
    '--deployment',
    '--env-file',
    '--url',
    '--admin-key',
    '--configure',
    '--team',
    '--project',
    '--dev-deployment',
    '--cloud',
    '--preview-name',
    '--preview-create',
  ];
  if (args.some((arg) => forbidden.includes(arg.split('=')[0] ?? '')))
    throw new Error(
      'convex:local cannot override the local deployment target.',
    );
  return ['bunx', '--no-install', 'convex', ...args];
}

async function run(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  isolated = false,
): Promise<number> {
  const executable = args[0];
  if (!executable) throw new Error('Missing development command.');
  const child = spawn(executable, args.slice(1), {
    cwd,
    env,
    stdio: 'inherit',
    detached: isolated,
  });
  const stop = () => {
    child.kill('SIGINT');
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  const exited = new Promise<number>((done, fail) => {
    child.once('error', fail);
    child.once('close', (code) => {
      done(code ?? 1);
    });
  });
  try {
    return await exited;
  } catch (error) {
    stop();
    await exited;
    throw error;
  } finally {
    // Convex's configure-only command can exit before its backend child.
    // This private process group belongs to that bootstrap, never another app.
    if (isolated && child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
    }
    process.off('SIGINT', stop);
    process.off('SIGTERM', stop);
  }
}

async function backendListening(value: string): Promise<boolean> {
  const url = new URL(assertLoopback(value));
  return await new Promise<boolean>((done) => {
    const socket = createConnection({
      host: url.hostname.replace(/^\[|\]$/g, ''),
      port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    });
    const finish = (listening: boolean) => {
      socket.destroy();
      done(listening);
    };
    socket.once('connect', () => {
      finish(true);
    });
    socket.once('error', () => {
      finish(false);
    });
    socket.setTimeout(1000, () => {
      finish(true);
    });
  });
}
async function waitForBackendStop(): Promise<void> {
  const url = (await readSettings(join(backend, '.env.local'))).CONVEX_URL;
  if (!url) throw new Error('The local deployment did not save its URL.');
  const deadline = Date.now() + 10_000;
  while (await backendListening(url)) {
    if (Date.now() >= deadline)
      throw new Error(
        'The one-off local backend did not stop; preserve its state and stop that process before retrying.',
      );
    await new Promise<void>((done) => {
      setTimeout(done, 50);
    });
  }
}

async function initializeLocalAuth(env: NodeJS.ProcessEnv): Promise<void> {
  async function capture(args: string[]): Promise<string> {
    const child = Bun.spawn(localCommand(args), {
      cwd: backend,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) throw new Error(`Local initialization failed: ${stderr}`);
    await waitForBackendStop();
    return stdout;
  }
  const names = new Set(
    (await capture(['env', 'list', '--names-only']))
      .split('\n')
      .map((name) => name.trim()),
  );
  // Convex evaluates auth.config at push time and requires every accessed env key.
  // Missing values deny identity; never replace a configured provider or proof fixture.
  for (const [name, value] of Object.entries({
    ASTACK_PROOF_MODE: 'disabled',
    WORKOS_CLIENT_ID: '',
    WORKOS_AUTHKIT_DOMAIN: '',
    MCP_RESOURCE_URL: '',
  })) {
    if (!names.has(name)) await capture(['env', 'set', name, value]);
  }
  const revision =
    Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root })
      .stdout.toString()
      .trim() || 'unversioned';
  await capture([
    'env',
    'set',
    'ASTACK_BUILD_ID',
    `${revision}@sha256-${await sourceDigest(root)}`,
  ]);
}

if (import.meta.main) {
  const mode = process.argv[2] ?? 'app';
  const args = process.argv
    .slice(3)
    .filter((arg, index) => !(index === 0 && arg === '--'));
  if (mode === 'clients') {
    const env = await localClientEnvironment(backend);
    console.log(
      `Local clients use ${env.VITE_CONVEX_URL ?? ''}; WorkOS configuration stays in apps/web/.env.local.`,
    );
    process.exitCode = await run(
      [
        'bunx',
        '--no-install',
        'turbo',
        'dev',
        '--filter=@foundation/web',
        '--filter=@foundation/mcp-ui',
      ],
      root,
      env,
    );
  } else if (mode === 'convex') {
    process.exitCode = await run(
      localCommand(args),
      backend,
      await localEnvironment(backend),
    );
  } else if (mode === 'backend' || mode === 'app') {
    if (args.length)
      throw new Error('Local startup takes no deployment overrides.');
    const env = await localEnvironment(backend);
    const saved = await readSettings(join(backend, '.env.local'));
    if (saved.CONVEX_URL && (await backendListening(saved.CONVEX_URL)))
      throw new Error(
        'The local backend is already running. Use its existing development session or stop it before restarting.',
      );
    if (!saved.CONVEX_DEPLOYMENT) {
      // Configure local state before evaluating the unconfigured auth provider.
      const code = await run(
        ['bunx', '--no-install', 'convex', 'dev', '--skip-push'],
        backend,
        env,
        true,
      );
      if (code !== 0) process.exit(code);
      await waitForBackendStop();
    }
    await initializeLocalAuth(env);
    const code = await run(['bun', 'run', 'build:mcp-ui'], root, env);
    if (code !== 0) process.exit(code);
    console.log(
      'Starting persistent local Convex development. Data stays in packages/backend/.convex; stopping does not delete it.',
    );
    process.exitCode = await run(
      [
        'bunx',
        '--no-install',
        'convex',
        'dev',
        ...(mode === 'app'
          ? ['--start', 'bun ../../scripts/development.ts clients']
          : []),
      ],
      backend,
      env,
    );
  } else
    throw new Error(
      'Usage: development.ts [app | backend | clients | convex <command...>]',
    );
}
