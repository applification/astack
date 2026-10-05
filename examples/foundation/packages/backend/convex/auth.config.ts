import type { AuthConfig } from 'convex/server';

import {
  isLoopbackUrl,
  isLocalMcpResource,
  localProofEnabled,
  emulateEnabled,
} from './lib/identity';

const providers: AuthConfig['providers'] = [];

if (emulateEnabled()) {
  const issuer = process.env.WORKOS_EMULATE_URL;
  const jwks = process.env.WORKOS_EMULATE_JWKS;
  const clientId = process.env.WORKOS_CLIENT_ID;
  const resource = process.env.MCP_RESOURCE_URL;
  if (
    !issuer ||
    !jwks?.startsWith('data:application/json;base64,') ||
    !clientId ||
    !resource ||
    !isLocalMcpResource(process.env.CONVEX_SITE_URL, resource)
  )
    throw new Error(
      'Emulate requires its inline public JWKS, client and exact local MCP resource.',
    );
  providers.push(
    {
      type: 'customJwt',
      issuer: `${issuer}/user_management/${clientId}`,
      jwks,
      algorithm: 'RS256',
      applicationID: clientId,
    },
    {
      type: 'customJwt',
      issuer,
      jwks,
      algorithm: 'RS256',
      applicationID: resource,
    },
  );
} else if (localProofEnabled()) {
  const issuer = process.env.ASTACK_PROOF_ISSUER;
  const jwks = process.env.ASTACK_PROOF_JWKS;
  const webAudience = process.env.ASTACK_PROOF_WEB_AUDIENCE;
  const mcpAudience = process.env.MCP_RESOURCE_URL;

  if (issuer && jwks && webAudience && mcpAudience) {
    if (
      !isLoopbackUrl(issuer) ||
      !isLoopbackUrl(mcpAudience) ||
      !jwks.startsWith('data:')
    ) {
      throw new Error(
        'Local proof issuers and resources must use loopback URLs and an inline public JWKS.',
      );
    }
    if (webAudience === mcpAudience) {
      throw new Error('Web and MCP proof tokens need different audiences.');
    }
    for (const applicationID of [webAudience, mcpAudience]) {
      providers.push({
        type: 'customJwt',
        issuer,
        jwks,
        algorithm: 'RS256',
        applicationID,
      });
    }
  }
} else {
  const clientId = process.env.WORKOS_CLIENT_ID;
  if (clientId) {
    // The official Convex WorkOS integration supports both session-token issuers.
    providers.push(
      {
        type: 'customJwt',
        issuer: 'https://api.workos.com/',
        algorithm: 'RS256',
        jwks: `https://api.workos.com/sso/jwks/${clientId}`,
        applicationID: clientId,
      },
      {
        type: 'customJwt',
        issuer: `https://api.workos.com/user_management/${clientId}`,
        algorithm: 'RS256',
        jwks: `https://api.workos.com/sso/jwks/${clientId}`,
      },
    );
  }
  const issuer = process.env.WORKOS_AUTHKIT_DOMAIN;
  const applicationID = process.env.MCP_RESOURCE_URL;
  if (issuer && applicationID) {
    if (
      new URL(issuer).protocol !== 'https:' ||
      (new URL(applicationID).protocol !== 'https:' &&
        !isLocalMcpResource(process.env.CONVEX_SITE_URL, applicationID))
    ) {
      throw new Error(
        'WorkOS requires an HTTPS issuer and an HTTPS resource, or the exact loopback origin of a local Convex deployment.',
      );
    }
    providers.push({
      type: 'customJwt',
      issuer,
      algorithm: 'RS256',
      jwks: `${issuer.replace(/\/$/, '')}/oauth2/jwks`,
      applicationID,
    });
  }
}

// An unconfigured fresh deployment accepts no identities; protected APIs fail closed.
export default { providers } satisfies AuthConfig;
