import type { SupabaseClient } from '@supabase/supabase-js';
import type { InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';
import { readWebsiteSupabaseOAuthCustody, storeWebsiteSupabaseOAuthCustody } from '../src/modules/website-builder/services/websiteSupabaseOAuthCustodyService';
import { verifyOwnedSupabaseProject } from './website-owned-supabase-project';

/** A single trusted attempt. Never retry an uncertain provider refresh: the
 * old refresh token may already be invalidated. A lost response needs reconnect. */
export async function refreshOwnedSupabaseOAuthGrant(input: {
  client: Pick<SupabaseClient, 'rpc'>; connection: InfrastructureConnection;
  organizationId: string; organizationSlug: string; platformOrganizationId: string;
  clientId: string; clientSecret: string; operationId: string;
  isCurrentOwner: () => boolean; fetcher?: typeof fetch;
}): Promise<{ version: number; accessExpiresAt: string }> {
  if (typeof window !== 'undefined' || !/^[A-Za-z0-9_-]{5,128}$/.test(input.clientId)
    || !input.clientSecret || input.clientSecret.length > 4096 || /[\r\n]/.test(input.clientSecret)
    || !input.platformOrganizationId || input.organizationId === input.platformOrganizationId) {
    throw new Error('Supabase grant refresh unavailable.');
  }
  const scope = { client: input.client, connection: input.connection,
    organizationId: input.organizationId, organizationSlug: input.organizationSlug,
    isCurrentOwner: input.isCurrentOwner };
  const previous = await readWebsiteSupabaseOAuthCustody(scope);
  const basic = btoa(String.fromCharCode(...new TextEncoder().encode(`${input.clientId}:${input.clientSecret}`)));
  let next: { accessToken: string; refreshToken: string; expiresIn: number };
  try {
    const response = await (input.fetcher ?? fetch)('https://api.supabase.com/v1/oauth/token', {
      method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}` },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: previous.refreshToken }),
    });
    if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 16_384) throw new Error();
    const raw = await response.text();
    if (raw.length > 16_384) throw new Error();
    const token = JSON.parse(raw);
    if (token?.token_type?.toLowerCase() !== 'bearer'
      || typeof token.access_token !== 'string' || token.access_token.length < 20 || token.access_token.length > 4096
      || typeof token.refresh_token !== 'string' || token.refresh_token.length < 20 || token.refresh_token.length > 4096
      || !Number.isInteger(token.expires_in) || token.expires_in < 60 || token.expires_in > 86_400) throw new Error();
    next = { accessToken: token.access_token, refreshToken: token.refresh_token, expiresIn: token.expires_in };
  } catch { throw new Error('Supabase grant refresh uncertain; reconnect required.'); }
  if (!input.isCurrentOwner() || !input.connection.targetId
    || !await verifyOwnedSupabaseProject({ projectRef: input.connection.targetId,
      organizationId: input.organizationId, organizationSlug: input.organizationSlug,
      accountUserId: input.connection.accountId, accessToken: next.accessToken,
      platformOrganizationId: input.platformOrganizationId, fetcher: input.fetcher })) {
    throw new Error('Supabase grant owner or project changed; reconnect required.');
  }
  const accessExpiresAt = new Date(Date.now() + next.expiresIn * 1000).toISOString();
  const version = await storeWebsiteSupabaseOAuthCustody({ ...scope,
    expectedVersion: previous.version, operationId: input.operationId,
    accessToken: next.accessToken, refreshToken: next.refreshToken,
    accessExpiresAt, custodyExpiresAt: previous.custodyExpiresAt,
    confirmOwnedProject: async token => token === next.accessToken && input.isCurrentOwner() });
  return { version, accessExpiresAt };
}
