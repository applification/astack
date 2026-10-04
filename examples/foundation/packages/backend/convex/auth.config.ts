import type { AuthConfig } from 'convex/server';

import { isLoopbackUrl, localProofEnabled } from './lib/identity';

const providers: AuthConfig['providers'] = [];

if (localProofEnabled()) {
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
      new URL(applicationID).protocol !== 'https:'
    ) {
      throw new Error(
        'WorkOS MCP authentication requires HTTPS issuer and resource URLs.',
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
