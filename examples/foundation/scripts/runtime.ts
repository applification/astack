import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative } from 'node:path';
import { generateKeyPair, exportPKCS8, SignJWT } from 'jose';
import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';
import { isSourcePath, sourceDigest } from './source-identity';
import { startWorkosEmulate, emulateClientId } from './workos-emulate';

export const foundationRoot = resolve(import.meta.dir, '..');
export type OwnedProcess = {
  child: ChildProcess;
  stopped: boolean;
  closed: boolean;
};
export type Runtime = {
  project: string;
  privateDirectory: string;
  webUrl: string;
  convexUrl: string;
  siteUrl: string;
  mcpUrl: string;
  buildId: string;
  auth: Awaited<ReturnType<typeof startWorkosEmulate>>;
  issuer: string;
  webAudience: string;
  tokens: {
    web: string;
    mcp: string;
    otherWeb: string;
    otherMcp: string;
    wrongAudience: string;
    expired: string;
  };
  logs: string[];
  processes: OwnedProcess[];
  stop(): Promise<void>;
};

/** Retain only environment needed to launch local tooling; never inherit deployment credentials. */
export function localEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'HOME',
    'USER',
    'LOGNAME',
    'TMPDIR',
    'TEMP',
    'TMP',
    'LANG',
    'LC_ALL',
    'TZ',
    'SYSTEMROOT',
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => source[key] !== undefined)
      .map((key) => [key, source[key]]),
  );
}
export function redact(text: string): string {
  return text
    .replace(
      /\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,
      '[REDACTED JWT]',
    )
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
    .replace(
      /(CONVEX_SELF_HOSTED_ADMIN_KEY|CONVEX_DEPLOY_KEY|WORKOS_API_KEY)\s*[=:]\s*[^\s]+/gi,
      '$1=[REDACTED]',
    );
}
export async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', done);
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Could not allocate local port');
  await new Promise<void>((done, fail) =>
    server.close((error) => {
      if (error) fail(error);
      else done();
    }),
  );
  return address.port;
}
export async function command(
  args: string[],
  cwd: string,
  env = localEnvironment(),
  timeoutMs = 120_000,
): Promise<string> {
  const output = await captureCommand(args, cwd, env, timeoutMs);
  return redact(output.combined.toString('utf8'));
}
/** Raw stdout is private input for hashing and one deliberate sanitization pass. */
export async function commandBytes(
  args: string[],
  cwd: string,
  env = localEnvironment(),
  timeoutMs = 120_000,
): Promise<Buffer> {
  return (await captureCommand(args, cwd, env, timeoutMs)).stdout;
}
async function captureCommand(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number,
): Promise<{ stdout: Buffer; combined: Buffer }> {
  const executable = args[0];
  if (!executable) throw new Error('Command has no executable');
  const child = spawn(executable, args.slice(1), {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const stdout: Buffer[] = [],
    combined: Buffer[] = [];
  const deadline = { exceeded: false };
  let forcedStop: ReturnType<typeof setTimeout> | undefined;
  child.stdout.on('data', (chunk: Buffer) => {
    stdout.push(chunk);
    combined.push(chunk);
  });
  child.stderr.on('data', (chunk: Buffer) => {
    combined.push(chunk);
  });
  const timer = setTimeout(() => {
    deadline.exceeded = true;
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGTERM');
      } catch {}
      forcedStop = setTimeout(() => {
        if (child.pid) {
          try {
            process.kill(-child.pid, 'SIGKILL');
          } catch {}
        }
      }, 5000);
    }
  }, timeoutMs);
  try {
    const code = await new Promise<number | null>((done, fail) => {
      child.once('error', fail);
      child.once('close', done);
    });
    if (deadline.exceeded || code !== 0)
      throw new Error(
        `${args[0]} ${args[1] ?? ''} ${deadline.exceeded ? 'exceeded its deadline' : `exited ${code}`}: ${redact(Buffer.concat(combined).toString('utf8')).slice(-6000)}`,
      );
    return { stdout: Buffer.concat(stdout), combined: Buffer.concat(combined) };
  } finally {
    // A wrapper can exit while descendants still own this detached process group.
    if (child.pid) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {}
    }
    clearTimeout(timer);
    if (forcedStop) clearTimeout(forcedStop);
  }
}
export function launch(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  logs: string[],
): OwnedProcess {
  const executable = args[0];
  if (!executable) throw new Error('Command has no executable');
  const child = spawn(executable, args.slice(1), {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  const owned = { child, stopped: false, closed: false };
  child.once('close', () => {
    owned.closed = true;
  });
  const append = (chunk: Buffer) => {
    logs.push(redact(chunk.toString()));
    if (logs.length > 500) logs.shift();
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', (error) => logs.push(error.message));
  return owned;
}
export async function stopProcess(owned: OwnedProcess): Promise<void> {
  if (owned.stopped) return;
  owned.stopped = true;
  if (!owned.child.pid) return;
  const exit = owned.closed
    ? Promise.resolve()
    : new Promise<void>((done) => {
        owned.child.once('close', () => {
          done();
        });
      });
  try {
    process.kill(-owned.child.pid, 'SIGTERM');
  } catch {
    return;
  }
  await Promise.race([
    exit,
    new Promise<void>((done) => {
      setTimeout(done, 5000);
    }),
  ]);
  try {
    process.kill(-owned.child.pid, 'SIGKILL');
  } catch {}
  await exit;
}
export async function waitFor<T>(
  check: () => Promise<T | false>,
  description: string,
  timeoutMs = 90_000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await check();
      if (result !== false) return result;
    } catch (error) {
      last = error;
    }
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error(
    `Timed out waiting for ${description}${last ? `: ${redact(last instanceof Error ? last.message : JSON.stringify(last))}` : ''}`,
  );
}
export async function revisionIdentity(project: string): Promise<string> {
  const revision = await command(['git', 'rev-parse', 'HEAD'], project).then(
    (value) => value.trim(),
    () => 'unversioned',
  );
  return `${revision}@sha256-${await sourceDigest(project)}`;
}

export async function startRuntime(
  options: { projectRoot?: string } = {},
): Promise<Runtime> {
  const source = options.projectRoot ?? foundationRoot;
  const privateDirectory = await mkdtemp(join(tmpdir(), 'astack-foundation-'));
  const project = join(privateDirectory, 'app');
  const logs: string[] = [],
    processes: OwnedProcess[] = [];
  let auth: Awaited<ReturnType<typeof startWorkosEmulate>> | undefined;
  const stop = async () => {
    const errors: unknown[] = [];
    for (const process of [...processes].reverse())
      await stopProcess(process).catch((error: unknown) => errors.push(error));
    await auth?.close().catch((error: unknown) => errors.push(error));
    await rm(privateDirectory, { recursive: true, force: true }).catch(
      (error: unknown) => errors.push(error),
    );
    if (errors.length)
      throw new AggregateError(errors, 'Disposable runtime cleanup failed');
  };
  try {
    const sourceRevision = await command(
      ['git', 'rev-parse', 'HEAD'],
      source,
    ).then(
      (value) => value.trim(),
      () => 'unversioned',
    );
    await cp(source, project, {
      recursive: true,
      filter: (path) => isSourcePath(relative(source, path)),
    });
    const buildId = `${sourceRevision}@sha256-${await sourceDigest(project)}`;
    await command(['bun', 'install', '--frozen-lockfile'], project);
    const [cloudPort, sitePort, webPort] = await Promise.all([
      freePort(),
      freePort(),
      freePort(),
    ]);
    if (new Set([cloudPort, sitePort, webPort]).size !== 3)
      throw new Error('Port allocation collision; retry proof');
    const convexUrl = `http://127.0.0.1:${cloudPort}`,
      siteUrl = `http://127.0.0.1:${sitePort}`;
    const webUrl = `http://127.0.0.1:${webPort}`,
      mcpUrl = `${siteUrl}/mcp`;
    const { privateKey } = await generateKeyPair('RS256', {
      modulusLength: 2048,
      extractable: true,
    });
    auth = await startWorkosEmulate(mcpUrl, {
      signingKey: {
        privateKey: await exportPKCS8(privateKey),
        kid: 'disposable-emulate',
      },
    });
    const issuer = auth.emulator.url,
      webAudience = emulateClientId;
    const key = { kid: 'disposable-emulate' };
    const token = (subject: string, audience: string, expired = false) =>
      new SignJWT({})
        .setProtectedHeader({ alg: 'RS256', typ: 'JWT', kid: key.kid })
        .setIssuer(issuer)
        .setSubject(subject)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 60 : '30m')
        .sign(privateKey);
    const [webSession, mcp, otherSession, otherMcp, wrongAudience, expired] =
      await Promise.all([
        auth.passwordSession(0),
        auth.mcpToken(0),
        auth.passwordSession(1),
        auth.mcpToken(1),
        token('user_astack_local_owner', 'wrong-resource'),
        token('user_astack_local_owner', mcpUrl, true),
      ]);
    const web = webSession.accessToken,
      otherWeb = otherSession.accessToken;
    const backend = join(project, 'packages/backend'),
      env = { ...localEnvironment(), CONVEX_AGENT_MODE: 'anonymous' };
    logs.push(await command(['bun', 'run', 'build:mcp-ui'], project));
    const authConfigPath = join(backend, 'convex/auth.config.ts');
    const configuredAuth = await readFile(authConfigPath, 'utf8');
    await writeFile(authConfigPath, 'export default { providers: [] };\n');
    const devArgs = [
      'bunx',
      '--no-install',
      'convex',
      'dev',
      '--typecheck',
      'disable',
      '--local-cloud-port',
      String(cloudPort),
      '--local-site-port',
      String(sitePort),
      '--tail-logs',
      'disable',
    ];
    const bootstrap = launch(devArgs, backend, env, logs);
    processes.push(bootstrap);
    await waitFor(async () => {
      const response = await fetch(`${convexUrl}/instance_name`);
      return response.ok ? true : false;
    }, 'anonymous local Convex backend');
    await waitFor(async () => {
      const content = await readFile(join(backend, '.env.local'), 'utf8');
      return content.includes('CONVEX_DEPLOYMENT') ? true : false;
    }, 'local Convex deployment configuration');
    const settings = {
      ...auth.settings,
      WORKOS_AUTHKIT_DOMAIN: '',
      ASTACK_BUILD_ID: buildId,
    };
    for (const [name, value] of Object.entries(settings))
      await command(
        ['bunx', '--no-install', 'convex', 'env', 'set', name, value],
        backend,
        env,
      );
    await stopProcess(bootstrap);
    await writeFile(authConfigPath, configuredAuth);
    const backendProcess = launch(devArgs, backend, env, logs);
    processes.push(backendProcess);
    await waitFor(async () => {
      const response = await fetch(`${siteUrl}/health`);
      if (!response.ok) return false;
      const identity = (await response.json()) as {
        buildId?: string;
        resource?: string;
        authMode?: string;
      };
      return identity.buildId === buildId &&
        identity.resource === mcpUrl &&
        identity.authMode === 'workos-emulate'
        ? identity
        : false;
    }, 'configured backend build identity');
    const authenticated = new ConvexHttpClient(convexUrl);
    authenticated.setAuth(web);
    await waitFor(async () => {
      const value: unknown = await authenticated.query(
        makeFunctionReference<'query'>('workItems:list'),
        {},
      );
      return Array.isArray(value) ? true : false;
    }, 'deployed auth providers and authenticated backend query');
    const webEnv = {
      ...localEnvironment(),
      VITE_CONVEX_URL: convexUrl,
      ...auth.clientEnvironment(),
      VITE_ASTACK_BUILD_ID: buildId,
    };
    processes.push(
      launch(
        [
          'bunx',
          '--no-install',
          'vite',
          '--host',
          '127.0.0.1',
          '--port',
          String(webPort),
          '--strictPort',
        ],
        join(project, 'apps/web'),
        webEnv,
        logs,
      ),
    );
    await waitFor(async () => {
      const response = await fetch(webUrl);
      return response.ok && (await response.text()).includes('root')
        ? true
        : false;
    }, 'web application');
    return {
      project,
      privateDirectory,
      webUrl,
      convexUrl,
      siteUrl,
      mcpUrl,
      buildId,
      auth,
      issuer,
      webAudience,
      tokens: { web, mcp, otherWeb, otherMcp, wrongAudience, expired },
      logs,
      processes,
      stop,
    };
  } catch (error) {
    const detail = logs.join('').slice(-8000);
    await stop();
    throw new Error(`${redact(String(error))}\n${detail}`);
  }
}
