import { StrictMode, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react';
import { ConvexProviderWithAuthKit } from '@convex-dev/workos';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
import { Notice, Workspace } from '@foundation/ui';
import '@foundation/ui/styles.css';

const url: unknown = import.meta.env['VITE_CONVEX_URL'];
if (typeof url !== 'string' || !url)
  throw new Error('Set VITE_CONVEX_URL; see apps/web/.env.example.');
const convex = new ConvexReactClient(url);
function useProofAuth() {
  const token: unknown = import.meta.env['VITE_ASTACK_PROOF_TOKEN'];
  const fetchAccessToken = useCallback(
    () => Promise.resolve(typeof token === 'string' ? token : null),
    [token],
  );
  return {
    isLoading: false,
    isAuthenticated: typeof token === 'string',
    fetchAccessToken,
  };
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');
const localProof = import.meta.env['VITE_ASTACK_PROOF_MODE'] === 'local';
root.dataset['buildId'] = String(
  import.meta.env['VITE_ASTACK_BUILD_ID'] ?? 'development',
);
if (
  localProof &&
  (!['127.0.0.1', 'localhost'].includes(location.hostname) ||
    !['127.0.0.1', 'localhost'].includes(new URL(url).hostname))
)
  throw new Error('Proof authentication is restricted to loopback.');
const clientId: unknown = import.meta.env['VITE_WORKOS_CLIENT_ID'];
const redirectUri: unknown =
  import.meta.env['VITE_WORKOS_REDIRECT_URI'] || `${location.origin}/`;
const apiHostname: unknown = import.meta.env['VITE_WORKOS_API_HOSTNAME'];
const emulate = import.meta.env['VITE_ASTACK_AUTH_MODE'] === 'emulate';
if (
  emulate &&
  (!['127.0.0.1', 'localhost'].includes(location.hostname) ||
    !['127.0.0.1', 'localhost'].includes(new URL(url).hostname) ||
    apiHostname !== 'localhost')
)
  throw new Error('WorkOS Emulate is restricted to loopback.');
const devMode = import.meta.env['VITE_WORKOS_DEV_MODE'] === 'true';
if (
  devMode &&
  !(
    ['127.0.0.1', 'localhost'].includes(location.hostname) ||
    location.hostname.endsWith('.localhost')
  )
)
  throw new Error(
    'AuthKit development mode is restricted to loopback. Configure a custom authentication API hostname for deployed web.',
  );
createRoot(root).render(
  <StrictMode>
    {localProof ? (
      <ConvexProviderWithAuth client={convex} useAuth={useProofAuth}>
        <RouterProvider router={router} />
      </ConvexProviderWithAuth>
    ) : typeof clientId === 'string' &&
      /^client_[A-Za-z0-9]+$/.test(clientId) &&
      typeof redirectUri === 'string' ? (
      <AuthKitProvider
        clientId={clientId}
        redirectUri={redirectUri}
        devMode={devMode}
        {...(emulate
          ? {
              https: false,
              port: Number(import.meta.env['VITE_WORKOS_API_PORT']),
            }
          : {})}
        {...(typeof apiHostname === 'string' && apiHostname
          ? { apiHostname }
          : {})}
      >
        <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
          <RouterProvider router={router} />
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    ) : (
      <Workspace>
        <Notice>
          Connect a WorkOS staging sandbox to sign in to your private work
          items.
        </Notice>
        <p>
          Ask astack to configure WorkOS, or run this once in the reference
          directory:
        </p>
        <pre style={{ whiteSpace: 'pre-wrap' }}>
          bun run setup:workos --client-id client_... --authkit-domain
          https://YOUR-DOMAIN.authkit.app
        </pre>
        <p>
          The client ID identifies your app; the AuthKit domain issues MCP OAuth
          tokens. No API key is needed in the browser. Restart bun dev after
          setup. See README.md for the allowed local redirects and origins.
        </p>
      </Workspace>
    )}
  </StrictMode>,
);
