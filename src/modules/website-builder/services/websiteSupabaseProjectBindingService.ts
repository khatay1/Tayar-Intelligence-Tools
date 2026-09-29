import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeWebsiteConnectionHandoff, peekWebsiteConnectionHandoff } from './websiteConnectionHandoffService';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ref = /^[a-z]{20}$/;
const slug = /^[a-z0-9][a-z0-9-]{0,199}$/;
const token = (value: unknown): value is string => typeof value === 'string' && value.length >= 20
  && new TextEncoder().encode(value).length <= 4096 && !/[\r\n]/.test(value);

type Grant = { accessToken: string; refreshToken: string; expiresIn: number; receivedAt: string };
export type SupabaseProjectChoice = { projectRef: string; projectName: string;
  organizationId: string; organizationSlug: string; organizationName: string };

export function encodeSupabaseOAuthHandoff(grant: Grant): string {
  if (!token(grant.accessToken) || !token(grant.refreshToken)
    || !Number.isInteger(grant.expiresIn) || grant.expiresIn < 60 || grant.expiresIn > 86_400
    || !Number.isFinite(Date.parse(grant.receivedAt))) throw new Error('Supabase authorization is unavailable.');
  return JSON.stringify(grant);
}
function decodeGrant(value: string): Grant {
  let grant: Partial<Grant>;
  try { grant = JSON.parse(value); } catch { throw new Error('Supabase authorization is unavailable.'); }
  if (!token(grant.accessToken) || !token(grant.refreshToken)
    || !Number.isInteger(grant.expiresIn) || grant.expiresIn! < 60 || grant.expiresIn! > 86_400
    || !Number.isFinite(Date.parse(grant.receivedAt!))
    || Date.parse(grant.receivedAt!) + grant.expiresIn! * 1000 <= Date.now()) {
    throw new Error('Supabase authorization is unavailable.');
  }
  return grant as Grant;
}
async function api(accessToken: string, path: string, fetcher: typeof fetch): Promise<unknown> {
  const response = await fetcher(`https://api.supabase.com/v1/${path}`, {
    method: 'GET', redirect: 'error', cache: 'no-store',
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  });
  if (response.status !== 200 || Number(response.headers.get('content-length') ?? 0) > 65_536) throw new Error();
  const text = await response.text();
  if (text.length > 65_536) throw new Error();
  return JSON.parse(text);
}

/** Returns sanitized user-owned targets. Tayar's own organization is excluded,
 * and every returned organization requires one exact Owner membership. */
export async function listWebsiteSupabaseProjectChoices(input: {
  client: Pick<SupabaseClient, 'rpc'>; ownerId: string; projectId: string; handoffId: string;
  platformOrganizationId: string; isCurrentOwner(): boolean; fetcher?: typeof fetch;
}): Promise<{ accountUserId: string; projects: SupabaseProjectChoice[] }> {
  if (typeof window !== 'undefined' || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !uuid.test(input.handoffId) || !input.platformOrganizationId || !input.isCurrentOwner()) {
    throw new Error('Supabase projects are unavailable.');
  }
  try {
    const handoff = await peekWebsiteConnectionHandoff({ client: input.client, id: input.handoffId,
      ownerId: input.ownerId, projectId: input.projectId, provider: 'supabase',
      isCurrentOwner: input.isCurrentOwner });
    const grant = decodeGrant(handoff.userToken), fetcher = input.fetcher ?? fetch;
    const [profile, organizations, projects] = await Promise.all([
      api(grant.accessToken, 'profile', fetcher), api(grant.accessToken, 'organizations', fetcher),
      api(grant.accessToken, 'projects', fetcher),
    ]);
    if (!profile || typeof profile !== 'object' || Array.isArray(profile)
      || typeof (profile as Record<string, unknown>).gotrue_id !== 'string'
      || !Array.isArray(organizations) || organizations.length > 100
      || !Array.isArray(projects) || projects.length > 500) throw new Error();
    const accountUserId = (profile as Record<string, unknown>).gotrue_id as string;
    const owned = new Map<string, { id: string; slug: string; name: string }>();
    for (const raw of organizations) {
      if (!raw || typeof raw !== 'object') throw new Error();
      const org = raw as Record<string, unknown>;
      if (typeof org.id !== 'string' || !org.id || org.id === input.platformOrganizationId
        || typeof org.slug !== 'string' || !slug.test(org.slug)
        || typeof org.name !== 'string' || !org.name.trim() || org.name.length > 200) continue;
      const members = await api(grant.accessToken, `organizations/${org.slug}/members`, fetcher);
      if (!Array.isArray(members) || members.length > 1000) throw new Error();
      if (members.filter(member => member && typeof member === 'object'
        && (member as Record<string, unknown>).user_id === accountUserId
        && (member as Record<string, unknown>).role_name === 'Owner').length === 1) {
        owned.set(org.id, { id: org.id, slug: org.slug, name: org.name.trim() });
      }
    }
    const choices: SupabaseProjectChoice[] = [];
    for (const raw of projects) {
      if (!raw || typeof raw !== 'object') throw new Error();
      const project = raw as Record<string, unknown>, org = owned.get(String(project.organization_id));
      if (!org || typeof project.ref !== 'string' || !ref.test(project.ref)
        || typeof project.name !== 'string' || !project.name.trim() || project.name.length > 200
        || project.status !== 'ACTIVE_HEALTHY') continue;
      choices.push({ projectRef: project.ref, projectName: project.name.trim(),
        organizationId: org.id, organizationSlug: org.slug, organizationName: org.name });
    }
    if (!input.isCurrentOwner()) throw new Error();
    choices.sort((a, b) => a.organizationName.localeCompare(b.organizationName)
      || a.projectName.localeCompare(b.projectName) || a.projectRef.localeCompare(b.projectRef));
    return { accountUserId, projects: choices };
  } catch { throw new Error('Supabase projects are unavailable.'); }
}

/** Consumes the handoff only when binding. The RPC writes connection metadata
 * and encrypted setup custody in one transaction; status remains connected. */
export async function bindWebsiteSupabaseProject(input: {
  client: Pick<SupabaseClient, 'rpc'>; ownerId: string; projectId: string; handoffId: string;
  connectionId?: string; expectedVersion?: number; projectRef: string;
  organizationId: string; organizationSlug: string; accountUserId: string;
  platformOrganizationId: string; isCurrentOwner(): boolean; fetcher?: typeof fetch;
}): Promise<{ connectionId: string; projectRef: string; version: number }> {
  if (typeof window !== 'undefined' || !uuid.test(input.ownerId) || !uuid.test(input.projectId)
    || !uuid.test(input.handoffId) || (input.connectionId !== undefined && !uuid.test(input.connectionId))
    || Boolean(input.connectionId) !== Boolean(input.expectedVersion)
    || (input.expectedVersion !== undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion! < 1))
    || !ref.test(input.projectRef) || !slug.test(input.organizationSlug)
    || !input.organizationId || input.organizationId === input.platformOrganizationId || !input.isCurrentOwner()) {
    throw new Error('Supabase project could not be connected.');
  }
  const connectionId = input.connectionId ?? input.handoffId, expectedVersion = input.expectedVersion ?? 0;
  const reconcile = async () => {
    const { data, error } = await input.client.rpc('website_reconcile_supabase_project_binding', {
      p_connection_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_version: expectedVersion, p_project_ref: input.projectRef, p_operation_id: input.handoffId,
    });
    if (error || !input.isCurrentOwner()) throw new Error();
    return data === expectedVersion + 1;
  };
  try {
    if (await reconcile()) return { connectionId, projectRef: input.projectRef, version: expectedVersion + 1 };
    const handoff = await consumeWebsiteConnectionHandoff({ client: input.client, id: input.handoffId,
      ownerId: input.ownerId, projectId: input.projectId, provider: 'supabase',
      isCurrentOwner: input.isCurrentOwner });
    const grant = decodeGrant(handoff.userToken);
    const choices = await listDirect(grant.accessToken, input, input.fetcher ?? fetch);
    if (!choices) throw new Error();
    const accessExpiresAt = new Date(Date.parse(grant.receivedAt) + grant.expiresIn * 1000).toISOString();
    const { data, error } = await input.client.rpc('website_bind_supabase_project', {
      p_connection_id: connectionId, p_project_id: input.projectId, p_owner_id: input.ownerId,
      p_expected_version: expectedVersion, p_environment: handoff.environment,
      p_account_id: input.accountUserId, p_organization_id: input.organizationId,
      p_organization_slug: input.organizationSlug, p_project_ref: input.projectRef,
      p_access_token: grant.accessToken, p_refresh_token: grant.refreshToken,
      p_access_expires_at: accessExpiresAt,
      p_custody_expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      p_operation_id: input.handoffId,
    });
    if (error || data !== expectedVersion + 1 || !input.isCurrentOwner()) {
      if (await reconcile()) return { connectionId, projectRef: input.projectRef, version: expectedVersion + 1 };
      throw new Error();
    }
    return { connectionId, projectRef: input.projectRef, version: data };
  } catch { throw new Error('Supabase project could not be connected.'); }
}

async function listDirect(accessToken: string, input: {
  projectRef: string; organizationId: string; organizationSlug: string; accountUserId: string;
  platformOrganizationId: string; isCurrentOwner(): boolean;
}, fetcher: typeof fetch): Promise<boolean> {
  if (!input.isCurrentOwner()) return false;
  const [profile, project, members] = await Promise.all([
    api(accessToken, 'profile', fetcher), api(accessToken, `projects/${input.projectRef}`, fetcher),
    api(accessToken, `organizations/${input.organizationSlug}/members`, fetcher),
  ]);
  return input.isCurrentOwner() && !!profile && typeof profile === 'object' && !Array.isArray(profile)
    && (profile as Record<string, unknown>).gotrue_id === input.accountUserId
    && !!project && typeof project === 'object' && !Array.isArray(project)
    && (project as Record<string, unknown>).ref === input.projectRef
    && (project as Record<string, unknown>).organization_id === input.organizationId
    && (project as Record<string, unknown>).organization_slug === input.organizationSlug
    && (project as Record<string, unknown>).status === 'ACTIVE_HEALTHY'
    && input.organizationId !== input.platformOrganizationId && Array.isArray(members)
    && members.filter(member => member && typeof member === 'object'
      && (member as Record<string, unknown>).user_id === input.accountUserId
      && (member as Record<string, unknown>).role_name === 'Owner').length === 1;
}
