import type { SupabaseClient } from '@supabase/supabase-js';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';
import { readWebsiteSupabaseOAuthCustody } from '../src/modules/website-builder/services/websiteSupabaseOAuthCustodyService';

type Revocation = 'confirmed' | 'uncertain';

/** The local disconnect and Vault erase are one database transaction. An
 * uncertain provider response never prevents local severance, and a repeated
 * operation first reconciles the exact database commit without another POST. */
export async function disconnectOwnedSupabase(input: {
  client: Pick<SupabaseClient, 'rpc'>; connection: InfrastructureConnection;
  organizationId: string; organizationSlug: string;
  clientId: string; clientSecret: string; commitId: string;
  isCurrentOwner: () => boolean; fetcher?: typeof fetch;
}): Promise<{ version: number; revocation: Revocation }> {
  if (typeof window !== 'undefined' || !input.isCurrentOwner()
    || !/^[A-Za-z0-9_-]{5,128}$/.test(input.clientId)
    || !input.clientSecret || input.clientSecret.length > 4096 || /[\r\n]/.test(input.clientSecret)
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.commitId)) {
    throw new Error('Supabase disconnect unavailable.');
  }
  const connection = assertInfrastructureConnection(input.connection);
  if (connection.provider !== 'supabase' || connection.version < 1) throw new Error('Supabase disconnect unavailable.');
  const args = { p_connection_id: connection.id, p_project_id: connection.projectId,
    p_owner_id: connection.ownerId, p_expected_version: connection.version, p_commit_id: input.commitId };
  const expected = connection.version + 1;
  const reconciled = await input.client.rpc('website_reconcile_supabase_disconnect', args);
  if (reconciled.error) throw new Error('Supabase disconnect unavailable.');
  if (reconciled.data === expected && input.isCurrentOwner()) return { version: expected, revocation: 'uncertain' };
  if (reconciled.data != null) throw new Error('Supabase connection changed.');
  const prepared = await input.client.rpc('website_begin_supabase_disconnect', args);
  if (prepared.error || typeof prepared.data !== 'boolean' || !input.isCurrentOwner())
    throw new Error('Supabase disconnect uncertain; refresh connection status.');
  let revocation: Revocation = 'uncertain';
  if (prepared.data && ['connected', 'setup-incomplete', 'outdated-schema', 'ready'].includes(connection.status)) {
    try {
      const grant = await readWebsiteSupabaseOAuthCustody({ client: input.client, connection,
        organizationId: input.organizationId, organizationSlug: input.organizationSlug,
        isCurrentOwner: input.isCurrentOwner });
      if (!input.isCurrentOwner()) throw new Error();
      const response = await (input.fetcher ?? fetch)('https://api.supabase.com/v1/oauth/revoke', {
        method: 'POST', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: input.clientId, client_secret: input.clientSecret,
          refresh_token: grant.refreshToken }),
      });
      if (response.status === 204) revocation = 'confirmed';
    } catch { /* The provider may have received the POST. Never replay it. */ }
  }
  if (!input.isCurrentOwner()) throw new Error('Supabase connection changed.');
  try {
    const { data, error } = await input.client.rpc('website_disconnect_supabase_connection', args);
    if (error || data !== expected) throw new Error();
  } catch {
    const { data, error } = await input.client.rpc('website_reconcile_supabase_disconnect', args);
    if (error || data !== expected) throw new Error('Supabase disconnect uncertain; refresh connection status.');
  }
  if (!input.isCurrentOwner()) throw new Error('Supabase connection changed.');
  return { version: expected, revocation };
}
