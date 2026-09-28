import type { SupabaseClient } from '@supabase/supabase-js';
import type { GitHubExportCursor } from '../core/application-github-target';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sha = /^[0-9a-f]{40}$/i;
const digest = /^[0-9a-f]{64}$/i;
const numeric = /^[1-9][0-9]{0,19}$/;

export interface StoredGitHubExportCursor extends GitHubExportCursor {
  version: number;
  environment: 'preview' | 'production';
}
type Scope = { client: Pick<SupabaseClient, 'rpc'>; connectionId: string; projectId: string;
  ownerId: string; isCurrentOwner(): boolean };
function assertScope(input: Scope) {
  if (typeof window !== 'undefined' || !uuid.test(input.connectionId) || !uuid.test(input.projectId)
    || !uuid.test(input.ownerId) || !input.isCurrentOwner()) throw new Error('GitHub export scope changed.');
}

/** Only platform workers read this metadata; the owning project and current
 * connection version are checked again by the CAS writer. */
export async function readWebsiteGitHubExportCursor(input: Scope): Promise<StoredGitHubExportCursor | null> {
  assertScope(input);
  const { data, error } = await input.client.rpc('website_github_export_cursor_for_worker', {
    p_connection_id: input.connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
  });
  if (error || !input.isCurrentOwner()) throw new Error('GitHub export cursor is unavailable.');
  if (data === null) return null;
  const item = data as Record<string, unknown>;
  if (item.projectId !== input.projectId || !numeric.test(String(item.repositoryId))
    || !['preview', 'production'].includes(String(item.environment))
    || item.branch !== `tayar/${input.projectId}/${item.environment}` || !Number.isSafeInteger(item.connectionVersion)
    || (item.connectionVersion as number) < 1 || !Number.isSafeInteger(item.version) || (item.version as number) < 1
    || (item.lastHeadSha !== null && (typeof item.lastHeadSha !== 'string' || !sha.test(item.lastHeadSha)))
    || (item.lastSourceDigest !== null && (typeof item.lastSourceDigest !== 'string' || !digest.test(item.lastSourceDigest)))
    || (item.lastHeadSha === null) !== (item.lastSourceDigest === null)) {
    throw new Error('GitHub export cursor is unavailable.');
  }
  return { projectId: input.projectId, connectionVersion: item.connectionVersion as number,
    repositoryId: String(item.repositoryId), environment: item.environment as 'preview' | 'production', branch: item.branch as string,
    lastHeadSha: item.lastHeadSha as string | null, lastSourceDigest: item.lastSourceDigest as string | null,
    version: item.version as number };
}

/** Initialize only after a trusted worker observes that the dedicated branch
 * does not exist. An existing branch with no cursor is a conflict. */
export async function initializeWebsiteGitHubExportCursor(input: Scope & {
  connectionVersion: number; repositoryId: string; environment: 'preview' | 'production'; branchIsAbsent: boolean;
}): Promise<StoredGitHubExportCursor> {
  assertScope(input);
  if (!input.branchIsAbsent || !['preview', 'production'].includes(input.environment)
    || !Number.isSafeInteger(input.connectionVersion) || input.connectionVersion < 1
    || !numeric.test(input.repositoryId)) throw new Error('GitHub export target changed.');
  const { data, error } = await input.client.rpc('website_initialize_github_export_cursor', {
    p_connection_id: input.connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
    p_connection_version: input.connectionVersion, p_repository_id: input.repositoryId,
    p_branch: `tayar/${input.projectId}/${input.environment}`,
  });
  if (error || data !== 1 || !input.isCurrentOwner()) throw new Error('GitHub export target changed.');
  return { projectId: input.projectId, connectionVersion: input.connectionVersion,
    repositoryId: input.repositoryId, environment: input.environment,
    branch: `tayar/${input.projectId}/${input.environment}`,
    lastHeadSha: null, lastSourceDigest: null, version: 1 };
}

/** Call only after the remote ref has been read back and its commit/tree has
 * been verified. A timed-out CAS is acknowledged by exact operation match. */
export async function commitWebsiteGitHubExportCursor(input: Scope & {
  cursor: StoredGitHubExportCursor; newHeadSha: string; sourceDigest: string; operationId: string;
}): Promise<number> {
  assertScope(input);
  if (input.cursor.projectId !== input.projectId || !['preview', 'production'].includes(input.cursor.environment)
    || input.cursor.branch !== `tayar/${input.projectId}/${input.cursor.environment}`
    || !numeric.test(input.cursor.repositoryId) || !Number.isSafeInteger(input.cursor.version) || input.cursor.version < 1
    || !Number.isSafeInteger(input.cursor.connectionVersion) || input.cursor.connectionVersion < 1
    || (input.cursor.lastHeadSha !== null && !sha.test(input.cursor.lastHeadSha))
    || !sha.test(input.newHeadSha) || !digest.test(input.sourceDigest) || !uuid.test(input.operationId)) {
    throw new Error('GitHub export cursor changed.');
  }
  const args = { p_connection_id: input.connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
    p_connection_version: input.cursor.connectionVersion, p_expected_version: input.cursor.version,
    p_expected_head: input.cursor.lastHeadSha, p_new_head: input.newHeadSha,
    p_source_digest: input.sourceDigest, p_operation_id: input.operationId };
  const reconcile = async () => {
    const result = await input.client.rpc('website_reconcile_github_export_cursor', {
      p_connection_id: input.connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_operation_id: input.operationId, p_expected_version: input.cursor.version,
      p_new_head: input.newHeadSha, p_source_digest: input.sourceDigest,
    });
    if (result.error || !input.isCurrentOwner()) throw new Error();
    return result.data === input.cursor.version + 1 ? result.data : null;
  };
  try {
    const prior = await reconcile();
    if (prior) return prior;
    const { data, error } = await input.client.rpc('website_commit_github_export_cursor', args);
    if (!error && data === input.cursor.version + 1 && input.isCurrentOwner()) return data;
    const committed = await reconcile();
    if (committed) return committed;
    throw new Error();
  } catch { throw new Error('GitHub export cursor changed.'); }
}
