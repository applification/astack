import { StrictMode, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthKitProvider, useAuth } from '@workos-inc/authkit-react';
import { ConvexProviderWithAuthKit } from '@convex-dev/workos';
import { ConvexProviderWithAuth, ConvexReactClient } from 'convex/react';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';
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
const redirectUri: unknown = import.meta.env['VITE_WORKOS_REDIRECT_URI'];
const apiHostname: unknown = import.meta.env['VITE_WORKOS_API_HOSTNAME'];
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
    ) : typeof clientId === 'string' && typeof redirectUri === 'string' ? (
      <AuthKitProvider
        clientId={clientId}
        redirectUri={redirectUri}
        devMode={devMode}
        {...(typeof apiHostname === 'string' && apiHostname
          ? { apiHostname }
          : {})}
      >
        <ConvexProviderWithAuthKit client={convex} useAuth={useAuth}>
          <RouterProvider router={router} />
        </ConvexProviderWithAuthKit>
      </AuthKitProvider>
    ) : (
      <p>Configure WorkOS using apps/web/.env.example.</p>
    )}
  </StrictMode>,
);
