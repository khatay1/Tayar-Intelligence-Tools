export type OwnedVercelDeploymentStatus = 'connecting' | 'setup-incomplete' | 'deployment-failed' | 'ready';
export interface OwnedVercelDeploymentReport {
  status: OwnedVercelDeploymentStatus; deploymentId: string; missingEnvironment: string[];
  liveUrl: string | null; observedState: string;
}

const id = /^[A-Za-z0-9_-]{3,128}$/;
const team = /^team_[A-Za-z0-9]{8,128}$/;
const project = /^prj_[A-Za-z0-9]{8,128}$/;
const deployment = /^dpl_[A-Za-z0-9]{8,128}$/;
const gitName = /^[A-Za-z0-9_.-]{1,100}$/;
const branch = /^[A-Za-z0-9_./-]{1,200}$/;
const sha = /^[0-9a-f]{40}$/i;
const envName = /^[A-Z][A-Z0-9_]{1,99}$/;

/** Read-only final-state proof. It never returns environment values, logs or
 * raw provider payloads and requires the same deployment observation twice. */
export async function inspectOwnedVercelDeployment(input: {
  accessToken: string; userId: string; accountId: string; platformAccountId: string;
  projectId: string; deploymentId: string; repositoryId: string; repositoryOwner: string;
  repositoryName: string; productionBranch: string; sourceCommitSha: string;
  target: 'preview' | 'production'; requiredEnvironment: string[];
  isCurrent: () => Promise<boolean>; fetcher?: typeof fetch;
}): Promise<OwnedVercelDeploymentReport> {
  if (typeof window !== 'undefined' || !input.accessToken || input.accessToken.length > 4096
    || /[\r\n]/.test(input.accessToken) || !id.test(input.userId) || !id.test(input.accountId)
    || !id.test(input.platformAccountId) || input.accountId === input.platformAccountId
    || !project.test(input.projectId) || !deployment.test(input.deploymentId)
    || !/^\d+$/.test(input.repositoryId) || !gitName.test(input.repositoryOwner)
    || !gitName.test(input.repositoryName) || !branch.test(input.productionBranch)
    || input.productionBranch.includes('..') || !sha.test(input.sourceCommitSha)
    || !['preview', 'production'].includes(input.target) || !Array.isArray(input.requiredEnvironment)
    || input.requiredEnvironment.length > 64 || input.requiredEnvironment.some(key => !envName.test(key))
    || new Set(input.requiredEnvironment).size !== input.requiredEnvironment.length) {
    throw new Error('Vercel deployment status is unavailable.');
  }
  const fetcher = input.fetcher ?? fetch, teamScope = input.accountId !== input.userId;
  if (teamScope && !team.test(input.accountId)) throw new Error('Vercel deployment status is unavailable.');
  async function read(path: string): Promise<Record<string, unknown>> {
    const response = await fetcher(`https://api.vercel.com${path}`, { method: 'GET', redirect: 'error',
      cache: 'no-store', signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${input.accessToken}`, Accept: 'application/json' } });
    if (response.status !== 200 || Number(response.headers.get('content-length') ?? 0) > 262_144) throw new Error();
    const raw = await response.text(); if (raw.length > 262_144) throw new Error();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    return parsed as Record<string, unknown>;
  }
  const scoped = teamScope ? `teamId=${encodeURIComponent(input.accountId)}` : '';
  const projectPath = `/v9/projects/${input.projectId}${scoped ? `?${scoped}` : ''}`;
  const environmentPath = `/v10/projects/${input.projectId}/env?decrypt=false${scoped ? `&${scoped}` : ''}`;
  const deploymentPath = `/v13/deployments/${input.deploymentId}${scoped ? `?${scoped}` : ''}`;
  function projectMatches(value: Record<string, unknown>) {
    const link = value.link;
    return value.id === input.projectId && value.accountId === input.accountId && value.paused !== true
      && !!link && typeof link === 'object' && !Array.isArray(link)
      && (link as Record<string, unknown>).type === 'github'
      && String((link as Record<string, unknown>).repoId) === input.repositoryId
      && (link as Record<string, unknown>).org === input.repositoryOwner
      && (link as Record<string, unknown>).repo === input.repositoryName
      && (link as Record<string, unknown>).productionBranch === input.productionBranch;
  }
  function deploymentState(value: Record<string, unknown>): { state: string; url: string | null } | null {
    const meta = value.meta;
    if (value.id !== input.deploymentId || value.projectId !== input.projectId
      || value.ownerId !== input.accountId || value.target !== input.target
      || !meta || typeof meta !== 'object' || Array.isArray(meta)
      || (meta as Record<string, unknown>).githubCommitSha !== input.sourceCommitSha
      || (meta as Record<string, unknown>).githubCommitRef !== input.productionBranch
      || typeof value.readyState !== 'string') return null;
    const state = value.readyState;
    let url: string | null = null;
    if (state === 'READY' && typeof value.url === 'string') {
      try {
        const candidate = new URL(`https://${value.url}`);
        if (candidate.protocol === 'https:' && candidate.username === '' && candidate.password === ''
          && candidate.port === '' && candidate.pathname === '/' && !candidate.search && !candidate.hash
          && /^[a-z0-9-]+\.vercel\.app$/.test(candidate.hostname)) url = candidate.origin;
      } catch { return null; }
      if (!url) return null;
    }
    return { state, url };
  }
  try {
    if (!await input.isCurrent()) throw new Error();
    const profile = await read('/v2/user');
    if (!profile.user || typeof profile.user !== 'object'
      || (profile.user as Record<string, unknown>).id !== input.userId) throw new Error();
    if (teamScope) {
      const account = await read(`/v2/teams/${input.accountId}`), membership = account.membership;
      if (account.id !== input.accountId || !membership || typeof membership !== 'object'
        || (membership as Record<string, unknown>).uid !== input.userId
        || (membership as Record<string, unknown>).role !== 'OWNER'
        || (membership as Record<string, unknown>).confirmed !== true) throw new Error();
    }
    if (!projectMatches(await read(projectPath))) throw new Error();
    const environment = await read(environmentPath);
    if (!Array.isArray(environment.envs) || environment.envs.length > 1000) throw new Error();
    const available = new Set<string>();
    for (const raw of environment.envs) {
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
      const variable = raw as Record<string, unknown>;
      if (typeof variable.key !== 'string' || !envName.test(variable.key) || !Array.isArray(variable.target)) continue;
      const target = input.target === 'production' ? 'production' : 'preview';
      if (variable.target.includes(target)
        && (variable.gitBranch == null || variable.gitBranch === input.productionBranch)) available.add(variable.key);
    }
    const missingEnvironment = input.requiredEnvironment.filter(key => !available.has(key)).sort();
    const first = deploymentState(await read(deploymentPath));
    if (!first || !await input.isCurrent()) throw new Error();
    const second = deploymentState(await read(deploymentPath));
    if (!second || second.state !== first.state || second.url !== first.url || !await input.isCurrent()) throw new Error();
    const failed = ['ERROR', 'CANCELED'].includes(second.state);
    const status: OwnedVercelDeploymentStatus = missingEnvironment.length ? 'setup-incomplete'
      : failed ? 'deployment-failed' : second.state === 'READY' ? 'ready' : 'connecting';
    return { status, deploymentId: input.deploymentId, missingEnvironment,
      liveUrl: status === 'ready' ? second.url : null, observedState: second.state };
  } catch { throw new Error('Vercel deployment status is unavailable.'); }
}

