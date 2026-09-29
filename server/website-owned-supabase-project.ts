import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { createOwnedSupabaseReadOnlyQuery, verifyOwnedSupabaseCatalogSecurity } from './website-owned-supabase-catalog';

/** Server-only Supabase Management API ownership proof. The caller supplies a
 * request-local OAuth grant, and checks the private Tayar connection version
 * again after this async read. No token or profile email enters project source. */
export async function verifyOwnedSupabaseProject(input: {
  projectRef: string; organizationId: string; organizationSlug: string;
  accountUserId: string; accessToken: string; platformOrganizationId: string;
  fetcher?: typeof fetch;
}): Promise<boolean> {
  if (typeof window !== 'undefined' || !/^[a-z]{20}$/.test(input.projectRef)
    || !/^[a-z0-9][a-z0-9-]*$/.test(input.organizationSlug)
    || !input.organizationId || !input.accountUserId || !input.platformOrganizationId
    || input.organizationId === input.platformOrganizationId
    || !input.accessToken || /[\r\n]/.test(input.accessToken)) return false;
  const fetcher = input.fetcher ?? fetch;
  const headers = { Authorization: `Bearer ${input.accessToken}` };
  async function get(path: string): Promise<Record<string, unknown> | Record<string, unknown>[]> {
    const response = await fetcher(`https://api.supabase.com/v1/${path}`, {
      method: 'GET', headers, redirect: 'error', cache: 'no-store',
    });
    if (response.status !== 200) throw new Error();
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') throw new Error();
    return data as Record<string, unknown>;
  }
  try {
    const profile = await get('profile');
    if (Array.isArray(profile) || profile.gotrue_id !== input.accountUserId) return false;
    const project = await get(`projects/${input.projectRef}`);
    if (Array.isArray(project) || project.ref !== input.projectRef
      || project.organization_id !== input.organizationId
      || project.organization_slug !== input.organizationSlug
      || project.status !== 'ACTIVE_HEALTHY') return false;
    const members = await get(`organizations/${input.organizationSlug}/members`);
    if (!Array.isArray(members) || members.filter(member => member && member.user_id === input.accountUserId
      && member.role_name === 'Owner').length !== 1) return false;
    // A second read catches a project transfer or account switch during proof.
    const latest = await get(`projects/${input.projectRef}`);
    return !Array.isArray(latest) && latest.ref === input.projectRef
      && latest.organization_id === input.organizationId
      && latest.organization_slug === input.organizationSlug
      && latest.status === 'ACTIVE_HEALTHY';
  } catch { return false; }
}

/** Supply this callback to the mandatory preflight reader only after the
 * private connection and customer OAuth identity were checked. The callback
 * rechecks both before and after its catalog read to reject account switches. */
export function createOwnedSupabaseLiveSecurityVerifier(input: Parameters<typeof verifyOwnedSupabaseProject>[0] & {
  isCurrent: () => Promise<boolean>;
}): (definition: ApplicationDefinition) => Promise<boolean> {
  const query = createOwnedSupabaseReadOnlyQuery(input);
  return async definition => {
    try {
      return await input.isCurrent()
        && await verifyOwnedSupabaseProject(input)
        && await verifyOwnedSupabaseCatalogSecurity(definition, query)
        && await verifyOwnedSupabaseProject(input)
        && await input.isCurrent();
    } catch { return false; }
  };
}
