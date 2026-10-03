import { consumeWebsiteConnectionOAuthState } from './websiteConnectionOAuthStateService';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const statePattern = /^[0-9a-f]{64}$/;
const appId = /^[a-zA-Z0-9_]{5,100}$/;
const codePattern = /^[a-zA-Z0-9_-]{1,1024}$/;

function callbackUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash
    || (url.search && url.search !== '?action=callback')) {
    throw new Error('GitHub connection is not configured.');
  }
  return url.toString();
}

/** The caller provides a fixed, server-configured callback, never a query
 * parameter or project-supplied redirect. The raw state is one-use. */
export function githubAuthorizationUrl(input: { clientId: string; callback: string; state: string }): string {
  if (!appId.test(input.clientId) || !statePattern.test(input.state)) throw new Error('GitHub connection is not configured.');
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', input.clientId);
  url.searchParams.set('redirect_uri', callbackUrl(input.callback));
  url.searchParams.set('state', input.state);
  return url.toString();
}

/** Exchange only on the trusted server; caller must keep the returned user
 * token in short-lived encrypted custody until repo selection is complete. */
export async function exchangeGitHubAppUserCode(input: {
  clientId: string;
  clientSecret: string;
  callback: string;
  code: string;
  fetcher?: typeof fetch;
}): Promise<string> {
  if (isUntrustedBrowserRuntime()) throw new Error('GitHub exchange requires a server.');
  if (!appId.test(input.clientId) || !input.clientSecret || input.clientSecret.length > 4096
    || !codePattern.test(input.code)) throw new Error('GitHub authorization failed.');
  try {
    const body = new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret,
      code: input.code, redirect_uri: callbackUrl(input.callback) });
    const response = await (input.fetcher ?? fetch)('https://github.com/login/oauth/access_token', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body,
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 16_384) throw new Error();
    const raw = await response.text();
    if (raw.length > 16_384) throw new Error();
    const token = JSON.parse(raw);
    if (!token || token.token_type?.toLowerCase() !== 'bearer'
      || typeof token.access_token !== 'string' || token.access_token.length < 20 || token.access_token.length > 4096) throw new Error();
    return token.access_token;
  } catch {
    throw new Error('GitHub authorization failed.');
  }
}

/** Consume state before code exchange. No owner/project is accepted from the
 * callback URL; only the atomic state record supplies that scope. */
export async function acceptGitHubOAuthCallback(input: {
  stateClient: Pick<SupabaseClient, 'rpc'>;
  state: string;
  code: string;
  clientId: string;
  clientSecret: string;
  callback: string;
  fetcher?: typeof fetch;
}): Promise<{ ownerId: string; projectId: string; environment: 'preview' | 'production'; userToken: string }> {
  const scope = await consumeWebsiteConnectionOAuthState({ client: input.stateClient, state: input.state, provider: 'github' });
  const userToken = await exchangeGitHubAppUserCode(input);
  return { ownerId: scope.ownerId, projectId: scope.projectId, environment: scope.environment, userToken };
}
