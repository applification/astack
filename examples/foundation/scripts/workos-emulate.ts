import { createEmulator, type EmulatorOptions } from '@workos/emulate';
import { WorkOS } from '@workos-inc/node';
import { z } from 'zod';

// Public, emulator-only fixtures. Never create these identities in WorkOS Staging.
export const emulateClientId = 'client_astackEmulate';
export const emulateUsers = [
  { id: 'user_astack_local_owner', email: 'owner@example.com' },
  { id: 'user_astack_local_other', email: 'other@example.com' },
] as const;
export const emulatePassword = 'Local-Emulate-only-2026!';
const connectClient = 'client_astackLocalMcp';
const connectSecret = 'astack-emulator-only-secret';
const callback = 'http://127.0.0.1/emulate-callback';
const tokenResult = z.object({ access_token: z.string() });

export async function startWorkosEmulate(
  resource: string,
  options: Pick<EmulatorOptions, 'port' | 'signingKey'> = {},
) {
  const emulator = await createEmulator({
    port: options.port ?? 0,
    ...(options.signingKey ? { signingKey: options.signingKey } : {}),
    interactiveAuth: { password: true },
    seed: {
      users: emulateUsers.map((user) => ({
        ...user,
        external_id: user.id,
        password: emulatePassword,
        email_verified: true,
        oauth_provider: 'GoogleOAuth',
        oauth_idp_id: `emulate-${user.id}`,
      })),
      connectApplications: [
        {
          name: 'astack local MCP token contract',
          type: 'oauth',
          client_id: connectClient,
          client_secret: connectSecret,
          audience: resource,
          scopes: ['openid', 'profile', 'email'],
          login_url: callback,
          redirect_uris: [callback],
        },
      ],
    },
  });
  try {
    const api = new WorkOS(emulator.apiKey, {
      apiHostname: 'localhost',
      https: false,
      port: emulator.port,
      clientId: emulateClientId,
      maxRetries: 0,
      timeout: 10_000,
    });
    const jwksResponse = await fetch(`${emulator.url}/oauth2/jwks`);
    if (!jwksResponse.ok) throw new Error('Emulate JWKS unavailable.');
    const jwks = `data:application/json;base64,${Buffer.from(await jwksResponse.text()).toString('base64')}`;

    async function passwordSession(index: 0 | 1 = 0) {
      return await api.userManagement.authenticateWithPassword({
        clientId: emulateClientId,
        email: emulateUsers[index].email,
        password: emulatePassword,
      });
    }
    const mcpToken = (index: 0 | 1 = 0) => emulateMcpToken(emulator, index);
    return {
      emulator,
      api,
      jwks,
      passwordSession,
      mcpToken,
      settings: {
        ASTACK_AUTH_MODE: 'emulate',
        ASTACK_PROOF_MODE: 'disabled',
        WORKOS_EMULATE_URL: emulator.url,
        WORKOS_EMULATE_JWKS: jwks,
        WORKOS_CLIENT_ID: emulateClientId,
        MCP_RESOURCE_URL: resource,
      },
      clientEnvironment(): NodeJS.ProcessEnv {
        return {
          ASTACK_AUTH_MODE: 'emulate',
          VITE_ASTACK_AUTH_MODE: 'emulate',
          VITE_ASTACK_PROOF_MODE: 'disabled',
          VITE_WORKOS_CLIENT_ID: emulateClientId,
          VITE_WORKOS_API_HOSTNAME: 'localhost',
          VITE_WORKOS_API_PORT: String(emulator.port),
          VITE_WORKOS_DEV_MODE: 'true',
          ASTACK_EMULATE_URL: emulator.url,
        };
      },
      close: () => emulator.close(),
    };
  } catch (error) {
    await emulator.close();
    throw error;
  }
}

export async function emulateMcpToken(
  emulator: { url: string; apiKey: string },
  index: 0 | 1 = 0,
) {
  const url = new URL(emulator.url);
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.origin !== emulator.url ||
    url.username ||
    url.password
  )
    throw new Error('Emulate token setup requires loopback.');
  // Official Emulate Standalone Connect flow. It models signed token claims,
  // not real MCP DCR/PKCE/resource negotiation, consent or Connect refresh.
  const authorize = new URL('/oauth2/authorize', emulator.url);
  authorize.search = new URLSearchParams({
    client_id: connectClient,
    redirect_uri: callback,
    response_type: 'code',
  }).toString();
  const entry = await fetch(authorize, { redirect: 'manual' });
  const location = entry.headers.get('location');
  if (!location) throw new Error('Emulate Connect entry failed.');
  const externalAuthId = new URL(location).searchParams.get('external_auth_id');
  const complete = await fetch(`${emulator.url}/authkit/oauth2/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${emulator.apiKey}`,
    },
    body: JSON.stringify({
      external_auth_id: externalAuthId,
      user: emulateUsers[index],
    }),
  });
  if (!complete.ok) throw new Error('Emulate Connect completion failed.');
  const result = z
    .object({ redirect_uri: z.string() })
    .parse(await complete.json());
  const redeemed = await fetch(result.redirect_uri, { redirect: 'manual' });
  const destination = redeemed.headers.get('location');
  if (!destination) throw new Error('Emulate Connect callback failed.');
  const code = new URL(destination).searchParams.get('code');
  const exchanged = await fetch(`${emulator.url}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: callback,
      client_id: connectClient,
      client_secret: connectSecret,
    }),
  });
  if (!exchanged.ok) throw new Error('Emulate Connect exchange failed.');
  return tokenResult.parse(await exchanged.json()).access_token;
}
