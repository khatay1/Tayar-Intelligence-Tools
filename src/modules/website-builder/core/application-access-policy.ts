import type { ApplicationDefinition } from './application-model';

/** Pure page access policy shared by browser route checks and acceptance tests.
 * This models the generated application policy; it does not authenticate users
 * or prove that a server-side route, session or database is configured. */
export function canAccessApplicationPage(
  definition: ApplicationDefinition,
  pageId: string,
  user: { is_anonymous?: boolean } | null,
  roles: readonly string[] = [],
): boolean {
  const rule = definition.pageAccess.find(item => item.pageId === pageId);
  if (!rule || rule.access === 'public') return true;
  if (!definition.auth.enabled || !user || user.is_anonymous) return false;
  return rule.access === 'authenticated' || (rule.access === 'role' && !!rule.roleId && roles.includes(rule.roleId));
}
