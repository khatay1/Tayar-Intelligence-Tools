import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { applicationSecurityPolicies } from '../src/modules/website-builder/core/application-schema-sql';

type Row = Record<string, unknown>;
type Query = (sql: string) => Promise<unknown>;

// Management API database:read is sufficient; never use a customer service-role
// key or embed this customer OAuth grant in the generated application.
export function createOwnedSupabaseReadOnlyQuery(input: {
  projectRef: string; accessToken: string; fetcher?: typeof fetch;
}): Query {
  if (!/^[a-z]{20}$/.test(input.projectRef) || !input.accessToken || /[\r\n]/.test(input.accessToken)) {
    throw new Error('Customer Supabase catalog access is unavailable.');
  }
  const fetcher = input.fetcher ?? fetch;
  const url = `https://api.supabase.com/v1/projects/${input.projectRef}/database/query/read-only`;
  return async query => {
    try {
      const response = await fetcher(url, { method: 'POST', headers: {
        Authorization: `Bearer ${input.accessToken}`, 'Content-Type': 'application/json',
      }, body: JSON.stringify({ query }), redirect: 'error', cache: 'no-store' });
      if (response.status !== 201) throw new Error();
      return await response.json();
    } catch { throw new Error('Customer Supabase catalog read failed.'); }
  };
}

const CATALOG_SQL = `select c.relname as table_name, c.relkind as relation_kind, c.relrowsecurity as rls,
  pg_catalog.has_table_privilege('anon', c.oid, 'SELECT') as anon_read,
  pg_catalog.has_table_privilege('anon', c.oid, 'INSERT') as anon_create,
  pg_catalog.has_table_privilege('anon', c.oid, 'UPDATE') as anon_update,
  pg_catalog.has_table_privilege('anon', c.oid, 'DELETE') as anon_delete,
  pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT') as anon_column_read,
  pg_catalog.has_any_column_privilege('anon', c.oid, 'INSERT') as anon_column_create,
  pg_catalog.has_any_column_privilege('anon', c.oid, 'UPDATE') as anon_column_update,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_read,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'INSERT') as authenticated_create,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'UPDATE') as authenticated_update,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'DELETE') as authenticated_delete,
  pg_catalog.has_any_column_privilege('authenticated', c.oid, 'SELECT') as authenticated_column_read,
  pg_catalog.has_any_column_privilege('authenticated', c.oid, 'INSERT') as authenticated_column_create,
  pg_catalog.has_any_column_privilege('authenticated', c.oid, 'UPDATE') as authenticated_column_update,
  p.polname as policy_name, p.polcmd::text as command, p.polpermissive as permissive,
  case when p.oid is null then null else array(select r.rolname::text from pg_catalog.pg_roles r
    where r.oid = any(p.polroles) order by r.rolname) end as roles,
  pg_catalog.pg_get_expr(p.polqual, p.polrelid) as using_expression,
  pg_catalog.pg_get_expr(p.polwithcheck, p.polrelid) as check_expression
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
left join pg_catalog.pg_policy p on p.polrelid = c.oid
where n.nspname = 'public' and pg_catalog.left(c.relname, 4) = 'app_'
order by c.relname, p.polname`;

// Keep quoted literal bytes and case intact; even whitespace inside a SQL
// literal can change access semantics. Only trim transport padding.
const compact = (expression: string) => expression.trim();

/** Fail closed if any generated table, privilege or policy differs. This
 * conservative text equality can require review after PostgreSQL rewrites a
 * valid expression; it never treats names alone as proof of policy semantics. */
export async function verifyOwnedSupabaseCatalogSecurity(definition: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const app = readApplicationDefinition(definition);
    // Role administrator RPC bodies and private grants need separate live proof.
    if (app.roles.length) return false;
    const rows = await query(CATALOG_SQL);
    if (!Array.isArray(rows) || rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) return false;
    const expectedPolicies = applicationSecurityPolicies(app);
    const tables = new Map(app.tables.map(table => [`app_${table.key}`, table]));
    const seenTables = new Set<string>(), seenPolicies = new Set<string>();
    for (const row of rows as Row[]) {
      const name = row.table_name;
      if (typeof name !== 'string' || !tables.has(name) || row.relation_kind !== 'r' || row.rls !== true) return false;
      seenTables.add(name);
      const policies = expectedPolicies.filter(policy => policy.table === name);
      for (const audience of ['anon', 'authenticated'] as const) {
        for (const operation of ['read', 'create', 'update', 'delete'] as const) {
          const policy = policies.find(item => item.name.endsWith(`_${operation}`));
          const allowed = Boolean(policy?.roles.includes(audience));
          if (row[`${audience}_${operation}`] !== allowed || (operation !== 'delete'
            && row[`${audience}_column_${operation}`] !== allowed)) return false;
        }
      }
      if (row.policy_name === null) {
        if (policies.length) return false;
        continue;
      }
      const policy = policies.find(item => item.name === row.policy_name);
      if (!policy || seenPolicies.has(policy.name) || row.command !== policy.command || row.permissive !== true
        || !Array.isArray(row.roles) || row.roles.length !== policy.roles.length
        || [...row.roles].sort().join(',') !== [...policy.roles].sort().join(',')) return false;
      const expressions: Array<[unknown, string | null]> = [
        [row.using_expression, policy.using], [row.check_expression, policy.check],
      ];
      for (const [actual, expected] of expressions) {
        if (expected === null) {
          if (actual !== null) return false;
        } else if (typeof actual !== 'string' || compact(actual) !== compact(expected)) return false;
      }
      seenPolicies.add(policy.name);
    }
    return seenTables.size === tables.size && seenPolicies.size === expectedPolicies.length;
  } catch { return false; }
}
