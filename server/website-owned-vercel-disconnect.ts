import type { SupabaseClient } from '@supabase/supabase-js';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../src/modules/website-builder/core/application-infrastructure-connections';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const provider = /^[A-Za-z0-9_-]{3,128}$/;
const project = /^prj_[A-Za-z0-9]{8,128}$/;
const names = ['SUPABASE_ANON_KEY', 'SUPABASE_URL'] as const;
type Name = typeof names[number];
type Client = Pick<SupabaseClient, 'rpc'>;
type Completed = { connectionVersion: number; receiptVersion: number | null };
type Begin = {
  cleanupRequired: boolean; receiptVersion: number | null; accessToken?: string; userId?: string;
  accountId?: string; vercelProjectId?: string; environment?: 'preview' | 'production';
  gitBranch?: string | null; marker?: string; environmentIds?: Record<Name, string>;
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
  return value as Record<string, unknown>;
}
function environmentIds(value: unknown): Record<Name, string> {
  const parsed = object(value);
  if (Object.keys(parsed).sort().join(',') !== names.join(',')
    || names.some(name => typeof parsed[name] !== 'string' || !provider.test(parsed[name] as string))
    || new Set(Object.values(parsed)).size !== names.length) throw new Error();
  return parsed as Record<Name, string>;
}
function completed(value: unknown, expectedConnectionVersion: number): Completed | null {
  if (value == null) return null;
  const parsed = object(value);
  if (parsed.connectionVersion !== expectedConnectionVersion
    || !(parsed.receiptVersion == null || (Number.isSafeInteger(parsed.receiptVersion) && Number(parsed.receiptVersion) > 0))) throw new Error();
  return parsed as Completed;
}

/** Deletes only unchanged runtime-variable IDs owned by the verified receipt,
 * proves their absence, then atomically severs this project and erases Vault
 * custody. The account-wide Vercel Integration remains installed. */
export async function disconnectOwnedVercelProject(input: {
  client: Client; connection: InfrastructureConnection; operationId: string; commitId: string;
  isCurrentOwner: () => boolean; fetcher?: typeof fetch;
}): Promise<{ version: number; installation: 'retained' }> {
  try {
    if (typeof window !== 'undefined' || !input.isCurrentOwner()
      || !uuid.test(input.operationId) || !uuid.test(input.commitId)) throw new Error();
    const connection = assertInfrastructureConnection(input.connection);
    if (connection.provider !== 'vercel' || connection.version < 1 || connection.status === 'disconnected'
      || !project.test(connection.targetId ?? '')) throw new Error();
    const expectedConnectionVersion = connection.version + 1;
    const completedArgs = { p_connection_id: connection.id, p_project_id: connection.projectId,
      p_owner_id: connection.ownerId, p_expected_connection_version: connection.version,
      p_operation_id: input.operationId, p_commit_id: input.commitId };
    const initial = await input.client.rpc('website_reconcile_completed_vercel_runtime_disconnect', completedArgs);
    if (initial.error || !input.isCurrentOwner()) throw new Error();
    const alreadyCompleted = completed(initial.data, expectedConnectionVersion);
    if (alreadyCompleted) return { version: alreadyCompleted.connectionVersion, installation: 'retained' };

    const begun = await input.client.rpc('website_begin_vercel_runtime_disconnect', {
      p_connection_id: connection.id, p_project_id: connection.projectId, p_owner_id: connection.ownerId,
      p_expected_connection_version: connection.version, p_operation_id: input.operationId,
    });
    if (begun.error || !input.isCurrentOwner()) throw new Error();
    const begin = object(begun.data) as unknown as Begin;
    if (typeof begin.cleanupRequired !== 'boolean'
      || !(begin.receiptVersion == null || (Number.isSafeInteger(begin.receiptVersion) && begin.receiptVersion > 0))) throw new Error();

    let removedEnvironmentIds: string[] = [];
    if (begin.cleanupRequired) {
      const ids = environmentIds(begin.environmentIds);
      if (!Number.isSafeInteger(begin.receiptVersion) || Number(begin.receiptVersion) < 1
        || typeof begin.accessToken !== 'string' || begin.accessToken.length < 20 || begin.accessToken.length > 4096
        || /[\r\n]/.test(begin.accessToken) || typeof begin.userId !== 'string' || !provider.test(begin.userId)
        || typeof begin.accountId !== 'string' || !provider.test(begin.accountId)
        || begin.vercelProjectId !== connection.targetId || !project.test(begin.vercelProjectId)
        || begin.environment !== connection.environment || typeof begin.marker !== 'string') throw new Error();
      const preview = begin.environment === 'preview';
      const expectedBranch = preview ? `tayar/${connection.projectId}/preview` : null;
      const expectedMarker = new RegExp(`^Tayar ${preview ? '' : 'production '}runtime [0-9a-f-]{36}$`, 'i');
      if (begin.gitBranch !== expectedBranch || !expectedMarker.test(begin.marker)) throw new Error();
      const team = begin.accountId !== begin.userId ? `&teamId=${encodeURIComponent(begin.accountId)}` : '';
      const listUrl = `https://api.vercel.com/v10/projects/${begin.vercelProjectId}/env?decrypt=false${team}`;
      const headers = { Authorization: `Bearer ${begin.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' };
      const read = async () => {
        if (!input.isCurrentOwner()) throw new Error();
        const response = await (input.fetcher ?? fetch)(listUrl, { method: 'GET', redirect: 'error', cache: 'no-store',
          signal: AbortSignal.timeout(8000), headers });
        if (response.status !== 200 || Number(response.headers.get('content-length') ?? 0) > 262144) throw new Error();
        const text = await response.text(); if (text.length > 262144) throw new Error();
        const payload = object(JSON.parse(text));
        if (!Array.isArray(payload.envs) || payload.envs.length > 1000) throw new Error();
        return payload.envs;
      };
      const before = await read();
      for (const name of names) {
        const id = ids[name];
        const matches = before.filter(item => !!item && typeof item === 'object' && !Array.isArray(item)
          && (item as Record<string, unknown>).id === id);
        if (matches.length > 1) throw new Error();
        if (matches.length === 1) {
          const row = matches[0] as Record<string, unknown>;
          const targets = Array.isArray(row.target) ? row.target : [];
          if (row.key !== name || row.type !== 'plain' || row.comment !== begin.marker
            || targets.length !== 1 || targets[0] !== begin.environment
            || (preview ? row.gitBranch !== expectedBranch : row.gitBranch != null)) throw new Error();
          if (!input.isCurrentOwner()) throw new Error();
          const suffix = team ? `?${team.slice(1)}` : '';
          try {
            await (input.fetcher ?? fetch)(`https://api.vercel.com/v9/projects/${begin.vercelProjectId}/env/${id}${suffix}`,
              { method: 'DELETE', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000), headers });
          } catch { /* a second non-decrypting list resolves an uncertain DELETE */ }
        }
      }
      const after = await read();
      if (after.some(item => !!item && typeof item === 'object' && !Array.isArray(item)
        && Object.values(ids).includes((item as Record<string, unknown>).id as string)) || !input.isCurrentOwner()) throw new Error();
      removedEnvironmentIds = Object.values(ids).sort();
    } else if (begin.receiptVersion != null) throw new Error();

    const commitArgs = { ...completedArgs, p_expected_receipt_version: begin.receiptVersion,
      p_removed_environment_ids: removedEnvironmentIds };
    const expectedReceiptVersion = begin.receiptVersion == null ? null : begin.receiptVersion + 1;
    const reconcile = async () => {
      const result = await input.client.rpc('website_reconcile_vercel_runtime_disconnect', commitArgs);
      if (result.error || !input.isCurrentOwner()) return null;
      const exact = completed(result.data, expectedConnectionVersion);
      if (exact && exact.receiptVersion !== expectedReceiptVersion) throw new Error();
      return exact;
    };
    let result = await reconcile();
    if (!result) {
      try {
        const committed = await input.client.rpc('website_commit_vercel_runtime_disconnect', commitArgs);
        if (committed.error || !input.isCurrentOwner()) throw new Error();
        result = completed(committed.data, expectedConnectionVersion);
        if (!result || result.receiptVersion !== expectedReceiptVersion) throw new Error();
      } catch {
        result = await reconcile();
        if (!result) throw new Error();
      }
    }
    return { version: result.connectionVersion, installation: 'retained' };
  } catch { throw new Error('Vercel disconnect unavailable.'); }
}
