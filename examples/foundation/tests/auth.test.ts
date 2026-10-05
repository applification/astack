import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startWorkosEmulate } from '../scripts/workos-emulate';
import { verifyEmulateAuth, isAuthRejection } from '../scripts/auth-proof';
import {
  astackStaging,
  stagingClient,
  createDisposableUser,
  cleanupDisposableUser,
  withDisposableUser,
  recoverDisposableUser,
  readRecoveryJournal,
} from '../scripts/staging-fixtures';
import { isSourcePath } from '../scripts/source-identity';
import { emulateEnabled } from '../packages/backend/convex/lib/identity';

test('official Emulate exercises seeded identity, password/session and token contracts', async () => {
  const auth = await startWorkosEmulate('http://127.0.0.1:3211/mcp');
  try {
    expect(await verifyEmulateAuth(auth)).toHaveLength(4);
  } finally {
    await auth.close();
  }
});

test('disposable fixtures are unique and clean up even when the test fails', async () => {
  const auth = await startWorkosEmulate('http://127.0.0.1:3211/mcp');
  const directory = await mkdtemp(join(tmpdir(), 'astack-fixtures-'));
  let userId: string | undefined;
  try {
    await assert.rejects(
      withDisposableUser(
        auth.api.userManagement,
        directory,
        async (fixture) => {
          userId = fixture.user.id;
          const lease = await readFile(fixture.path, 'utf8');
          expect(lease).not.toContain(fixture.password);
          const session =
            await auth.api.userManagement.authenticateWithPassword({
              clientId: 'client_astackEmulate',
              email: fixture.user.email,
              password: fixture.password,
            });
          expect(session.user.id).toBe(userId);
          throw new Error('Deliberate failing worker');
        },
      ),
      /Deliberate failing worker/,
    );
    expect(await readdir(directory)).toEqual([]);
    expect(userId).toBeDefined();
    await assert.rejects(() => auth.api.userManagement.getUser(userId ?? ''));
    const first = await createDisposableUser(
      auth.api.userManagement,
      directory,
      true,
    );
    const second = await createDisposableUser(
      auth.api.userManagement,
      directory,
      true,
    );
    expect(first.user.id).not.toBe(second.user.id);
    expect(first.password).not.toBe(second.password);
    expect(first.user.email).not.toBe(second.user.email);
    expect((await stat(first.path)).mode & 0o777).toBe(0o600);
    expect(await readRecoveryJournal(first.path)).not.toHaveProperty(
      'password',
    );
    await rm(first.path);
    await recoverDisposableUser(
      auth.api.userManagement,
      directory,
      first.user.externalId?.split(':')[1] ?? '',
    );
    await second.cleanup();
  } finally {
    await auth.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('a lost create response is recovered by owned external ID and cleaned up', async () => {
  const auth = await startWorkosEmulate('http://127.0.0.1:3211/mcp');
  const directory = await mkdtemp(join(tmpdir(), 'astack-fixtures-recovery-'));
  try {
    const api = auth.api.userManagement;
    await assert.rejects(
      createDisposableUser(
        {
          createUser: async (options) => {
            await api.createUser(options);
            throw new Error('Lost response');
          },
          getUserByExternalId: api.getUserByExternalId.bind(api),
          deleteUser: api.deleteUser.bind(api),
        },
        directory,
      ),
      /Lost response/,
    );
    expect(await readdir(directory)).toEqual([]);
    expect((await api.listUsers()).data).toHaveLength(2);
    const fixture = await createDisposableUser(api, directory);
    await assert.rejects(
      cleanupDisposableUser(
        {
          createUser: api.createUser.bind(api),
          deleteUser: api.deleteUser.bind(api),
          getUserByExternalId: async (id) => ({
            ...(await api.getUserByExternalId(id)),
            email: 'changed@example.com',
          }),
        },
        fixture.path,
      ),
      /Fixture identity changed/,
    );
    expect(await readdir(directory)).toHaveLength(1);
    await api.deleteUser(fixture.user.id);
  } finally {
    await auth.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test('provider runner requires explicit astack staging and rejects production credentials', () => {
  for (const env of [
    {},
    { WORKOS_STAGING_API_KEY: 'sk_live_private' },
    {
      WORKOS_STAGING_ENVIRONMENT_ID: 'environment_wrong',
      WORKOS_STAGING_CLIENT_ID: astackStaging.clientId,
      WORKOS_STAGING_API_KEY: 'sk_test_local',
    },
  ])
    expect(() => stagingClient(env)).toThrow(
      'Select astack Staging explicitly',
    );
  expect(isSourcePath('.auth-fixtures/run.json')).toBe(false);
});

test('Emulate cannot be enabled against cloud Convex or a remote/credentialed issuer', () => {
  const saved = {
    ASTACK_AUTH_MODE: process.env.ASTACK_AUTH_MODE,
    WORKOS_EMULATE_URL: process.env.WORKOS_EMULATE_URL,
    CONVEX_SITE_URL: process.env.CONVEX_SITE_URL,
  };
  try {
    process.env.ASTACK_AUTH_MODE = 'emulate';
    for (const [site, issuer] of [
      ['https://example.convex.site', 'http://localhost:4100'],
      ['http://127.0.0.1:3211', 'https://example.com'],
      ['http://127.0.0.1:3211', 'http://key@localhost:4100'],
    ]) {
      process.env.CONVEX_SITE_URL = site;
      process.env.WORKOS_EMULATE_URL = issuer;
      expect(() => emulateEnabled()).toThrow('restricted');
    }
    process.env.CONVEX_SITE_URL = 'http://127.0.0.1:3211';
    process.env.WORKOS_EMULATE_URL = 'http://localhost:4100';
    expect(emulateEnabled()).toBe(true);
  } finally {
    if (saved.ASTACK_AUTH_MODE === undefined)
      delete process.env.ASTACK_AUTH_MODE;
    else process.env.ASTACK_AUTH_MODE = saved.ASTACK_AUTH_MODE;
    if (saved.WORKOS_EMULATE_URL === undefined)
      delete process.env.WORKOS_EMULATE_URL;
    else process.env.WORKOS_EMULATE_URL = saved.WORKOS_EMULATE_URL;
    if (saved.CONVEX_SITE_URL === undefined) delete process.env.CONVEX_SITE_URL;
    else process.env.CONVEX_SITE_URL = saved.CONVEX_SITE_URL;
  }
});

test('an authentication outage cannot be counted as rejected credentials', () => {
  expect(
    isAuthRejection(
      Object.assign(new Error('unavailable'), {
        status: 503,
        error: 'invalid_grant',
      }),
      'invalid_grant',
    ),
  ).toBe(false);
  expect(
    isAuthRejection(new Error('Network disconnected'), 'invalid_grant'),
  ).toBe(false);
  expect(
    isAuthRejection(
      Object.assign(new Error('invalid'), {
        status: 400,
        error: 'invalid_grant',
      }),
      'invalid_grant',
    ),
  ).toBe(true);
});
