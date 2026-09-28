import type { SupabaseClient } from '@supabase/supabase-js';
import { assertInfrastructureConnection, publicInfrastructureConnection, type InfrastructureConnection,
  type PublicInfrastructureConnection } from '../core/application-infrastructure-connections';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validationOperationId = '00000000-0000-4000-8000-000000000000';

/** Read only server-owned metadata. A project snapshot cannot assert a live
 * provider connection. The owner RPC performs authorization before returning. */
export async function readWebsiteInfrastructureConnections(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  projectId: string;
  ownerId: string;
  isCurrent(): boolean;
}): Promise<PublicInfrastructureConnection[]> {
  if (!uuid.test(input.projectId) || !uuid.test(input.ownerId) || !input.isCurrent()) throw new Error('Infrastructure scope changed.');
  const { data, error } = await input.client.rpc('website_infrastructure_connections_for_owner', { p_project_id: input.projectId });
  if (error || !Array.isArray(data) || data.length > 10) throw new Error('Infrastructure status is unavailable.');
  const seen = new Set<string>();
  const records = data.map((row: unknown) => {
    if (!row || typeof row !== 'object') throw new Error('Infrastructure status is unavailable.');
    const record = row as Record<string, unknown>;
    const candidate = {
      id: record.id, ownerId: record.ownerId, projectId: record.projectId,
      provider: record.provider, environment: record.environment, accountId: record.accountId,
      targetId: record.targetId, permissions: record.permissions, status: record.status,
      version: record.version, verifiedAt: record.verifiedAt, updatedAt: record.updatedAt,
      operationId: record.status === 'connecting' ? validationOperationId : null,
    } as InfrastructureConnection;
    try { assertInfrastructureConnection(candidate); } catch { throw new Error('Infrastructure status is unavailable.'); }
    if (candidate.projectId !== input.projectId || candidate.ownerId !== input.ownerId) throw new Error('Infrastructure scope changed.');
    const key = `${candidate.provider}:${candidate.environment}`;
    if (seen.has(key)) throw new Error('Infrastructure status is unavailable.');
    seen.add(key);
    return publicInfrastructureConnection(candidate);
  });
  if (!input.isCurrent()) throw new Error('Infrastructure scope changed.');
  return records;
}
