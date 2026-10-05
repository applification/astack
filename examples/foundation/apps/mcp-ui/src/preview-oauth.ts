import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import {
  OAuthClientInformationFullSchema,
  OAuthTokensSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import type {
  OAuthClientInformationMixed,
  OAuthTokens,
} from '@modelcontextprotocol/sdk/shared/auth.js';

/** Public PKCE client, scoped to this browser session and the selected local server. */
export class PreviewOAuth implements OAuthClientProvider {
  private readonly prefix: string;
  readonly redirectUrl: string;
  constructor(
    serverUrl: string,
    origin: string,
    private readonly storage: Storage,
    private readonly navigate: (url: string) => void,
  ) {
    this.prefix = `astack-mcp-preview:${serverUrl}:`;
    this.redirectUrl = `${origin}/`;
  }
  get clientMetadata() {
    return {
      client_name: 'astack local MCP App preview',
      redirect_uris: [this.redirectUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      scope: 'openid profile email offline_access',
    };
  }
  state() {
    const state = crypto.randomUUID();
    this.storage.setItem(this.prefix + 'state', state);
    return state;
  }
  acceptState(state: string | null): boolean {
    const expected = this.storage.getItem(this.prefix + 'state');
    this.storage.removeItem(this.prefix + 'state');
    return expected !== null && state === expected;
  }
  clientInformation() {
    const value = this.storage.getItem(this.prefix + 'client');
    return value
      ? OAuthClientInformationFullSchema.parse(JSON.parse(value) as unknown)
      : undefined;
  }
  saveClientInformation(value: OAuthClientInformationMixed) {
    this.storage.setItem(this.prefix + 'client', JSON.stringify(value));
  }
  tokens() {
    const value = this.storage.getItem(this.prefix + 'tokens');
    return value
      ? OAuthTokensSchema.parse(JSON.parse(value) as unknown)
      : undefined;
  }
  saveTokens(value: OAuthTokens) {
    this.storage.setItem(this.prefix + 'tokens', JSON.stringify(value));
  }
  redirectToAuthorization(url: URL) {
    this.navigate(url.href);
  }
  saveCodeVerifier(value: string) {
    this.storage.setItem(this.prefix + 'verifier', value);
  }
  codeVerifier() {
    const value = this.storage.getItem(this.prefix + 'verifier');
    if (!value) throw new Error('The sign-in session expired. Connect again.');
    return value;
  }
  invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
  ) {
    const keys =
      scope === 'all' ? ['client', 'tokens', 'verifier', 'state'] : [scope];
    for (const key of keys) this.storage.removeItem(this.prefix + key);
  }
}
