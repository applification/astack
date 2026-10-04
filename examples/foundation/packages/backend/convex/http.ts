import { httpRouter } from 'convex/server';
import { z } from 'zod';

import { httpAction } from './_generated/server';
import { localProofEnabled, requireUser } from './lib/identity';
import { handleMcpRequest } from './lib/mcp';

const http = httpRouter();
const claimsSchema = z.object({
  iss: z.string(),
  sub: z.string(),
  aud: z.union([z.string(), z.array(z.string())]),
});

function jsonResponse(
  value: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

function boundaryFailure(request: Request): Response | null {
  const resource = process.env.MCP_RESOURCE_URL ?? process.env.CONVEX_SITE_URL;
  if (!resource)
    return jsonResponse({ error: 'MCP resource is not configured.' }, 503);
  const origin = new URL(resource).origin;
  const requested = new URL(request.url);
  if (requested.origin !== origin)
    return jsonResponse({ error: 'Unexpected resource host.' }, 400);
  const suppliedHost = request.headers.get('host');
  if (suppliedHost !== null && suppliedHost !== requested.host) {
    return jsonResponse({ error: 'Unexpected resource host.' }, 400);
  }
  const suppliedOrigin = request.headers.get('origin');
  if (
    suppliedOrigin !== null &&
    ![origin, process.env.WEB_ORIGIN].includes(suppliedOrigin)
  ) {
    return jsonResponse({ error: 'Origin is not permitted.' }, 403);
  }
  return null;
}

function unauthorized(): Response {
  const resource = process.env.MCP_RESOURCE_URL;
  const headers = resource
    ? {
        'WWW-Authenticate': `Bearer error="invalid_token", resource_metadata="${new URL(resource).origin}/.well-known/oauth-protected-resource/mcp"`,
      }
    : {};
  return jsonResponse(
    { error: 'MCP authorization is required.' },
    401,
    headers,
  );
}

function readValidatedClaims(request: Request): z.infer<typeof claimsSchema> {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer ([^\s]+)$/i)?.[1];
  const encoded = token?.split('.')[1];
  if (!encoded) throw new Error('Missing token claims.');
  const normalized = encoded.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='),
  );
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  return claimsSchema.parse(value);
}

const mcp = httpAction(async (ctx, request) => {
  const failure = boundaryFailure(request);
  if (failure) return failure;
  const issuer = localProofEnabled()
    ? process.env.ASTACK_PROOF_ISSUER
    : process.env.WORKOS_AUTHKIT_DOMAIN;
  const resource = process.env.MCP_RESOURCE_URL;
  if (!issuer || !resource)
    return jsonResponse(
      { error: 'MCP authentication is not configured.' },
      503,
    );
  try {
    // Convex verifies the signature and expiry first. Reading the same bearer’s claims
    // then narrows this route to its MCP audience rather than the also-supported SPA.
    const identity = await requireUser(ctx.auth);
    const claims = readValidatedClaims(request);
    const audiences =
      typeof claims.aud === 'string' ? [claims.aud] : claims.aud;
    if (
      identity.issuer !== issuer ||
      claims.iss !== identity.issuer ||
      claims.sub !== identity.subject ||
      !audiences.includes(resource)
    )
      return unauthorized();
  } catch {
    return unauthorized();
  }
  return await handleMcpRequest(ctx, request);
});

const metadata = httpAction((_, request) => {
  const failure = boundaryFailure(request);
  if (failure) return Promise.resolve(failure);
  const issuer = localProofEnabled()
    ? process.env.ASTACK_PROOF_ISSUER
    : process.env.WORKOS_AUTHKIT_DOMAIN;
  const resource = process.env.MCP_RESOURCE_URL;
  if (!issuer || !resource)
    return Promise.resolve(
      jsonResponse({ error: 'MCP authentication is not configured.' }, 503),
    );
  return Promise.resolve(
    jsonResponse({
      resource,
      authorization_servers: [issuer],
      bearer_methods_supported: ['header'],
      scopes_supported: ['openid', 'profile', 'email'],
    }),
  );
});

for (const method of ['POST', 'GET', 'DELETE'] as const) {
  http.route({ path: '/mcp', method, handler: mcp });
}
for (const path of [
  '/.well-known/oauth-protected-resource/mcp',
  '/.well-known/oauth-protected-resource',
]) {
  http.route({ path, method: 'GET', handler: metadata });
}
http.route({
  path: '/health',
  method: 'GET',
  handler: httpAction(() =>
    Promise.resolve(
      jsonResponse({
        service: 'astack-foundation',
        buildId: process.env.ASTACK_BUILD_ID ?? 'unconfigured',
        resource: process.env.MCP_RESOURCE_URL ?? null,
        authMode: localProofEnabled() ? 'local-proof' : 'workos',
        profile: 'react-vite-convex-workos-mcp',
      }),
    ),
  ),
});

export default http;
