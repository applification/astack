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
let operation = 'local staging configuration';
let failure:
  | { operation: string; status?: number; kind: string; code?: string }
  | undefined;
try {
  const api = stagingClient(env);
  outcome = 'fail';
  cleanup = 'recovery check required';
  operation = 'create disposable user';
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
    observations.push('Disposable staging user setup completed.');
    operation = 'password authentication';
    const session = await api.userManagement.authenticateWithPassword({
      clientId: astackStaging.clientId,
      email: fixture.user.email,
      password: fixture.password,
    });
    operation = 'authenticated subject assertion';
    assert.equal(session.user.id, fixture.user.id);
    observations.push(
      'SDK password authentication returned the disposable subject.',
    );
    const claims = decodeJwt(session.accessToken);
    operation = 'session subject assertion';
    assert.equal(claims.sub, fixture.user.id);
    assert.equal(typeof claims.sid, 'string');
    operation = 'session issuer assertion';
    assert.ok(
      [
        'https://api.workos.com/',
        `https://api.workos.com/user_management/${astackStaging.clientId}`,
      ].includes(String(claims.iss)),
    );
    operation = 'session signature validation';
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
      'Real astack Staging user created with generated password; SDK authenticated; provider signature/issuer/subject validated.',
    );
    operation = 'refresh session';
    const refreshed = await api.userManagement.authenticateWithRefreshToken({
      clientId: astackStaging.clientId,
      refreshToken: session.refreshToken,
    });
    operation = 'refresh subject/session assertion';
    assert.equal(refreshed.user.id, fixture.user.id);
    const refreshedClaims = decodeJwt(refreshed.accessToken);
    assert.equal(refreshedClaims.sub, fixture.user.id);
    assert.equal(refreshedClaims.sid, claims.sid);
    operation = 'revoke session';
    await api.userManagement.revokeSession({ sessionId: String(claims.sid) });
    operation = 'revoked refresh rejection';
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
      operation = 'delete and verify disposable user';
      cleanup = 'failed; recovery journal retained';
      throw new Error('Cleanup failed');
    }
  }
  outcome = 'pass';
} catch (error) {
  // Only fixed operation names, numeric statuses and a broad error category.
  // Raw SDK messages, request bodies, tokens and passwords are never recorded.
  const publicCodes = new Set([
    'invalid_credentials',
    'invalid_grant',
    'invalid_request',
    'invalid_client',
    'email_verification_required',
    'organization_selection_required',
    'mfa_enrollment',
    'mfa_challenge',
    'mfa_verification',
    'radar_email_challenge',
    'radar_sms_challenge',
    'sso_required',
    'password_authentication_disabled',
    'password_authentication_not_enabled',
  ]);
  const code =
    error instanceof Error
      ? 'code' in error
        ? error.code
        : 'error' in error
          ? error.error
          : undefined
      : undefined;
  failure = {
    operation,
    ...(typeof code === 'string' && publicCodes.has(code) ? { code } : {}),
    ...(error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number'
      ? { status: error.status }
      : {}),
    kind: error instanceof assert.AssertionError ? 'assertion' : 'operation',
  };
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
      ...(failure ? { failure } : {}),
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
