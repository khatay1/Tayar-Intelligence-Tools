import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionOAuthState } from './websiteConnectionOAuthStateService';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const statePattern = /^[0-9a-f]{64}$/;
const codePattern = /^[A-Za-z0-9._~-]{1,2048}$/;
const clientPattern = /^[A-Za-z0-9_-]{5,128}$/;

function callbackUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash
    || (url.search && url.search !== '?action=callback')) {
    throw new Error('Supabase connection is not configured.');
  }
  return url.toString();
}

function encoded(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function verifier(state: string, secret: string): Promise<string> {
  if (!statePattern.test(state) || secret.length < 32 || secret.length > 4096) {
    throw new Error('Supabase connection is not configured.');
  }
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return encoded(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`supabase-pkce:${state}`))));
}

/** Deterministic PKCE from one-use random state and a server-held secret. The
 * verifier is neither persisted in the editable project nor sent to browser. */
export async function supabaseAuthorizationUrl(input: {
  clientId: string; callback: string; state: string; pkceSecret: string;
}): Promise<string> {
  if (isUntrustedBrowserRuntime() || !clientPattern.test(input.clientId)) throw new Error('Supabase connection is not configured.');
  const codeVerifier = await verifier(input.state, input.pkceSecret);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(codeVerifier)));
  const url = new URL('https://api.supabase.com/v1/oauth/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(input.callback));
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', input.state);
  url.searchParams.set('code_challenge', encoded(digest));
  url.searchParams.set('code_challenge_method', 'S256');
  return url.toString();
}

/** Consumes the existing owner/project/provider-scoped state before exchange.
 * The caller must immediately hand tokens to encrypted, scoped custody or
 * revoke/discard them; never return this object to a browser or log it. */
export async function acceptSupabaseOAuthCallback(input: {
  stateClient: Pick<SupabaseClient, 'rpc'>;
  state: string; code: string; clientId: string; clientSecret: string;
  callback: string; pkceSecret: string; fetcher?: typeof fetch;
}): Promise<{ ownerId: string; projectId: string; environment: 'preview' | 'production';
  accessToken: string; refreshToken: string; expiresIn: number }> {
  if (isUntrustedBrowserRuntime() || !clientPattern.test(input.clientId)
    || !input.clientSecret || input.clientSecret.length > 4096 || /[\r\n]/.test(input.clientSecret)
    || !codePattern.test(input.code)) throw new Error('Supabase authorization failed.');
  const callback = callbackUrl(input.callback);
  const codeVerifier = await verifier(input.state, input.pkceSecret);
  const scope = await consumeWebsiteConnectionOAuthState({ client: input.stateClient,
    state: input.state, provider: 'supabase' });
  try {
    const credentials = encoded(new TextEncoder().encode(`${input.clientId}:${input.clientSecret}`));
    // Basic authentication uses standard base64, not URL encoding.
    const basic = credentials.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(credentials.length / 4) * 4, '=');
    const response = await (input.fetcher ?? fetch)('https://api.supabase.com/v1/oauth/token', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: input.code,
        redirect_uri: callback, code_verifier: codeVerifier }),
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 16_384) throw new Error();
    const raw = await response.text();
    if (raw.length > 16_384) throw new Error();
    const tokens = JSON.parse(raw);
    if (tokens?.token_type?.toLowerCase() !== 'bearer'
      || typeof tokens.access_token !== 'string' || tokens.access_token.length < 20 || tokens.access_token.length > 4096
      || typeof tokens.refresh_token !== 'string' || tokens.refresh_token.length < 20 || tokens.refresh_token.length > 4096
      || !Number.isInteger(tokens.expires_in) || tokens.expires_in < 60 || tokens.expires_in > 86_400) throw new Error();
    return { ownerId: scope.ownerId, projectId: scope.projectId, environment: scope.environment,
      accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: tokens.expires_in };
  } catch { throw new Error('Supabase authorization failed.'); }
}
