import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionHandoff } from './websiteConnectionHandoffService';
import { verifyGitHubInstallationRepository } from './websiteGithubInstallationService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the trusted server can consume Vault custody and record a provider
 * observation. `connected` means account/repository access was observed; it
 * does not imply exported source, deployed runtime or publish readiness. */
export async function bindWebsiteGitHubRepository(input: {
  client: Pick<SupabaseClient, 'rpc'>;
  ownerId: string;
  projectId: string;
  handoffId: string;
  installationId: string;
  repositoryId: string;
  connectionId?: string;
  expectedVersion?: number;
  isCurrentOwner(): boolean;
  fetcher?: typeof fetch;
  now?: () => string;
}): Promise<{ connectionId: string; repositoryId: string; repositoryFullName?: string; version: number }> {
  if (typeof window !== 'undefined') throw new Error('GitHub binding requires a trusted server.');
  if (!uuid.test(input.ownerId) || !uuid.test(input.projectId) || !uuid.test(input.handoffId)
    || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)
    || !input.isCurrentOwner()) throw new Error('GitHub connection could not be verified.');
  const connectionId = input.connectionId ?? input.handoffId;
  const expectedVersion = input.expectedVersion ?? 0;
  const reconcile = async () => {
    const { data, error } = await input.client.rpc('website_reconcile_infrastructure_connection', {
      p_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_provider: 'github', p_commit_id: input.handoffId,
      p_expected_version: expectedVersion, p_target_id: input.repositoryId,
    });
    if (error || !input.isCurrentOwner()) throw new Error();
    if (!data) return null;
    if (data.connectionId !== connectionId || data.repositoryId !== input.repositoryId
      || data.version !== expectedVersion + 1 || !['preview', 'production'].includes(data.environment)) throw new Error();
    return { connectionId, repositoryId: input.repositoryId, version: data.version };
  };
  try {
    const previouslyCommitted = await reconcile();
    if (previouslyCommitted) return previouslyCommitted;
    const grant = await consumeWebsiteConnectionHandoff({ client: input.client, id: input.handoffId,
      ownerId: input.ownerId, projectId: input.projectId, provider: 'github', isCurrentOwner: input.isCurrentOwner });
    if (!input.isCurrentOwner()) throw new Error();
    const observed = await verifyGitHubInstallationRepository({ userToken: grant.userToken,
      installationId: input.installationId, repositoryId: input.repositoryId, fetcher: input.fetcher });
    if (!input.isCurrentOwner()) throw new Error();
    const { data, error } = await input.client.rpc('website_record_infrastructure_connection', {
      p_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_version: expectedVersion,
      p_provider: 'github', p_environment: grant.environment, p_account_id: observed.accountId,
      p_target_id: observed.repositoryId, p_permissions: ['contents:write'],
      p_status: 'connected', p_operation_id: null, p_verified_at: (input.now ?? (() => new Date().toISOString()))(),
      p_commit_id: input.handoffId,
    });
    if (error || data !== expectedVersion + 1 || !input.isCurrentOwner()) {
      const committed = await reconcile();
      if (committed) return committed;
      throw new Error();
    }
    return { connectionId, repositoryId: observed.repositoryId,
      repositoryFullName: observed.repositoryFullName, version: data };
  } catch {
    throw new Error('GitHub connection could not be verified.');
  }
}
