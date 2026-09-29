/** Request-local, read-only Vercel target proof. Caller supplies the exact
 * private account/project/GitHub binding and rechecks its registry version. */
export async function verifyOwnedVercelProject(input: {
  accessToken: string; userId: string; accountId: string; platformAccountId: string;
  projectId: string; repositoryId: string; repositoryOwner: string; repositoryName: string;
  productionBranch: string; isCurrent: () => Promise<boolean>; fetcher?: typeof fetch;
}): Promise<boolean> {
  const id = /^[A-Za-z0-9_-]{3,100}$/;
  const gitName = /^[A-Za-z0-9_.-]{1,100}$/;
  if (typeof window !== 'undefined' || !input.accessToken || /[\r\n]/.test(input.accessToken)
    || !id.test(input.userId) || !id.test(input.accountId) || !id.test(input.platformAccountId)
    || input.accountId === input.platformAccountId || !/^prj_[A-Za-z0-9]{8,100}$/.test(input.projectId)
    || !/^\d+$/.test(input.repositoryId) || !gitName.test(input.repositoryOwner)
    || !gitName.test(input.repositoryName) || !/^[A-Za-z0-9_./-]{1,200}$/.test(input.productionBranch)
    || input.productionBranch.includes('..') || input.productionBranch.startsWith('/')
    || input.productionBranch.endsWith('/')) return false;
  const fetcher = input.fetcher ?? fetch;
  const team = input.accountId !== input.userId;
  if (team && !/^team_[A-Za-z0-9]{8,100}$/.test(input.accountId)) return false;
  async function read(path: string): Promise<Record<string, unknown>> {
    const response = await fetcher(`https://api.vercel.com${path}`, { method: 'GET',
      headers: { Authorization: `Bearer ${input.accessToken}` }, redirect: 'error', cache: 'no-store' });
    if (response.status !== 200) throw new Error();
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  }
  const projectPath = `/v9/projects/${input.projectId}${team ? `?teamId=${input.accountId}` : ''}`;
  function matches(project: Record<string, unknown>): boolean {
    const link = project.link;
    return project.id === input.projectId && project.accountId === input.accountId
      && project.paused !== true && link !== null && typeof link === 'object'
      && (link as Record<string, unknown>).type === 'github'
      && String((link as Record<string, unknown>).repoId) === input.repositoryId
      && (link as Record<string, unknown>).org === input.repositoryOwner
      && (link as Record<string, unknown>).repo === input.repositoryName
      && (link as Record<string, unknown>).productionBranch === input.productionBranch;
  }
  try {
    if (!await input.isCurrent()) return false;
    const profile = await read('/v2/user');
    if (!profile.user || typeof profile.user !== 'object'
      || (profile.user as Record<string, unknown>).id !== input.userId) return false;
    if (team) {
      const account = await read(`/v2/teams/${input.accountId}`);
      const membership = account.membership;
      if (account.id !== input.accountId || !membership || typeof membership !== 'object'
        || (membership as Record<string, unknown>).uid !== input.userId
        || (membership as Record<string, unknown>).role !== 'OWNER'
        || (membership as Record<string, unknown>).confirmed !== true) return false;
    }
    if (!matches(await read(projectPath))) return false;
    return await input.isCurrent() && matches(await read(projectPath)) && await input.isCurrent();
  } catch { return false; }
}
