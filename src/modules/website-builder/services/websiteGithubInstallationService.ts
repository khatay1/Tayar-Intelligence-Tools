/** Server-only GitHub App user-token verification. The setup URL's
 * installation_id is untrusted until these user-scoped API reads succeed. */
export interface VerifiedGitHubRepository {
  installationId: string;
  accountId: string;
  accountLogin: string;
  repositoryId: string;
  repositoryFullName: string;
  defaultBranch: string;
}

const numeric = /^[1-9][0-9]{0,19}$/;
const repoName = /^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/;
const branch = /^[a-zA-Z0-9_./-]{1,200}$/;
const api = 'https://api.github.com';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('GitHub account could not be verified.');
  return value as Record<string, unknown>;
}

async function githubGet(fetcher: typeof fetch, token: string, path: string): Promise<Record<string, unknown>> {
  const response = await fetcher(`${api}${path}`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  });
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 3_000_000) throw new Error('GitHub account could not be verified.');
  const body = await response.text();
  if (body.length > 3_000_000) throw new Error('GitHub account could not be verified.');
  try { return object(JSON.parse(body)); } catch { throw new Error('GitHub account could not be verified.'); }
}

/** A short-lived user token is supplied by a trusted OAuth callback; this
 * function never writes it to a snapshot, registry or log. The installation
 * token used later for export must be minted on the server and rechecked. */
export async function verifyGitHubInstallationRepository(input: {
  userToken: string;
  installationId: string;
  repositoryId: string;
  fetcher?: typeof fetch;
}): Promise<VerifiedGitHubRepository> {
  if (typeof window !== 'undefined') throw new Error('GitHub verification requires a server.');
  const { userToken, installationId, repositoryId } = input;
  if (!numeric.test(installationId) || !numeric.test(repositoryId) || !userToken || userToken.length > 4096) {
    throw new Error('GitHub account could not be verified.');
  }
  const fetcher = input.fetcher ?? fetch;
  try {
    let installation: Record<string, unknown> | undefined;
    for (let page = 1; page <= 10 && !installation; page++) {
      const result = await githubGet(fetcher, userToken, `/user/installations?per_page=100&page=${page}`);
      if (!Array.isArray(result.installations) || result.installations.length > 100) throw new Error();
      installation = result.installations.map(object).find(item => String(item.id) === installationId);
      if (result.installations.length < 100) break;
    }
    if (!installation || installation.suspended_at || object(installation.permissions).contents !== 'write') throw new Error();
    const account = object(installation.account);
    const accountId = String(account.id);
    if (!numeric.test(accountId) || typeof account.login !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(account.login)) throw new Error();
    let repository: Record<string, unknown> | undefined;
    for (let page = 1; page <= 10 && !repository; page++) {
      const result = await githubGet(fetcher, userToken, `/user/installations/${installationId}/repositories?per_page=100&page=${page}`);
      if (!Array.isArray(result.repositories) || result.repositories.length > 100) throw new Error();
      repository = result.repositories.map(object).find(item => String(item.id) === repositoryId);
      if (result.repositories.length < 100) break;
    }
    if (!repository || repository.archived || repository.disabled || object(repository.owner).id !== account.id
      || typeof repository.full_name !== 'string' || !repoName.test(repository.full_name)
      || typeof repository.default_branch !== 'string' || !branch.test(repository.default_branch)
      || object(repository.permissions).push !== true) throw new Error();
    return { installationId, accountId, accountLogin: account.login,
      repositoryId, repositoryFullName: repository.full_name, defaultBranch: repository.default_branch };
  } catch {
    throw new Error('GitHub account could not be verified.');
  }
}
