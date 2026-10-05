import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeJwt, jwtVerify, createRemoteJWKSet } from 'jose';
import { readSettings } from './development';
import { foundationRoot, revisionIdentity } from './runtime';
import { isAuthRejection } from './auth-proof';
import {
  astackStaging,
  stagingClient,
  createDisposableUser,
  readRecoveryJournal,
} from './staging-fixtures';

const output = join(foundationRoot, '.proof', `auth-staging-${Date.now()}`);
await mkdir(output, { recursive: true });
const env = {
  ...(await readSettings(join(foundationRoot, '.env.workos-staging'))),
  ...process.env,
};
const observations: string[] = [];
let outcome: 'pass' | 'fail' | 'skipped' = 'skipped';
let cleanup = 'not needed';
let journal: string | undefined;
try {
  const api = stagingClient(env);
  outcome = 'fail';
  cleanup = 'recovery check required';
  const fixture = await createDisposableUser(
    api.userManagement,
    join(foundationRoot, '.auth-fixtures'),
    false,
    (path) => {
      journal = path;
    },
  );
  try {
    cleanup = 'pending';
    const session = await api.userManagement.authenticateWithPassword({
      clientId: astackStaging.clientId,
      email: fixture.user.email,
      password: fixture.password,
    });
    assert.equal(session.user.id, fixture.user.id);
    const claims = decodeJwt(session.accessToken);
    assert.ok(
      [
        'https://api.workos.com/',
        `https://api.workos.com/user_management/${astackStaging.clientId}`,
      ].includes(String(claims.iss)),
    );
    await jwtVerify(
      session.accessToken,
      createRemoteJWKSet(
        new URL(`https://api.workos.com/sso/jwks/${astackStaging.clientId}`),
      ),
      {
        issuer: String(claims.iss),
        ...(claims.aud ? { audience: astackStaging.clientId } : {}),
      },
    );
    observations.push(
      'Real astack Staging user created with generated password; SDK authenticated; provider signature/issuer validated.',
    );
    const refreshed = await api.userManagement.authenticateWithRefreshToken({
      clientId: astackStaging.clientId,
      refreshToken: session.refreshToken,
    });
    assert.equal(refreshed.user.id, fixture.user.id);
    assert.equal(decodeJwt(refreshed.accessToken).sid, claims.sid);
    await api.userManagement.revokeSession({ sessionId: String(claims.sid) });
    await assert.rejects(
      () =>
        api.userManagement.authenticateWithRefreshToken({
          clientId: astackStaging.clientId,
          refreshToken: refreshed.refreshToken,
        }),
      (error) => isAuthRejection(error, 'invalid_grant'),
    );
    observations.push(
      'Real AuthKit refresh preserves subject/session; revoked session cannot refresh.',
    );
  } finally {
    try {
      await fixture.cleanup();
      cleanup = 'complete';
    } catch {
      cleanup = 'failed; recovery journal retained';
      throw new Error('Cleanup failed');
    }
  }
  outcome = 'pass';
} catch {
  // SDK errors may contain credentials/request bodies. Retain outcomes only.
  observations.push(
    outcome === 'skipped'
      ? 'Scoped astack Staging SDK credentials unavailable or configuration invalid; provider checks not run.'
      : 'Provider operation or assertion failed. Inspect .auth-fixtures for recovery; rerun with scoped staging settings.',
  );
}
await writeFile(
  join(output, 'report.json'),
  JSON.stringify(
    {
      revision: await revisionIdentity(foundationRoot),
      tier: 'real-workos-staging',
      ...astackStaging,
      outcome,
      observations,
      cleanup,
      ...(journal && cleanup !== 'complete'
        ? {
            recovery: await readRecoveryJournal(journal).catch(() => ({
              status: 'journal unavailable; inspect owned external IDs',
            })),
          }
        : {}),
      limits: [
        'No Hosted AuthKit UI/redirect proof.',
        'No real MCP consent/exact-resource issuance or web ↔ MCP continuity.',
        'No installed ChatGPT host.',
      ],
    },
    null,
    2,
  ) + '\n',
);
if (outcome !== 'pass')
  throw new Error(`Staging proof ${outcome}; report: ${output}`);
console.log(`Disposable staging auth proof passed; report: ${output}`);
