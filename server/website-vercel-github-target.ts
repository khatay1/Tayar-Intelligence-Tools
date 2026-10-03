import type { SupabaseClient } from '@supabase/supabase-js';
import { readWebsiteInfrastructureConnections } from '../src/modules/website-builder/services/websiteInfrastructureConnectionClient';
import { resolveWebsiteGitHubRepositoryGrant } from '../src/modules/website-builder/services/websiteGithubOAuthCustodyService';
import { createWebsiteOwnedSourceReader } from './website-owned-source-reader';

type Client = Pick<SupabaseClient, 'rpc'>;
const numeric = /^[1-9][0-9]{0,19}$/;

/** Resolve Vercel's GitHub target from the exact owner-visible connection and
 * service-only OAuth custody. No App private key or browser repository metadata
 * participates; an expiring user grant is refreshed and re-verified when needed. */
export function createWebsiteVercelGithubTargetLoader(input: {
  ownerClient: Client;
  serviceClient: Client;
  githubClientId: string;
  githubClientSecret: string;
  fetcher?: typeof fetch;
}) {
  return async (scope: { ownerId: string; projectId: string;
    isCurrentOwner(): Promise<boolean> }): Promise<{ repositoryId: string; repositoryOwner: string;
      repositoryName: string; productionBranch: string } | null> => {
    try {
      if (!await scope.isCurrentOwner()) return null;
      const connections = await readWebsiteInfrastructureConnections({ client: input.ownerClient,
        ownerId: scope.ownerId, projectId: scope.projectId, isCurrent: () => true });
      if (!await scope.isCurrentOwner()) return null;
      const candidates = connections.filter(connection => connection.provider === 'github'
        && connection.environment === 'preview' && ['connected', 'ready'].includes(connection.status)
        && connection.targetId && numeric.test(connection.targetId) && numeric.test(connection.accountId)
        && connection.permissions.length === 1 && connection.permissions[0] === 'contents:write');
      if (candidates.length !== 1) return null;
      const candidate = candidates[0];
      const exact = await createWebsiteOwnedSourceReader(input.serviceClient)
        .readConnection(candidate.id, scope.projectId, scope.ownerId);
      if (!exact || exact.provider !== 'github' || exact.environment !== 'preview'
        || exact.status !== candidate.status || exact.version !== candidate.version
        || exact.accountId !== candidate.accountId || exact.targetId !== candidate.targetId
        || exact.operationId !== null || exact.permissions.length !== 1
        || exact.permissions[0] !== 'contents:write' || !exact.verifiedAt
        || !await scope.isCurrentOwner()) return null;
      const verified = await resolveWebsiteGitHubRepositoryGrant({ client: input.serviceClient,
        connection: exact, clientId: input.githubClientId, clientSecret: input.githubClientSecret,
        isCurrentOwner: scope.isCurrentOwner, fetcher: input.fetcher });
      if (!await scope.isCurrentOwner()) return null;
      const parts = verified.repositoryFullName.split('/');
      if (parts.length !== 2) return null;
      return { repositoryId: exact.targetId!, repositoryOwner: parts[0],
        repositoryName: parts[1], productionBranch: verified.defaultBranch };
    } catch { return null; }
  };
}
