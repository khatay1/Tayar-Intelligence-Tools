import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionHandoff } from './websiteConnectionHandoffService';
import { decodeGitHubOAuthHandoff, githubGrantExpiries } from './websiteGithubOAuthService';
import { verifyGitHubInstallationRepository } from './websiteGithubInstallationService';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only the trusted server can consume Vault handoff custody. The verified
 * repository metadata and GitHub user grant are committed atomically: public
 * connection state never becomes connected without encrypted publish custody. */
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
  if (isUntrustedBrowserRuntime()) throw new Error('GitHub binding requires a trusted server.');
  if (!uuid.test(input.ownerId) || !uuid.test(input.projectId) || !uuid.test(input.handoffId)
    || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)
    || !input.isCurrentOwner()) throw new Error('GitHub connection could not be verified.');
  const connectionId = input.connectionId ?? input.handoffId;
  const expectedVersion = input.expectedVersion ?? 0;
  const reconcileArgs = {
    p_connection_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
    p_expected_version: expectedVersion, p_installation_id: input.installationId,
    p_repository_id: input.repositoryId, p_operation_id: input.handoffId,
  };
  const reconcile = async () => {
    const { data, error } = await input.client.rpc('website_reconcile_github_repository_binding', reconcileArgs);
    if (error || !input.isCurrentOwner()) throw new Error();
    if (data === null) return null;
    if (data !== expectedVersion + 1) throw new Error();
    return { connectionId, repositoryId: input.repositoryId, version: data as number };
  };
  try {
    const previouslyCommitted = await reconcile();
    if (previouslyCommitted) return previouslyCommitted;
    const handoff = await consumeWebsiteConnectionHandoff({ client: input.client, id: input.handoffId,
      ownerId: input.ownerId, projectId: input.projectId, provider: 'github', isCurrentOwner: input.isCurrentOwner });
    if (!input.isCurrentOwner()) throw new Error();
    const grant = decodeGitHubOAuthHandoff(handoff.userToken);
    const expiries = githubGrantExpiries(grant);
    if (expiries.accessExpiresAt !== null && Date.parse(expiries.accessExpiresAt) <= Date.now()) throw new Error();
    const observed = await verifyGitHubInstallationRepository({ userToken: grant.accessToken,
      installationId: input.installationId, repositoryId: input.repositoryId, fetcher: input.fetcher });
    if (!input.isCurrentOwner()) throw new Error();
    const { data, error } = await input.client.rpc('website_bind_github_repository', {
      p_connection_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_version: expectedVersion, p_environment: handoff.environment,
      p_account_id: observed.accountId, p_installation_id: observed.installationId,
      p_repository_id: observed.repositoryId, p_repository_full_name: observed.repositoryFullName,
      p_default_branch: observed.defaultBranch, p_access_token: grant.accessToken,
      p_refresh_token: grant.refreshToken, p_access_expires_at: expiries.accessExpiresAt,
      p_refresh_expires_at: expiries.refreshExpiresAt, p_custody_expires_at: expiries.custodyExpiresAt,
      p_operation_id: input.handoffId,
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
