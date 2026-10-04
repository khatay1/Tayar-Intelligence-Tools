import type { WebsiteConnectionBrowserTransport } from './websiteConnectionEndpointCatalog';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref = /^[a-z]{20}$/;
const slug = /^[a-z0-9][a-z0-9-]{0,199}$/;
const providerId = /^[A-Za-z0-9_-]{1,200}$/;
const pendingKey = 'tayar:supabase-connection-pending';

export interface SupabaseBrowserScope {
  ownerId: string; projectId: string; loadSequence: number; isCurrent(): boolean;
}
export interface SupabaseHandoff { id: string; ownerId: string; projectId: string; environment: 'preview' | 'production'; loadSequence: number }
export interface SupabaseProjectChoice { projectRef: string; projectName: string;
  organizationId: string; organizationSlug: string; organizationName: string }

function assertScope(scope: SupabaseBrowserScope) {
  if (!uuid.test(scope.ownerId) || !uuid.test(scope.projectId) || !Number.isSafeInteger(scope.loadSequence)
    || scope.loadSequence < 0 || !scope.isCurrent()) throw new Error('Project or account changed.');
}
async function request(input: { scope: SupabaseBrowserScope; transport: WebsiteConnectionBrowserTransport;
  action: 'begin' | 'options' | 'bind'; body: Record<string, unknown> }) {
  assertScope(input.scope);
  const session = await input.transport.getSession();
  if (!session || session.ownerId !== input.scope.ownerId || !session.accessToken || !input.scope.isCurrent())
    throw new Error('Sign in to connect Supabase.');
  const base = new URL(input.transport.platformUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.search || base.hash
    || !input.transport.anonKey) throw new Error('Connection setup is unavailable.');
  const endpoint = new URL(`${base.pathname.replace(/\/$/, '')}/functions/v1/website-supabase-connection`, base.origin);
  endpoint.searchParams.set('action', input.action);
  try {
    const response = await (input.transport.fetcher ?? fetch)(endpoint.toString(), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12_000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}`,
        apikey: input.transport.anonKey },
      body: JSON.stringify({ projectId: input.scope.projectId, ...input.body }),
    });
    if (!input.scope.isCurrent() || !response.ok || Number(response.headers.get('content-length') ?? 0) > 100_000)
      throw new Error();
    const raw = await response.text();
    if (raw.length > 100_000 || !input.scope.isCurrent()) throw new Error();
    return JSON.parse(raw);
  } catch { throw new Error('Supabase connection is unavailable. Refresh and try again.'); }
}

export async function beginWebsiteSupabaseConnection(input: { scope: SupabaseBrowserScope;
  transport: WebsiteConnectionBrowserTransport; environment: 'preview' | 'production';
  storage: Pick<Storage, 'setItem'> }): Promise<string> {
  const data = await request({ scope: input.scope, transport: input.transport, action: 'begin',
    body: { environment: input.environment } });
  const url = new URL(data.authorizationUrl);
  if (url.origin !== 'https://api.supabase.com' || url.pathname !== '/v1/oauth/authorize'
    || url.username || url.password || url.hash || !url.searchParams.get('client_id')
    || url.searchParams.get('response_type') !== 'code' || url.searchParams.get('code_challenge_method') !== 'S256'
    || !url.searchParams.get('code_challenge') || !/^[0-9a-f]{64}$/.test(url.searchParams.get('state') ?? '')
    || !input.scope.isCurrent()) throw new Error('Supabase authorization URL is invalid.');
  input.storage.setItem(pendingKey, JSON.stringify({ ownerId: input.scope.ownerId, projectId: input.scope.projectId,
    environment: input.environment }));
  return url.toString();
}

export function consumeWebsiteSupabaseHandoffFragment(input: { scope: SupabaseBrowserScope;
  location: Pick<Location, 'hash' | 'pathname' | 'search'>; history: Pick<History, 'replaceState' | 'state'>;
  storage: Pick<Storage, 'getItem' | 'removeItem'> }): SupabaseHandoff | null {
  const fragment = input.location.hash;
  if (!fragment.startsWith('#tayar_supabase_handoff=')) return null;
  input.history.replaceState(input.history.state, '', `${input.location.pathname}${input.location.search}`);
  const pending = input.storage.getItem(pendingKey); input.storage.removeItem(pendingKey);
  try {
    const params = new URLSearchParams(fragment.slice(1)), id = params.get('tayar_supabase_handoff');
    const scope = JSON.parse(pending ?? 'null'); assertScope(input.scope);
    if (params.size !== 1 || !id || !uuid.test(id) || !scope
      || scope.ownerId !== input.scope.ownerId || scope.projectId !== input.scope.projectId
      || !['preview', 'production'].includes(scope.environment)) throw new Error();
    return { id, ownerId: scope.ownerId, projectId: scope.projectId, environment: scope.environment,
      loadSequence: input.scope.loadSequence };
  } catch { return null; }
}

function assertHandoff(scope: SupabaseBrowserScope, handoff: SupabaseHandoff) {
  if (handoff.ownerId !== scope.ownerId || handoff.projectId !== scope.projectId
    || handoff.loadSequence !== scope.loadSequence || !uuid.test(handoff.id)) throw new Error('Project or account changed.');
}
export async function listWebsiteSupabaseChoices(input: { scope: SupabaseBrowserScope;
  transport: WebsiteConnectionBrowserTransport; handoff: SupabaseHandoff }) {
  assertHandoff(input.scope, input.handoff);
  const data = await request({ scope: input.scope, transport: input.transport, action: 'options',
    body: { handoffId: input.handoff.id } });
  if (!data || !providerId.test(String(data.accountUserId)) || !Array.isArray(data.projects)
    || data.projects.length > 500) throw new Error('Supabase projects are unavailable.');
  const projects = (data.projects as unknown[]).map(item => {
    const row = item as Record<string, unknown>;
    if (!row || !ref.test(String(row.projectRef)) || !providerId.test(String(row.organizationId))
      || !slug.test(String(row.organizationSlug)) || typeof row.projectName !== 'string'
      || !row.projectName.trim() || row.projectName.length > 200 || typeof row.organizationName !== 'string'
      || !row.organizationName.trim() || row.organizationName.length > 200) throw new Error('Supabase projects are unavailable.');
    return { projectRef: String(row.projectRef), projectName: row.projectName.trim(),
      organizationId: String(row.organizationId), organizationSlug: String(row.organizationSlug),
      organizationName: row.organizationName.trim() };
  });
  return { accountUserId: String(data.accountUserId), projects };
}

export async function selectWebsiteSupabaseProject(input: { scope: SupabaseBrowserScope;
  transport: WebsiteConnectionBrowserTransport; handoff: SupabaseHandoff; choice: SupabaseProjectChoice;
  accountUserId: string; connectionId?: string; expectedVersion?: number }) {
  assertHandoff(input.scope, input.handoff);
  if (!providerId.test(input.accountUserId) || !ref.test(input.choice.projectRef)
    || !providerId.test(input.choice.organizationId) || !slug.test(input.choice.organizationSlug)
    || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion < 1))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)) throw new Error('Project or account changed.');
  const data = await request({ scope: input.scope, transport: input.transport, action: 'bind', body: {
    handoffId: input.handoff.id, connectionId: input.connectionId, expectedVersion: input.expectedVersion,
    projectRef: input.choice.projectRef, organizationId: input.choice.organizationId,
    organizationSlug: input.choice.organizationSlug, accountUserId: input.accountUserId,
  } });
  if (data?.status !== 'connected' || !uuid.test(data.connectionId) || data.projectRef !== input.choice.projectRef
    || !Number.isSafeInteger(data.version) || data.version !== (input.expectedVersion ?? 0) + 1)
    throw new Error('Supabase project binding could not be verified.');
  return { connectionId: data.connectionId as string, version: data.version as number };
}
