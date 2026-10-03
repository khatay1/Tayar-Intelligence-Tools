import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionOAuthState } from './websiteConnectionOAuthStateService';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const statePattern = /^[0-9a-f]{64}$/;
const codePattern = /^[A-Za-z0-9._~-]{1,2048}$/;
const clientPattern = /^[A-Za-z0-9_-]{5,128}$/;
const providerTokenMaxBytes = 65_536;
const providerResponseMaxBytes = 131_072;
const providerErrorCodes = new Set([
  'invalid_grant', 'invalid_client', 'invalid_request', 'unauthorized_client',
  'unsupported_grant_type', 'temporarily_unavailable', 'server_error', 'access_denied',
]);

function reportTokenExchangeFailure(details: Record<string, unknown>) {
  console.error('website-supabase-oauth-token-exchange', JSON.stringify(details));
}

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
  const callbackPreconditions = {
    trustedRuntime: !isUntrustedBrowserRuntime(),
    clientId: clientPattern.test(input.clientId),
    clientSecret: !!input.clientSecret && input.clientSecret.length <= 4096 && !/[\r\n]/.test(input.clientSecret),
    code: codePattern.test(input.code),
  };
  if (Object.values(callbackPreconditions).some(value => !value)) {
    reportTokenExchangeFailure({ stage: 'callback-precondition', ...callbackPreconditions });
    throw new Error('Supabase authorization failed.');
  }

  let callback: string, codeVerifier: string;
  try {
    callback = callbackUrl(input.callback);
    codeVerifier = await verifier(input.state, input.pkceSecret);
  } catch {
    reportTokenExchangeFailure({ stage: 'callback-config' });
    throw new Error('Supabase authorization failed.');
  }

  let scope: Awaited<ReturnType<typeof consumeWebsiteConnectionOAuthState>>;
  try {
    scope = await consumeWebsiteConnectionOAuthState({ client: input.stateClient,
      state: input.state, provider: 'supabase' });
  } catch {
    reportTokenExchangeFailure({ stage: 'state-consume' });
    throw new Error('Supabase authorization failed.');
  }

  const credentials = encoded(new TextEncoder().encode(`${input.clientId}:${input.clientSecret}`));
  // Basic authentication uses standard base64, not URL encoding.
  const basic = credentials.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(credentials.length / 4) * 4, '=');
  let response: Response;
  try {
    response = await (input.fetcher ?? fetch)('https://api.supabase.com/v1/oauth/token', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: input.code,
        redirect_uri: callback, code_verifier: codeVerifier }),
    });
  } catch (error) {
    const reason = error instanceof DOMException && error.name === 'TimeoutError' ? 'timeout' : 'request';
    reportTokenExchangeFailure({ stage: 'network', reason });
    throw new Error('Supabase authorization failed.');
  }

  if (!response.ok) {
    let providerError = 'unknown';
    try {
      const failure = JSON.parse(await response.clone().text());
      if (typeof failure.error === 'string' && providerErrorCodes.has(failure.error)) providerError = failure.error;
    } catch {
      providerError = 'unknown';
    }
    reportTokenExchangeFailure({ stage: 'http', status: response.status, providerError });
    throw new Error('Supabase authorization failed.');
  }
  if (Number(response.headers.get('content-length') ?? 0) > providerResponseMaxBytes) {
    reportTokenExchangeFailure({ stage: 'response-size' });
    throw new Error('Supabase authorization failed.');
  }

  let raw: string;
  try { raw = await response.text(); }
  catch {
    reportTokenExchangeFailure({ stage: 'response-read' });
    throw new Error('Supabase authorization failed.');
  }
  if (new TextEncoder().encode(raw).length > providerResponseMaxBytes) {
    reportTokenExchangeFailure({ stage: 'response-size' });
    throw new Error('Supabase authorization failed.');
  }

  let tokens: Record<string, unknown>;
  try { tokens = JSON.parse(raw); }
  catch {
    reportTokenExchangeFailure({ stage: 'response-json' });
    throw new Error('Supabase authorization failed.');
  }
  const validToken = (value: unknown): value is string => typeof value === 'string' && value.length >= 20
    && new TextEncoder().encode(value).length <= providerTokenMaxBytes && !/[\r\n]/.test(value);
  if (typeof tokens.token_type !== 'string' || tokens.token_type.toLowerCase() !== 'bearer'
    || !validToken(tokens.access_token) || !validToken(tokens.refresh_token)
    || !Number.isInteger(tokens.expires_in) || Number(tokens.expires_in) < 60 || Number(tokens.expires_in) > 86_400) {
    reportTokenExchangeFailure({ stage: 'response-shape', tokenType: typeof tokens.token_type,
      accessToken: typeof tokens.access_token, refreshToken: typeof tokens.refresh_token,
      expiresIn: Number.isInteger(tokens.expires_in) ? tokens.expires_in : typeof tokens.expires_in });
    throw new Error('Supabase authorization failed.');
  }
  return { ownerId: scope.ownerId, projectId: scope.projectId, environment: scope.environment,
    accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresIn: Number(tokens.expires_in) };
}
