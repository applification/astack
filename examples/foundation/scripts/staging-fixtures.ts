import { randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkOS } from '@workos-inc/node';
import { z } from 'zod';

export const astackStaging = {
  environmentId: 'environment_01M44GM0FT8SCNA5D3CYQNY2E5',
  clientId: 'client_01M44GM0TDFFAQKQA7YFX23ZDY',
};
const leaseSchema = z.object({
  runId: z.uuid(),
  clientId: z.string(),
  environmentId: z.string(),
  email: z.string(),
  externalId: z.string(),
  expiresAt: z.iso.datetime(),
  userId: z.string().optional(),
  password: z.string().optional(),
});
type FixtureApi = Pick<
  WorkOS['userManagement'],
  'createUser' | 'getUserByExternalId' | 'deleteUser'
>;

export function stagingClient(env: NodeJS.ProcessEnv) {
  if (
    env.WORKOS_STAGING_ENVIRONMENT_ID !== astackStaging.environmentId ||
    env.WORKOS_STAGING_CLIENT_ID !== astackStaging.clientId ||
    !env.WORKOS_STAGING_API_KEY?.startsWith('sk_test_')
  )
    throw new Error(
      'Select astack Staging explicitly with its environment ID, client ID and scoped sk_test_ API key in .env.workos-staging. No production key or shared login is accepted.',
    );
  return new WorkOS(env.WORKOS_STAGING_API_KEY, {
    clientId: astackStaging.clientId,
    maxRetries: 2,
    timeout: 15_000,
  });
}

export async function createDisposableUser(
  api: FixtureApi,
  directory: string,
  manual = false,
  onJournal?: (path: string) => void,
) {
  const runId = randomUUID();
  const password = `Aa1!${randomBytes(24).toString('base64url')}`;
  const lease = {
    runId,
    ...astackStaging,
    email: `astack-proof+${runId}@example.com`,
    externalId: `astack-proof:${runId}`,
    expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    ...(manual ? { password } : {}),
  };
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${runId}.json`);
  // Journal intent before the remote write; externalId also recovers a lost create response.
  await writeFile(path, JSON.stringify(lease), { mode: 0o600, flag: 'wx' });
  onJournal?.(path);
  try {
    const user = await api.createUser({
      email: lease.email,
      password,
      emailVerified: true,
      externalId: lease.externalId,
      firstName: 'astack',
      lastName: 'Disposable',
    });
    await writeFile(path, JSON.stringify({ ...lease, userId: user.id }), {
      mode: 0o600,
    });
    return {
      user,
      password,
      path,
      cleanup: () => cleanupDisposableUser(api, path),
    };
  } catch (error) {
    await cleanupDisposableUser(api, path);
    throw error;
  }
}

export async function readRecoveryJournal(path: string) {
  // Only noncredential fields may enter a provider report.
  return leaseSchema
    .omit({ password: true })
    .parse(JSON.parse(await readFile(path, 'utf8')) as unknown);
}

export async function recoverDisposableUser(
  api: FixtureApi,
  directory: string,
  runId: string,
) {
  z.uuid().parse(runId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const path = join(directory, `${runId}.json`);
  try {
    await writeFile(
      path,
      JSON.stringify({
        runId,
        ...astackStaging,
        email: `astack-proof+${runId}@example.com`,
        externalId: `astack-proof:${runId}`,
        expiresAt: new Date().toISOString(),
      }),
      { mode: 0o600, flag: 'wx' },
    );
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST'))
      throw error;
  }
  await cleanupDisposableUser(api, path);
}

export async function cleanupDisposableUser(api: FixtureApi, path: string) {
  const lease = leaseSchema.parse(
    JSON.parse(await readFile(path, 'utf8')) as unknown,
  );
  if (
    lease.environmentId !== astackStaging.environmentId ||
    lease.clientId !== astackStaging.clientId ||
    lease.externalId !== `astack-proof:${lease.runId}` ||
    lease.email !== `astack-proof+${lease.runId}@example.com`
  )
    throw new Error(
      'Refusing cleanup of an identity that is not owned by this acceptance/proof run.',
    );
  let user;
  try {
    user = await api.getUserByExternalId(lease.externalId);
  } catch (error) {
    if (!(error instanceof Error && 'status' in error && error.status === 404))
      throw error;
  }
  if (user) {
    if (
      user.email !== lease.email ||
      user.externalId !== lease.externalId ||
      (lease.userId && user.id !== lease.userId)
    )
      throw new Error(
        'Fixture identity changed; preserve the recovery journal for inspection.',
      );
    await api.deleteUser(user.id);
    try {
      await api.getUserByExternalId(lease.externalId);
      throw new Error('Fixture deletion did not remove the user.');
    } catch (error) {
      if (!(
        error instanceof Error &&
        'status' in error &&
        error.status === 404
      ))
        throw error;
    }
  }
  await rm(path);
}

export async function withDisposableUser<T>(
  api: FixtureApi,
  directory: string,
  action: (
    fixture: Awaited<ReturnType<typeof createDisposableUser>>,
  ) => Promise<T>,
) {
  const fixture = await createDisposableUser(api, directory);
  try {
    return await action(fixture);
  } finally {
    await fixture.cleanup();
  }
}
