import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionHandoff, peekWebsiteConnectionHandoff } from './websiteConnectionHandoffService';
import { isUntrustedBrowserRuntime } from './trustedServerRuntime';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const providerId = /^[A-Za-z0-9_-]{3,128}$/;
const teamId = /^team_[A-Za-z0-9]{8,128}$/;
const projectId = /^prj_[A-Za-z0-9]{8,128}$/;
const gitName = /^[A-Za-z0-9_.-]{1,100}$/;
const branch = /^[A-Za-z0-9_./-]{1,200}$/;

type Grant = { accessToken: string; userId: string; teamId: string | null;
  configurationId: string; receivedAt: string };
export type VercelProjectChoice = { projectId: string; projectName: string; accountId: string;
  accountType: 'personal' | 'team'; productionBranch: string };

function token(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 20
    && new TextEncoder().encode(value).length <= 4096 && !/[\r\n]/.test(value);
}
export function encodeVercelOAuthHandoff(grant: Grant): string {
  if (!token(grant.accessToken) || !providerId.test(grant.userId)
    || (grant.teamId !== null && !teamId.test(grant.teamId))
    || !/^icfg_[A-Za-z0-9]{8,128}$/.test(grant.configurationId)
    || !Number.isFinite(Date.parse(grant.receivedAt))) throw new Error('Vercel authorization is unavailable.');
  return JSON.stringify(grant);
}
function decodeGrant(raw: string): Grant {
  let grant: Partial<Grant>;
  try { grant = JSON.parse(raw); } catch { throw new Error('Vercel authorization is unavailable.'); }
  if (!token(grant.accessToken) || !providerId.test(grant.userId ?? '')
    || (grant.teamId !== null && !teamId.test(grant.teamId ?? ''))
    || !/^icfg_[A-Za-z0-9]{8,128}$/.test(grant.configurationId ?? '')
    || !Number.isFinite(Date.parse(grant.receivedAt ?? ''))) throw new Error('Vercel authorization is unavailable.');
  return grant as Grant;
}

async function read(accessToken: string, path: string, fetcher: typeof fetch): Promise<Record<string, unknown>> {
  const response = await fetcher(`https://api.vercel.com${path}`, { method: 'GET', redirect: 'error',
    cache: 'no-store', signal: AbortSignal.timeout(8000),
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' } });
  if (response.status !== 200 || Number(response.headers.get('content-length') ?? 0) > 131_072) throw new Error();
  const raw = await response.text();
  if (raw.length > 131_072) throw new Error();
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
  return parsed as Record<string, unknown>;
}

/** Returns only projects in the installed account whose immutable GitHub link
 * matches the project connection. Browser input never chooses another repo. */
export async function listWebsiteVercelProjectChoices(input: {
  client: Pick<SupabaseClient, 'rpc'>; ownerId: string; projectId: string; handoffId: string;
  platformAccountId: string; repositoryId: string; repositoryOwner: string;
  repositoryName: string; productionBranch: string; isCurrentOwner(): boolean;
  fetcher?: typeof fetch;
}): Promise<{ userId: string; accountId: string; configurationId: string;
  projects: VercelProjectChoice[] }> {
  if (isUntrustedBrowserRuntime() || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !uuid.test(input.handoffId) || !providerId.test(input.platformAccountId)
    || !/^\d+$/.test(input.repositoryId) || !gitName.test(input.repositoryOwner)
    || !gitName.test(input.repositoryName) || !branch.test(input.productionBranch)
    || input.productionBranch.includes('..') || input.productionBranch.startsWith('/')
    || input.productionBranch.endsWith('/') || !input.isCurrentOwner()) {
    throw new Error('Vercel projects are unavailable.');
  }
  try {
    const handoff = await peekWebsiteConnectionHandoff({ client: input.client, id: input.handoffId,
      ownerId: input.ownerId, projectId: input.projectId, provider: 'vercel',
      isCurrentOwner: input.isCurrentOwner });
    const grant = decodeGrant(handoff.userToken), fetcher = input.fetcher ?? fetch;
    const accountId = grant.teamId ?? grant.userId;
    if (accountId === input.platformAccountId) throw new Error();
    const profile = await read(grant.accessToken, '/v2/user', fetcher);
    if (!profile.user || typeof profile.user !== 'object'
      || (profile.user as Record<string, unknown>).id !== grant.userId) throw new Error();
    if (grant.teamId) {
      const team = await read(grant.accessToken, `/v2/teams/${grant.teamId}`, fetcher);
      const membership = team.membership;
      if (team.id !== grant.teamId || !membership || typeof membership !== 'object'
        || (membership as Record<string, unknown>).uid !== grant.userId
        || (membership as Record<string, unknown>).role !== 'OWNER'
        || (membership as Record<string, unknown>).confirmed !== true) throw new Error();
    }
    const scope = grant.teamId ? `&teamId=${encodeURIComponent(grant.teamId)}` : '';
    const catalog = await read(grant.accessToken, `/v9/projects?limit=100${scope}`, fetcher);
    if (!Array.isArray(catalog.projects) || catalog.projects.length > 100) throw new Error();
    const projects: VercelProjectChoice[] = [];
    for (const raw of catalog.projects) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const project = raw as Record<string, unknown>, link = project.link;
      if (!projectId.test(String(project.id)) || typeof project.name !== 'string'
        || project.name.length < 1 || project.name.length > 100 || project.accountId !== accountId
        || project.paused === true || !link || typeof link !== 'object' || Array.isArray(link)) continue;
      const git = link as Record<string, unknown>;
      if (git.type !== 'github' || String(git.repoId) !== input.repositoryId
        || git.org !== input.repositoryOwner || git.repo !== input.repositoryName
        || git.productionBranch !== input.productionBranch) continue;
      projects.push({ projectId: String(project.id), projectName: project.name, accountId,
        accountType: grant.teamId ? 'team' : 'personal', productionBranch: input.productionBranch });
    }
    if (!input.isCurrentOwner()) throw new Error();
    return { userId: grant.userId, accountId, configurationId: grant.configurationId,
      projects: projects.sort((a, b) => a.projectName.localeCompare(b.projectName) || a.projectId.localeCompare(b.projectId)) };
  } catch { throw new Error('Vercel projects are unavailable.'); }
}

function projectMatches(raw: Record<string, unknown>, expected: {
  vercelProjectId: string; accountId: string; repositoryId: string;
  repositoryOwner: string; repositoryName: string; productionBranch: string;
}): boolean {
  const link = raw.link;
  return raw.id === expected.vercelProjectId && raw.accountId === expected.accountId
    && raw.paused !== true && !!link && typeof link === 'object' && !Array.isArray(link)
    && (link as Record<string, unknown>).type === 'github'
    && String((link as Record<string, unknown>).repoId) === expected.repositoryId
    && (link as Record<string, unknown>).org === expected.repositoryOwner
    && (link as Record<string, unknown>).repo === expected.repositoryName
    && (link as Record<string, unknown>).productionBranch === expected.productionBranch;
}

/** Re-verifies the selected account/project, then atomically commits metadata
 * and a leased Vault token. A lost SQL response is reconciled without replaying
 * the consumed provider handoff. */
export async function bindWebsiteVercelProject(input: {
  client: Pick<SupabaseClient, 'rpc'>; ownerId: string; projectId: string; handoffId: string;
  connectionId?: string; expectedVersion?: number; userId: string; accountId: string;
  configurationId: string; vercelProjectId: string; platformAccountId: string;
  repositoryId: string; repositoryOwner: string; repositoryName: string;
  productionBranch: string; isCurrentOwner(): boolean; fetcher?: typeof fetch;
}): Promise<{ connectionId: string; accountId: string; vercelProjectId: string; version: number }> {
  if (isUntrustedBrowserRuntime() || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !uuid.test(input.handoffId) || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))
    || !providerId.test(input.userId) || !providerId.test(input.accountId)
    || !/^icfg_[A-Za-z0-9]{8,128}$/.test(input.configurationId)
    || !projectId.test(input.vercelProjectId) || input.accountId === input.platformAccountId
    || !/^\d+$/.test(input.repositoryId) || !gitName.test(input.repositoryOwner)
    || !gitName.test(input.repositoryName) || !branch.test(input.productionBranch)
    || input.productionBranch.includes('..') || input.productionBranch.startsWith('/')
    || input.productionBranch.endsWith('/') || !input.isCurrentOwner()) {
    throw new Error('Vercel project could not be connected.');
  }
  const connectionId = input.connectionId ?? input.handoffId, expectedVersion = input.expectedVersion ?? 0;
  const reconcile = async () => {
    const { data, error } = await input.client.rpc('website_reconcile_vercel_project_binding', {
      p_connection_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_version: expectedVersion, p_account_id: input.accountId,
      p_vercel_project_id: input.vercelProjectId, p_configuration_id: input.configurationId,
      p_operation_id: input.handoffId,
    });
    if (error || !input.isCurrentOwner()) throw new Error();
    return data === expectedVersion + 1;
  };
  try {
    if (await reconcile()) return { connectionId, accountId: input.accountId,
      vercelProjectId: input.vercelProjectId, version: expectedVersion + 1 };
    const handoff = await consumeWebsiteConnectionHandoff({ client: input.client, id: input.handoffId,
      ownerId: input.ownerId, projectId: input.projectId, provider: 'vercel',
      isCurrentOwner: input.isCurrentOwner });
    const grant = decodeGrant(handoff.userToken), accountId = grant.teamId ?? grant.userId;
    if (grant.userId !== input.userId || accountId !== input.accountId
      || grant.configurationId !== input.configurationId) throw new Error();
    const fetcher = input.fetcher ?? fetch;
    const profile = await read(grant.accessToken, '/v2/user', fetcher);
    if (!profile.user || typeof profile.user !== 'object'
      || (profile.user as Record<string, unknown>).id !== grant.userId) throw new Error();
    if (grant.teamId) {
      const team = await read(grant.accessToken, `/v2/teams/${grant.teamId}`, fetcher), membership = team.membership;
      if (team.id !== grant.teamId || !membership || typeof membership !== 'object'
        || (membership as Record<string, unknown>).uid !== grant.userId
        || (membership as Record<string, unknown>).role !== 'OWNER'
        || (membership as Record<string, unknown>).confirmed !== true) throw new Error();
    }
    const selectedPath = `/v9/projects/${input.vercelProjectId}${grant.teamId
      ? `?teamId=${encodeURIComponent(grant.teamId)}` : ''}`;
    const expected = { vercelProjectId: input.vercelProjectId, accountId, repositoryId: input.repositoryId,
      repositoryOwner: input.repositoryOwner, repositoryName: input.repositoryName,
      productionBranch: input.productionBranch };
    if (!projectMatches(await read(grant.accessToken, selectedPath, fetcher), expected)
      || !input.isCurrentOwner()
      || !projectMatches(await read(grant.accessToken, selectedPath, fetcher), expected)) throw new Error();
    const { data, error } = await input.client.rpc('website_bind_vercel_project', {
      p_connection_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_version: expectedVersion, p_environment: handoff.environment,
      p_user_id: grant.userId, p_account_id: accountId, p_configuration_id: grant.configurationId,
      p_vercel_project_id: input.vercelProjectId, p_repository_id: input.repositoryId,
      p_repository_owner: input.repositoryOwner, p_repository_name: input.repositoryName,
      p_production_branch: input.productionBranch, p_access_token: grant.accessToken,
      p_custody_expires_at: new Date(Date.now() + 90 * 86_400_000 - 60_000).toISOString(),
      p_operation_id: input.handoffId,
    });
    if (error || data !== expectedVersion + 1 || !input.isCurrentOwner()) {
      if (await reconcile()) return { connectionId, accountId,
        vercelProjectId: input.vercelProjectId, version: expectedVersion + 1 };
      throw new Error();
    }
    return { connectionId, accountId, vercelProjectId: input.vercelProjectId, version: data };
  } catch { throw new Error('Vercel project could not be connected.'); }
}
