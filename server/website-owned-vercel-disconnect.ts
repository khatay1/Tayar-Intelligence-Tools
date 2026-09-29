import type { SupabaseClient } from '@supabase/supabase-js';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Severs one project and erases its Vault copy. It intentionally leaves the
 * account-wide Vercel Integration installed because other projects may use it. */
export async function disconnectOwnedVercelProject(input: {
  client: Pick<SupabaseClient, 'rpc'>; connection: InfrastructureConnection;
  commitId: string; isCurrentOwner: () => boolean;
}): Promise<{ version: number; installation: 'retained' }> {
  if (typeof window !== 'undefined' || !input.isCurrentOwner() || !uuid.test(input.commitId))
    throw new Error('Vercel disconnect unavailable.');
  const connection = assertInfrastructureConnection(input.connection);
  if (connection.provider !== 'vercel' || connection.version < 1 || connection.status === 'disconnected')
    throw new Error('Vercel disconnect unavailable.');
  const args = { p_connection_id: connection.id, p_project_id: connection.projectId,
    p_owner_id: connection.ownerId, p_expected_version: connection.version, p_commit_id: input.commitId };
  const expected = connection.version + 1;
  const reconcile = async () => {
    const { data, error } = await input.client.rpc('website_reconcile_vercel_disconnect', args);
    if (error || !input.isCurrentOwner()) throw new Error('Vercel disconnect uncertain; refresh connection status.');
    if (data != null && data !== expected) throw new Error('Vercel connection changed.');
    return data === expected;
  };
  if (await reconcile()) return { version: expected, installation: 'retained' };
  try {
    const { data, error } = await input.client.rpc('website_disconnect_vercel_connection', args);
    if (error || data !== expected || !input.isCurrentOwner()) throw new Error();
  } catch {
    if (!await reconcile()) throw new Error('Vercel disconnect uncertain; refresh connection status.');
  }
  if (!input.isCurrentOwner()) throw new Error('Vercel connection changed.');
  return { version: expected, installation: 'retained' };
}

