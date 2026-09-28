const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numeric = /^[1-9][0-9]{0,19}$/;
const pendingKey = 'tayar:github-connection-pending';

export interface GitHubBrowserScope {
  ownerId: string;
  projectId: string;
  loadSequence: number;
  isCurrent(): boolean;
}
export interface GitHubBrowserTransport {
  platformUrl: string;
  anonKey: string;
  getSession(): Promise<{ ownerId: string; accessToken: string } | null>;
  fetcher?: typeof fetch;
}
export interface GitHubHandoff { id: string; projectId: string; ownerId: string; loadSequence: number }

function assertScope(scope: GitHubBrowserScope) {
  if (!uuid.test(scope.ownerId) || !uuid.test(scope.projectId) || !Number.isSafeInteger(scope.loadSequence)
    || scope.loadSequence < 0 || !scope.isCurrent()) throw new Error('Project or account changed.');
}
async function request(input: { scope: GitHubBrowserScope; transport: GitHubBrowserTransport;
  action: 'begin' | 'options' | 'bind'; body: Record<string, unknown> }) {
  assertScope(input.scope);
  const session = await input.transport.getSession();
  if (!session || session.ownerId !== input.scope.ownerId || !session.accessToken || !input.scope.isCurrent()) {
    throw new Error('Sign in to connect GitHub.');
  }
  const base = new URL(input.transport.platformUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash
    || !input.transport.anonKey) throw new Error('Connection setup is unavailable.');
  const endpoint = new URL(`${base.pathname.replace(/\/$/, '')}/functions/v1/website-github-connection`, base.origin);
  endpoint.searchParams.set('action', input.action);
  try {
    const response = await (input.transport.fetcher ?? fetch)(endpoint.toString(), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}`,
        apikey: input.transport.anonKey },
      body: JSON.stringify({ projectId: input.scope.projectId, ...input.body }),
    });
    if (!input.scope.isCurrent() || !response.ok || Number(response.headers.get('content-length') ?? 0) > 100_000) throw new Error();
    const raw = await response.text();
    if (raw.length > 100_000 || !input.scope.isCurrent()) throw new Error();
    return JSON.parse(raw);
  } catch { throw new Error('GitHub connection is unavailable. Refresh and try again.'); }
}

export async function beginWebsiteGitHubConnection(input: {
  scope: GitHubBrowserScope; transport: GitHubBrowserTransport;
  environment: 'preview' | 'production'; storage: Pick<Storage, 'setItem' | 'removeItem'>;
}): Promise<string> {
  const data = await request({ scope: input.scope, transport: input.transport, action: 'begin',
    body: { environment: input.environment } });
  const url = new URL(data.authorizationUrl);
  if (url.origin !== 'https://github.com' || url.pathname !== '/login/oauth/authorize'
    || url.username || url.password || url.hash || !url.searchParams.get('client_id')
    || !/^[0-9a-f]{64}$/.test(url.searchParams.get('state') ?? '') || !input.scope.isCurrent()) {
    throw new Error('GitHub authorization URL is invalid.');
  }
  input.storage.setItem(pendingKey, JSON.stringify({ ownerId: input.scope.ownerId,
    projectId: input.scope.projectId }));
  return url.toString();
}

/** Remove the opaque fragment before asynchronous work or rendering. Session
 * storage contains only the pending editor identity, never provider tokens. */
export function consumeWebsiteGitHubHandoffFragment(input: {
  scope: GitHubBrowserScope; location: Pick<Location, 'hash' | 'pathname' | 'search'>;
  history: Pick<History, 'replaceState' | 'state'>;
  storage: Pick<Storage, 'getItem' | 'removeItem'>;
}): GitHubHandoff | null {
  const fragment = input.location.hash;
  if (!fragment.startsWith('#tayar_github_handoff=')) return null;
  input.history.replaceState(input.history.state, '', `${input.location.pathname}${input.location.search}`);
  const pending = input.storage.getItem(pendingKey);
  input.storage.removeItem(pendingKey);
  try {
    const params = new URLSearchParams(fragment.slice(1));
    const id = params.get('tayar_github_handoff');
    const scope = JSON.parse(pending ?? 'null');
    assertScope(input.scope);
    if (params.size !== 1 || !id || !uuid.test(id) || !scope
      || scope.ownerId !== input.scope.ownerId || scope.projectId !== input.scope.projectId) throw new Error();
    return { id, ownerId: scope.ownerId, projectId: scope.projectId, loadSequence: input.scope.loadSequence };
  } catch { return null; }
}

export async function listWebsiteGitHubChoices(input: { scope: GitHubBrowserScope; transport: GitHubBrowserTransport;
  handoff: GitHubHandoff; installationId?: string; page: number }) {
  if (input.handoff.ownerId !== input.scope.ownerId || input.handoff.projectId !== input.scope.projectId
    || input.handoff.loadSequence !== input.scope.loadSequence || !uuid.test(input.handoff.id)
    || (input.installationId !== undefined && !numeric.test(input.installationId))
    || !Number.isSafeInteger(input.page) || input.page < 1 || input.page > 10) throw new Error('Project or account changed.');
  const data = await request({ scope: input.scope, transport: input.transport, action: 'options',
    body: { handoffId: input.handoff.id, installationId: input.installationId, page: input.page } });
  if (!data || !Array.isArray(data.installations) || !Array.isArray(data.repositories)
    || data.installations.length > 100 || data.repositories.length > 100 || typeof data.hasMore !== 'boolean') {
    throw new Error('GitHub repositories are unavailable.');
  }
  const installations = (data.installations as unknown[]).map(item => {
    const row = item as Record<string, unknown>;
    if (!row || !numeric.test(String(row.id)) || !numeric.test(String(row.accountId))
      || typeof row.accountLogin !== 'string' || !/^[a-zA-Z0-9-]{1,100}$/.test(row.accountLogin)) {
      throw new Error('GitHub repositories are unavailable.');
    }
    return { id: String(row.id), accountId: String(row.accountId), accountLogin: row.accountLogin as string };
  });
  const repositories = (data.repositories as unknown[]).map(item => {
    const row = item as Record<string, unknown>;
    if (!row || !numeric.test(String(row.id)) || typeof row.fullName !== 'string'
      || !/^[a-zA-Z0-9_.-]{1,39}\/[a-zA-Z0-9_.-]{1,100}$/.test(row.fullName)
      || typeof row.defaultBranch !== 'string' || !/^[a-zA-Z0-9_./-]{1,200}$/.test(row.defaultBranch)) {
      throw new Error('GitHub repositories are unavailable.');
    }
    return { id: String(row.id), fullName: row.fullName, defaultBranch: row.defaultBranch };
  });
  return { installations, repositories, hasMore: data.hasMore as boolean };
}

export async function selectWebsiteGitHubRepository(input: { scope: GitHubBrowserScope; transport: GitHubBrowserTransport;
  handoff: GitHubHandoff; installationId: string; repositoryId: string;
  connectionId?: string; expectedVersion?: number }) {
  if (input.handoff.ownerId !== input.scope.ownerId || input.handoff.projectId !== input.scope.projectId
    || input.handoff.loadSequence !== input.scope.loadSequence || !uuid.test(input.handoff.id)
    || !numeric.test(input.installationId) || !numeric.test(input.repositoryId)
    || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)) throw new Error('Project or account changed.');
  const data = await request({ scope: input.scope, transport: input.transport, action: 'bind', body: {
    handoffId: input.handoff.id, installationId: input.installationId, repositoryId: input.repositoryId,
    connectionId: input.connectionId, expectedVersion: input.expectedVersion,
  } });
  if (data?.status !== 'connected' || !uuid.test(data.connectionId) || data.repositoryId !== input.repositoryId
    || !Number.isSafeInteger(data.version) || data.version !== (input.expectedVersion ?? 0) + 1) {
    throw new Error('GitHub repository binding could not be verified.');
  }
  return { connectionId: data.connectionId as string, version: data.version as number };
}
