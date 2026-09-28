/** Server-only GitHub App installation token minted for one observed account
 * and one repository. The App's PKCS#8 signing key stays in platform secrets;
 * the installation token exists only for the current export request. */
const numeric = /^[1-9][0-9]{0,19}$/;
const clientId = /^[a-zA-Z0-9_]{5,100}$/;
const repoName = /^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/;
const branch = /^[a-zA-Z0-9_./-]{1,200}$/;
const api = 'https://api.github.com';

function base64Url(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function appJwt(input: { clientId: string; privateKeyPkcs8: string; now: number }): Promise<string> {
  const match = /^-----BEGIN PRIVATE KEY-----\s+([A-Za-z0-9+/=\s]+)\s+-----END PRIVATE KEY-----\s*$/.exec(input.privateKeyPkcs8);
  if (!match || match[1].length > 16384) throw new Error();
  const bytes = Uint8Array.from(atob(match[1].replace(/\s/g, '')), char => char.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', bytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']);
  const timestamp = Math.floor(input.now / 1000);
  const head = base64Url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const claim = base64Url(new TextEncoder().encode(JSON.stringify({ iat: timestamp - 60, exp: timestamp + 540, iss: input.clientId })));
  const payload = `${head}.${claim}`;
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(payload)));
  return `${payload}.${base64Url(signature)}`;
}

async function github(input: { fetcher: typeof fetch; path: string; method: 'GET' | 'POST'; token: string; body?: unknown }) {
  const response = await input.fetcher(`${api}${input.path}`, { method: input.method, redirect: 'error',
    signal: AbortSignal.timeout(8000), headers: { Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${input.token}`, 'X-GitHub-Api-Version': '2022-11-28',
      ...(input.body ? { 'Content-Type': 'application/json' } : {}) },
    ...(input.body ? { body: JSON.stringify(input.body) } : {}),
  });
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > 3_000_000) throw new Error();
  const raw = await response.text();
  if (raw.length > 3_000_000) throw new Error();
  const value = JSON.parse(raw);
  if (!value || typeof value !== 'object') throw new Error();
  return value as Record<string, unknown>;
}

export async function mintWebsiteGitHubRepositoryToken(input: {
  clientId: string;
  privateKeyPkcs8: string;
  accountId: string;
  repositoryId: string;
  fetcher?: typeof fetch;
  now?: () => number;
}): Promise<{ token: string; expiresAt: string; repositoryId: string; repositoryFullName: string; defaultBranch: string }> {
  if (typeof window !== 'undefined') throw new Error('GitHub export requires a trusted server.');
  if (!clientId.test(input.clientId) || !numeric.test(input.accountId) || !numeric.test(input.repositoryId)
    || !Number.isSafeInteger(Number(input.repositoryId))) {
    throw new Error('GitHub repository access is unavailable.');
  }
  try {
    const now = (input.now ?? Date.now)();
    if (!Number.isFinite(now)) throw new Error();
    const jwt = await appJwt({ clientId: input.clientId, privateKeyPkcs8: input.privateKeyPkcs8, now });
    const fetcher = input.fetcher ?? fetch;
    let installationId: string | undefined;
    for (let page = 1; page <= 10 && !installationId; page++) {
      const result = await github({ fetcher, path: `/app/installations?per_page=100&page=${page}`, method: 'GET', token: jwt });
      if (!Array.isArray(result) || result.length > 100) throw new Error();
      for (const candidate of result as Array<Record<string, unknown>>) {
        const account = candidate.account as Record<string, unknown> | null;
        if (String(account?.id) === input.accountId && !candidate.suspended_at
          && (candidate.permissions as Record<string, unknown>)?.contents === 'write') {
          if (!numeric.test(String(candidate.id)) || installationId) throw new Error();
          installationId = String(candidate.id);
        }
      }
      if (result.length < 100) break;
    }
    if (!installationId) throw new Error();
    const grant = await github({ fetcher, path: `/app/installations/${installationId}/access_tokens`, method: 'POST',
      token: jwt, body: { repository_ids: [Number(input.repositoryId)], permissions: { contents: 'write' } } });
    if (typeof grant.token !== 'string' || grant.token.length < 20 || grant.token.length > 16384
      || (grant.permissions as Record<string, unknown>)?.contents !== 'write'
      || !Array.isArray(grant.repositories) || grant.repositories.length !== 1) throw new Error();
    const repository = grant.repositories[0] as Record<string, unknown>;
    const account = repository.owner as Record<string, unknown> | null;
    if (String(repository.id) !== input.repositoryId || String(account?.id) !== input.accountId
      || typeof repository.full_name !== 'string' || !repoName.test(repository.full_name)
      || typeof repository.default_branch !== 'string' || !branch.test(repository.default_branch)
      || repository.archived || repository.disabled) throw new Error();
    const expiry = Date.parse(String(grant.expires_at));
    if (!Number.isFinite(expiry) || expiry <= now + 60_000 || expiry > now + 3_900_000) throw new Error();
    return { token: grant.token, expiresAt: new Date(expiry).toISOString(), repositoryId: input.repositoryId,
      repositoryFullName: repository.full_name, defaultBranch: repository.default_branch };
  } catch { throw new Error('GitHub repository access is unavailable.'); }
}
