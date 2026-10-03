import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionOAuthState } from './websiteConnectionOAuthStateService';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const statePattern = /^[0-9a-f]{64}$/;
const codePattern = /^[A-Za-z0-9._~-]{1,2048}$/;
const slugPattern = /^[a-z0-9][a-z0-9-]{1,99}$/;
const providerId = /^[A-Za-z0-9_-]{3,128}$/;
const configurationId = /^icfg_[A-Za-z0-9]{8,128}$/;
const teamId = /^team_[A-Za-z0-9]{8,128}$/;

function callbackUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.hash
    || url.search !== '?action=callback') throw new Error('Vercel connection is not configured.');
  return url.toString();
}

function secret(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20
    && new TextEncoder().encode(value).length <= 4096 && !/[\r\n]/.test(value);
}

/** Vercel External Integrations configure permissions centrally. The URL only
 * starts an installation and binds its callback to Tayar's one-use scope. */
export function vercelAuthorizationUrl(input: { integrationSlug: string; state: string }): string {
  if (isUntrustedBrowserRuntime() || !slugPattern.test(input.integrationSlug)
    || !statePattern.test(input.state)) throw new Error('Vercel connection is not configured.');
  const url = new URL(`https://vercel.com/integrations/${input.integrationSlug}/new`);
  url.searchParams.set('state', input.state);
  return url.toString();
}

/** Consumes owner/project scope before exchanging the provider code. Raw
 * integration tokens must immediately move to scoped Vault custody. */
export async function acceptVercelOAuthCallback(input: {
  stateClient: Pick<SupabaseClient, 'rpc'>; state: string; code: string;
  callbackTeamId?: string | null; callbackConfigurationId: string;
  clientId: string; clientSecret: string; callback: string; fetcher?: typeof fetch;
}): Promise<{ ownerId: string; projectId: string; environment: 'preview' | 'production';
  accessToken: string; userId: string; teamId: string | null; configurationId: string }> {
  if (isUntrustedBrowserRuntime() || !providerId.test(input.clientId) || !secret(input.clientSecret)
    || !codePattern.test(input.code) || !configurationId.test(input.callbackConfigurationId)
    || (input.callbackTeamId != null && !teamId.test(input.callbackTeamId))) {
    throw new Error('Vercel authorization failed.');
  }
  const callback = callbackUrl(input.callback);
  const scope = await consumeWebsiteConnectionOAuthState({ client: input.stateClient,
    state: input.state, provider: 'vercel' });
  try {
    const response = await (input.fetcher ?? fetch)('https://api.vercel.com/v2/oauth/access_token', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: input.clientId, client_secret: input.clientSecret,
        code: input.code, redirect_uri: callback }),
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 16_384) throw new Error();
    const raw = await response.text();
    if (raw.length > 16_384) throw new Error();
    const grant = JSON.parse(raw) as Record<string, unknown>;
    const returnedTeamId = grant.team_id == null ? null : grant.team_id;
    if (!secret(grant.access_token) || String(grant.token_type).toLowerCase() !== 'bearer'
      || typeof grant.user_id !== 'string' || !providerId.test(grant.user_id)
      || (returnedTeamId !== null && (typeof returnedTeamId !== 'string' || !teamId.test(returnedTeamId)))
      || (input.callbackTeamId ?? null) !== returnedTeamId
      || (grant.installation_id != null && grant.installation_id !== input.callbackConfigurationId)) throw new Error();
    return { ownerId: scope.ownerId, projectId: scope.projectId, environment: scope.environment,
      accessToken: grant.access_token, userId: grant.user_id, teamId: returnedTeamId,
      configurationId: input.callbackConfigurationId };
  } catch { throw new Error('Vercel authorization failed.'); }
}
