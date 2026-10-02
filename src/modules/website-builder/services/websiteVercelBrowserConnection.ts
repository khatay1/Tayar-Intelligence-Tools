import { assertInfrastructureConnection, type PublicInfrastructureConnection } from '../core/application-infrastructure-connections';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const providerId = /^[A-Za-z0-9_-]{3,128}$/;
const configurationId = /^icfg_[A-Za-z0-9]{8,128}$/;
const projectId = /^prj_[A-Za-z0-9]{8,128}$/;
const branch = /^[A-Za-z0-9_./-]{1,200}$/;
const pendingKey = 'tayar:vercel-connection-pending';
const pendingDisconnectKey = 'tayar:vercel-disconnect-pending';

export interface VercelBrowserScope {
  ownerId: string; projectId: string; loadSequence: number; isCurrent(): boolean;
}
export interface VercelBrowserTransport {
  platformUrl: string; anonKey: string;
  getSession(): Promise<{ ownerId: string; accessToken: string } | null>;
  fetcher?: typeof fetch;
}
export interface VercelHandoff { id: string; ownerId: string; projectId: string; loadSequence: number }

function assertScope(scope: VercelBrowserScope) {
  if (!uuid.test(scope.ownerId) || !uuid.test(scope.projectId) || !Number.isSafeInteger(scope.loadSequence)
    || scope.loadSequence < 0 || !scope.isCurrent()) throw new Error('Project or account changed.');
}
async function request(input: { scope: VercelBrowserScope; transport: VercelBrowserTransport;
  action: 'begin' | 'options' | 'bind' | 'disconnect'; body: Record<string, unknown> }) {
  assertScope(input.scope);
  const session = await input.transport.getSession();
  if (!session || session.ownerId !== input.scope.ownerId || !session.accessToken || !input.scope.isCurrent())
    throw new Error('Sign in to connect Vercel.');
  const base = new URL(input.transport.platformUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash
    || !input.transport.anonKey) throw new Error('Connection setup is unavailable.');
  const endpoint = new URL(`${base.pathname.replace(/\/$/, '')}/functions/v1/website-vercel-connection`, base.origin);
  endpoint.searchParams.set('action', input.action);
  try {
    const response = await (input.transport.fetcher ?? fetch)(endpoint.toString(), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}`,
        apikey: input.transport.anonKey },
      body: JSON.stringify({ projectId: input.scope.projectId, ...input.body }),
    });
    if (!input.scope.isCurrent() || !response.ok || Number(response.headers.get('content-length') ?? 0) > 100_000)
      throw new Error();
    const raw = await response.text();
    if (raw.length > 100_000 || !input.scope.isCurrent()) throw new Error();
    return JSON.parse(raw);
  } catch { throw new Error('Vercel connection is unavailable. Refresh and try again.'); }
}

export async function beginWebsiteVercelConnection(input: {
  scope: VercelBrowserScope; transport: VercelBrowserTransport;
  environment: 'preview' | 'production'; storage: Pick<Storage, 'setItem'>;
}): Promise<string> {
  const data = await request({ scope: input.scope, transport: input.transport, action: 'begin',
    body: { environment: input.environment } });
  const url = new URL(data.authorizationUrl);
  if (url.origin !== 'https://vercel.com' || !/^\/integrations\/[a-z0-9][a-z0-9-]{1,99}\/new$/.test(url.pathname)
    || url.username || url.password || url.hash || !/^[0-9a-f]{64}$/.test(url.searchParams.get('state') ?? '')
    || url.searchParams.size !== 1 || !input.scope.isCurrent()) throw new Error('Vercel authorization URL is invalid.');
  input.storage.setItem(pendingKey, JSON.stringify({ ownerId: input.scope.ownerId, projectId: input.scope.projectId }));
  return url.toString();
}

export function consumeWebsiteVercelHandoffFragment(input: {
  scope: VercelBrowserScope; location: Pick<Location, 'hash' | 'pathname' | 'search'>;
  history: Pick<History, 'replaceState' | 'state'>;
  storage: Pick<Storage, 'getItem' | 'removeItem'>;
}): VercelHandoff | null {
  const fragment = input.location.hash;
  if (!fragment.startsWith('#tayar_vercel_handoff=')) return null;
  input.history.replaceState(input.history.state, '', `${input.location.pathname}${input.location.search}`);
  const pending = input.storage.getItem(pendingKey); input.storage.removeItem(pendingKey);
  try {
    const params = new URLSearchParams(fragment.slice(1)), id = params.get('tayar_vercel_handoff');
    const scope = JSON.parse(pending ?? 'null'); assertScope(input.scope);
    if (params.size !== 1 || !id || !uuid.test(id) || !scope
      || scope.ownerId !== input.scope.ownerId || scope.projectId !== input.scope.projectId) throw new Error();
    return { id, ownerId: scope.ownerId, projectId: scope.projectId, loadSequence: input.scope.loadSequence };
  } catch { return null; }
}

function assertHandoff(scope: VercelBrowserScope, handoff: VercelHandoff) {
  if (handoff.ownerId !== scope.ownerId || handoff.projectId !== scope.projectId
    || handoff.loadSequence !== scope.loadSequence || !uuid.test(handoff.id)) throw new Error('Project or account changed.');
}
export async function listWebsiteVercelChoices(input: {
  scope: VercelBrowserScope; transport: VercelBrowserTransport; handoff: VercelHandoff;
}) {
  assertHandoff(input.scope, input.handoff);
  const data = await request({ scope: input.scope, transport: input.transport,
    action: 'options', body: { handoffId: input.handoff.id } });
  if (!data || !providerId.test(String(data.userId)) || !providerId.test(String(data.accountId))
    || !configurationId.test(String(data.configurationId)) || !Array.isArray(data.projects)
    || data.projects.length > 100) throw new Error('Vercel projects are unavailable.');
  const projects = (data.projects as unknown[]).map(item => {
    const row = item as Record<string, unknown>;
    if (!row || !projectId.test(String(row.projectId)) || typeof row.projectName !== 'string'
      || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(row.projectName) || row.accountId !== data.accountId
      || !['personal', 'team'].includes(String(row.accountType))
      || typeof row.productionBranch !== 'string' || !branch.test(row.productionBranch)
      || row.productionBranch.includes('..') || row.productionBranch.startsWith('/')
      || row.productionBranch.endsWith('/')) throw new Error('Vercel projects are unavailable.');
    return { projectId: String(row.projectId), projectName: row.projectName,
      accountId: String(row.accountId), accountType: row.accountType as 'personal' | 'team',
      productionBranch: row.productionBranch };
  });
  return { userId: String(data.userId), accountId: String(data.accountId),
    configurationId: String(data.configurationId), projects };
}

export async function selectWebsiteVercelProject(input: {
  scope: VercelBrowserScope; transport: VercelBrowserTransport; handoff: VercelHandoff;
  userId: string; accountId: string; configurationId: string; vercelProjectId: string;
  connectionId?: string; expectedVersion?: number;
}) {
  assertHandoff(input.scope, input.handoff);
  if (!providerId.test(input.userId) || !providerId.test(input.accountId)
    || !configurationId.test(input.configurationId) || !projectId.test(input.vercelProjectId)
    || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)) throw new Error('Project or account changed.');
  const data = await request({ scope: input.scope, transport: input.transport, action: 'bind', body: {
    handoffId: input.handoff.id, userId: input.userId, accountId: input.accountId,
    configurationId: input.configurationId, vercelProjectId: input.vercelProjectId,
    connectionId: input.connectionId, expectedVersion: input.expectedVersion,
  } });
  if (data?.status !== 'connected' || !uuid.test(data.connectionId) || data.accountId !== input.accountId
    || data.vercelProjectId !== input.vercelProjectId || !Number.isSafeInteger(data.version)
    || data.version !== (input.expectedVersion ?? 0) + 1) throw new Error('Vercel project binding could not be verified.');
  return { connectionId: data.connectionId as string, version: data.version as number };
}

type DisconnectPending = { ownerId: string; projectId: string; connectionId: string;
  expectedVersion: number; operationId: string; commitId: string };
function parseDisconnectPending(value: string | null): DisconnectPending | null {
  try {
    const row = JSON.parse(value ?? 'null') as Record<string, unknown> | null;
    if (!row || Object.keys(row).sort().join(',')
      !== ['commitId', 'connectionId', 'expectedVersion', 'operationId', 'ownerId', 'projectId'].join(',')
      || ![row.ownerId, row.projectId, row.connectionId, row.operationId, row.commitId]
        .every(item => typeof item === 'string' && uuid.test(item))
      || !Number.isSafeInteger(row.expectedVersion) || Number(row.expectedVersion) < 1) return null;
    return row as DisconnectPending;
  } catch { return null; }
}

/** Keeps the exact operation/commit UUIDs after an uncertain response so a
 * user retry reconciles the committed disconnect before any provider replay. */
export async function disconnectWebsiteVercelConnection(input: {
  scope: VercelBrowserScope; transport: VercelBrowserTransport;
  connection: PublicInfrastructureConnection;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  randomUUID?: () => string;
}): Promise<{ connectionId: string; version: number }> {
  assertScope(input.scope);
  const connection = assertInfrastructureConnection({ ...input.connection, operationId: null });
  if (connection.provider !== 'vercel' || connection.ownerId !== input.scope.ownerId
    || connection.projectId !== input.scope.projectId || connection.status === 'disconnected'
    || !connection.targetId) throw new Error('Project or account changed.');
  const key = `${pendingDisconnectKey}:${connection.id}`;
  let pending: DisconnectPending | null;
  try { pending = parseDisconnectPending(input.storage.getItem(key)); } catch {
    throw new Error('Vercel disconnect is unavailable. Refresh and try again.');
  }
  if (!pending || pending.ownerId !== input.scope.ownerId || pending.projectId !== input.scope.projectId
    || pending.connectionId !== connection.id || pending.expectedVersion !== connection.version) {
    const create = input.randomUUID ?? (() => crypto.randomUUID());
    const operationId = create(), commitId = create();
    if (!uuid.test(operationId) || !uuid.test(commitId) || operationId === commitId)
      throw new Error('Vercel disconnect is unavailable. Refresh and try again.');
    pending = { ownerId: input.scope.ownerId, projectId: input.scope.projectId,
      connectionId: connection.id, expectedVersion: connection.version, operationId, commitId };
    try { input.storage.setItem(key, JSON.stringify(pending)); } catch {
      throw new Error('Vercel disconnect is unavailable. Refresh and try again.');
    }
  }
  const data = await request({ scope: input.scope, transport: input.transport, action: 'disconnect', body: {
    connectionId: pending.connectionId, expectedVersion: pending.expectedVersion,
    operationId: pending.operationId, commitId: pending.commitId,
  } });
  if (!data || Object.keys(data).sort().join(',') !== ['connectionId', 'installation', 'status', 'version'].join(',')
    || data.status !== 'disconnected' || data.installation !== 'retained'
    || data.connectionId !== connection.id || data.version !== connection.version + 1)
    throw new Error('Vercel disconnect could not be verified.');
  try { input.storage.removeItem(key); } catch { /* a stale UUID pair remains safe to reconcile */ }
  return { connectionId: connection.id, version: data.version as number };
}
