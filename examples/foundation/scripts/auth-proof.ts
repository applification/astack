import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { decodeJwt, createLocalJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';
import {
  startWorkosEmulate,
  emulateClientId,
  emulateUsers,
} from './workos-emulate';
import { foundationRoot, revisionIdentity } from './runtime';

export function isAuthRejection(error: unknown, code: string): boolean {
  return (
    error instanceof Error &&
    'status' in error &&
    (error.status === 400 || error.status === 401) &&
    (('code' in error && error.code === code) ||
      ('error' in error && error.error === code))
  );
}

export async function verifyEmulateAuth(
  auth: Awaited<ReturnType<typeof startWorkosEmulate>>,
) {
  const session = await auth.passwordSession();
  const claims = decodeJwt(session.accessToken);
  assert.equal(session.user.id, emulateUsers[0].id);
  assert.equal(claims.sub, session.user.id);
  assert.equal(claims.aud, emulateClientId);
  assert.equal(
    claims.iss,
    `${auth.emulator.url}/user_management/${emulateClientId}`,
  );
  const keySet = z
    .object({ keys: z.array(z.record(z.string(), z.unknown())) })
    .parse(await (await fetch(`${auth.emulator.url}/oauth2/jwks`)).json());
  await jwtVerify(session.accessToken, createLocalJWKSet(keySet), {
    issuer: claims.iss,
    audience: emulateClientId,
  });
  const identities = await auth.api.userManagement.getUserIdentities(
    session.user.id,
  );
  assert.ok(identities.some((identity) => identity.provider === 'GoogleOAuth'));
  await assert.rejects(
    () =>
      auth.api.userManagement.authenticateWithPassword({
        clientId: emulateClientId,
        email: emulateUsers[0].email,
        password: 'incorrect',
      }),
    (error) => isAuthRejection(error, 'invalid_credentials'),
  );
  const refreshed = await auth.api.userManagement.authenticateWithRefreshToken({
    clientId: emulateClientId,
    refreshToken: session.refreshToken,
  });
  assert.equal(refreshed.user.id, session.user.id);
  assert.equal(decodeJwt(refreshed.accessToken).sid, claims.sid);
  assert.notEqual(refreshed.refreshToken, session.refreshToken);
  await assert.rejects(
    () =>
      auth.api.userManagement.authenticateWithRefreshToken({
        clientId: emulateClientId,
        refreshToken: session.refreshToken,
      }),
    (error) => isAuthRejection(error, 'invalid_grant'),
  );
  assert.equal(typeof claims.sid, 'string');
  await auth.api.userManagement.revokeSession({
    sessionId: String(claims.sid),
  });
  await assert.rejects(
    () =>
      auth.api.userManagement.authenticateWithRefreshToken({
        clientId: emulateClientId,
        refreshToken: refreshed.refreshToken,
      }),
    (error) => isAuthRejection(error, 'invalid_grant'),
  );
  const mcp = decodeJwt(await auth.mcpToken());
  assert.equal(mcp.sub, session.user.id);
  assert.notEqual(mcp.iss, claims.iss);
  return [
    'seeded user and linked identity; SDK password authentication; signature/issuer/audience',
    'incorrect password rejected; refresh rotates and preserves subject/session; replay rejected',
    'revocation prevents refresh (already-issued access JWTs remain valid until expiry)',
    'Emulate-issued web and Connect tokens share the seeded subject with distinct issuers',
  ];
}

if (import.meta.main) {
  const output = join(foundationRoot, '.proof', `auth-emulate-${Date.now()}`);
  await mkdir(output, { recursive: true });
  const revision = await revisionIdentity(foundationRoot);
  const auth = await startWorkosEmulate('http://127.0.0.1:3211/mcp');
  const observations: string[] = [];
  let failure = false,
    cleanup = 'complete';
  try {
    observations.push(...(await verifyEmulateAuth(auth)));
  } catch {
    failure = true;
  } finally {
    try {
      await auth.close();
    } catch {
      failure = true;
      cleanup = 'failed';
    }
    await writeFile(
      join(output, 'report.json'),
      JSON.stringify(
        {
          revision,
          tier: 'workos-emulate',
          outcome: failure ? 'fail' : 'pass',
          observations,
          cleanup,
          limits: [
            'No real WorkOS service or Hosted AuthKit.',
            'No real MCP consent/DCR/PKCE/resource negotiation or Connect refresh.',
            'No installed ChatGPT host.',
          ],
        },
        null,
        2,
      ) + '\n',
    );
  }
  if (failure)
    throw new Error(`Emulate authentication proof failed; report: ${output}`);
  console.log(`Emulate auth/session proof passed; report: ${output}`);
}
