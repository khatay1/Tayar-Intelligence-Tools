import type { SupabaseClient } from '@supabase/supabase-js';
import { assertInfrastructureConnection, type InfrastructureConnection } from '../core/application-infrastructure-connections';
import { githubGrantExpiries, refreshGitHubAppUserGrant } from './websiteGithubOAuthService';
import { verifyGitHubInstallationRepository } from './websiteGithubInstallationService';

type Client = Pick<SupabaseClient, 'rpc'>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numeric = /^[1-9][0-9]{0,19}$/;
const repoName = /^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/;
const branch = /^[a-zA-Z0-9_./-]{1,200}$/;
const tokenMaxBytes = 65_536;

function token(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20
    && new TextEncoder().encode(value).length <= tokenMaxBytes && !/[\r\n\s]/.test(value);
}

function optionalTime(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error();
  return value;
}

export interface WebsiteGitHubOAuthCustody {
  version: number;
  installationId: string;
  repositoryId: string;
  repositoryFullName: string;
  defaultBranch: string;
  accessToken: string;
  refreshToken: string | null;
  accessExpiresAt: string | null;
  refreshExpiresAt: string | null;
  custodyExpiresAt: string;
}

function assertConnection(value: InfrastructureConnection, isCurrentOwner: () => boolean) {
  if (typeof window !== 'undefined' || !isCurrentOwner()) throw new Error('GitHub OAuth custody scope changed.');
  const connection = assertInfrastructureConnection(value);
  if (connection.provider !== 'github' || !connection.targetId || !numeric.test(connection.accountId)
    || !numeric.test(connection.targetId)
    || !['connected', 'setup-incomplete', 'deployment-failed', 'ready'].includes(connection.status)) {
    throw new Error('GitHub OAuth custody scope changed.');
  }
  return connection;
}

export async function readWebsiteGitHubOAuthCustody(input: {
  client: Client; connection: InfrastructureConnection; isCurrentOwner: () => boolean;
}): Promise<WebsiteGitHubOAuthCustody> {
  const connection = assertConnection(input.connection, input.isCurrentOwner);
  const { data, error } = await input.client.rpc('website_read_github_oauth_custody', {
    p_connection_id: connection.id, p_project_id: connection.projectId,
    p_owner_id: connection.ownerId, p_expected_connection_version: connection.version,
  });
  try {
    if (error || !data || !input.isCurrentOwner() || !Number.isSafeInteger(data.version) || data.version < 1
      || data.accountId !== connection.accountId || data.repositoryId !== connection.targetId
      || data.environment !== connection.environment || !numeric.test(data.installationId)
      || !repoName.test(data.repositoryFullName) || !branch.test(data.defaultBranch)
      || data.defaultBranch.includes('..') || data.defaultBranch.startsWith('/') || data.defaultBranch.endsWith('/')
      || !token(data.grant?.accessToken)
      || !(data.grant?.refreshToken === null || token(data.grant?.refreshToken))) throw new Error();
    const accessExpiresAt = optionalTime(data.accessExpiresAt);
    const refreshExpiresAt = optionalTime(data.refreshExpiresAt);
    if ((accessExpiresAt === null) !== (data.grant.refreshToken === null)
      || (refreshExpiresAt === null) !== (data.grant.refreshToken === null)
      || typeof data.custodyExpiresAt !== 'string' || !Number.isFinite(Date.parse(data.custodyExpiresAt))
      || Date.parse(data.custodyExpiresAt) <= Date.now()
      || (refreshExpiresAt !== null && Date.parse(refreshExpiresAt) <= Date.parse(accessExpiresAt!))) throw new Error();
    return { version: data.version, installationId: data.installationId, repositoryId: data.repositoryId,
      repositoryFullName: data.repositoryFullName, defaultBranch: data.defaultBranch,
      accessToken: data.grant.accessToken, refreshToken: data.grant.refreshToken,
      accessExpiresAt, refreshExpiresAt, custodyExpiresAt: data.custodyExpiresAt };
  } catch { throw new Error('GitHub OAuth custody unavailable.'); }
}

export async function resolveWebsiteGitHubRepositoryGrant(input: {
  client: Client; connection: InfrastructureConnection; clientId: string; clientSecret: string;
  isCurrentOwner: () => boolean; fetcher?: typeof fetch; now?: () => number;
}): Promise<{ accessToken: string; repositoryFullName: string; defaultBranch: string }> {
  const connection = assertConnection(input.connection, input.isCurrentOwner);
  const custody = await readWebsiteGitHubOAuthCustody({ client: input.client, connection, isCurrentOwner: input.isCurrentOwner });
  const now = (input.now ?? Date.now)();
  if (!Number.isFinite(now) || !input.isCurrentOwner()) throw new Error('GitHub repository access is unavailable.');
  if (custody.accessExpiresAt === null || Date.parse(custody.accessExpiresAt) > now + 120_000) {
    return { accessToken: custody.accessToken, repositoryFullName: custody.repositoryFullName,
      defaultBranch: custody.defaultBranch };
  }
  if (!custody.refreshToken || !custody.refreshExpiresAt || Date.parse(custody.refreshExpiresAt) <= now + 120_000) {
    throw new Error('GitHub repository access is unavailable.');
  }
  try {
    const grant = await refreshGitHubAppUserGrant({ clientId: input.clientId, clientSecret: input.clientSecret,
      refreshToken: custody.refreshToken, fetcher: input.fetcher, now: () => now });
    const expiries = githubGrantExpiries(grant);
    if (!grant.refreshToken || !expiries.accessExpiresAt || !expiries.refreshExpiresAt || !input.isCurrentOwner()) throw new Error();
    const observed = await verifyGitHubInstallationRepository({ userToken: grant.accessToken,
      installationId: custody.installationId, repositoryId: custody.repositoryId, fetcher: input.fetcher });
    if (!input.isCurrentOwner() || observed.accountId !== connection.accountId
      || observed.repositoryId !== connection.targetId || observed.repositoryFullName !== custody.repositoryFullName
      || observed.defaultBranch !== custody.defaultBranch) throw new Error();
    const operationId = crypto.randomUUID();
    if (!uuid.test(operationId)) throw new Error();
    const base = { p_connection_id: connection.id, p_project_id: connection.projectId,
      p_owner_id: connection.ownerId, p_expected_connection_version: connection.version,
      p_expected_version: custody.version, p_operation_id: operationId };
    const expected = custody.version + 1;
    const args = { ...base, p_access_token: grant.accessToken, p_refresh_token: grant.refreshToken,
      p_access_expires_at: expiries.accessExpiresAt, p_refresh_expires_at: expiries.refreshExpiresAt,
      p_custody_expires_at: expiries.custodyExpiresAt };
    const result = await input.client.rpc('website_refresh_github_oauth_custody', args);
    if (result.error || result.data !== expected) {
      const reconcile = await input.client.rpc('website_reconcile_github_oauth_refresh', base);
      if (reconcile.error || reconcile.data !== expected) throw new Error();
    }
    if (!input.isCurrentOwner()) throw new Error();
    return { accessToken: grant.accessToken, repositoryFullName: custody.repositoryFullName,
      defaultBranch: custody.defaultBranch };
  } catch { throw new Error('GitHub repository access is unavailable.'); }
}
