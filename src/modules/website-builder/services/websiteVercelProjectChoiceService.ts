import type { SupabaseClient } from '@supabase/supabase-js';
import { peekWebsiteConnectionHandoff } from './websiteConnectionHandoffService';

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
  if (typeof window !== 'undefined' || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
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

