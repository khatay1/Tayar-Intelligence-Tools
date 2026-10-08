import { verifyOwnedCounterCatalog } from './website-owned-counter-catalog';
import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { applicationBookingConstraintManifest, applicationRoleFunctionManifest, applicationSecurityPolicies } from '../src/modules/website-builder/core/application-schema-sql';

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

const ROLE_TABLE_SQL = `select c.relname as table_name, c.relkind as relation_kind, c.relrowsecurity as rls,
  pg_catalog.has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as anon_all,
  pg_catalog.has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') as authenticated_all,
  pg_catalog.has_any_column_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE') as anon_columns,
  pg_catalog.has_any_column_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE') as authenticated_columns
from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'private' and c.relname in ('app_user_roles', 'app_role_administrators')
order by c.relname`;

const ROLE_FUNCTION_SQL = `select n.nspname as schema_name, p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
  pg_catalog.pg_get_function_result(p.oid) as result,
  l.lanname as language, p.prokind as kind, p.prosecdef as security_definer,
  p.provolatile as volatility, p.prosrc as source, p.proconfig as configuration,
  r.rolname as owner_name,
  pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') as anon_execute,
  pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') as authenticated_execute,
  pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') as service_execute
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid = p.pronamespace
join pg_catalog.pg_language l on l.oid = p.prolang
join pg_catalog.pg_roles r on r.oid = p.proowner
where n.nspname in ('private', 'public') and p.proname in
  ('app_has_role', 'app_bootstrap_role_admin', 'app_is_role_admin_impl', 'app_is_role_admin',
   'app_my_roles_impl', 'app_my_roles', 'app_set_user_role_impl', 'app_set_user_role')
order by n.nspname, p.proname`;

const ROLE_SCHEMA_SQL = `select pg_catalog.has_schema_privilege('anon', n.oid, 'USAGE') as anon_usage,
  pg_catalog.has_schema_privilege('authenticated', n.oid, 'USAGE') as authenticated_usage
from pg_catalog.pg_namespace n where n.nspname = 'private'`;

const BOOKING_SQL = `select t.relname as table_name, c.conname as name, c.contype as type,
  c.convalidated as validated, c.condeferrable as deferrable,
  pg_catalog.pg_get_constraintdef(c.oid) as definition,
  case when c.contype = 'x' then i.indisvalid and i.indisready else true end as index_valid,
  (select jsonb_object_agg(a.attname, jsonb_build_object('required', a.attnotnull, 'type', a.atttypid::regtype::text))
    from pg_catalog.pg_attribute a where a.attrelid = t.oid and a.attnum > 0 and not a.attisdropped) as fields
from pg_catalog.pg_constraint c join pg_catalog.pg_class t on t.oid = c.conrelid
join pg_catalog.pg_namespace n on n.oid = t.relnamespace
left join pg_catalog.pg_index i on i.indexrelid = c.conindid
where n.nspname = 'public' and pg_catalog.left(c.conname, 12) = 'app_booking_'`;
const bookingLiteral = (value: string) => `'${value.replace(/'/g, "''")}'::text`;
// PostgreSQL quotes SQL keyword identifiers. Quote those same names here rather
// than deleting quoted/literal bytes from a security expression.
const bookingIdentifier = (value: string) => `"${value}"`;
export async function verifyOwnedSupabaseBookingConstraints(definition: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const rules = applicationBookingConstraintManifest(definition);
    if (!rules.length) return true;
    const rows = await query(BOOKING_SQL);
    if (!Array.isArray(rows) || rows.length !== rules.length * 2) return false;
    for (const rule of rules) {
      const start = bookingIdentifier(rule.start), end = bookingIdentifier(rule.end);
      const interval = `CHECK ((isfinite(${start}) AND isfinite(${end}) AND (${start} < ${end})))`;
      const predicate = !rule.status ? '' : rule.blockingStatuses!.length === 1
        ? ` WHERE ((${bookingIdentifier(rule.status)} = ${bookingLiteral(rule.blockingStatuses![0])}))`
        : ` WHERE ((${bookingIdentifier(rule.status)} = ANY (ARRAY[${rule.blockingStatuses!.map(bookingLiteral).join(', ')}])))`;
      const overlap = `EXCLUDE USING gist (${bookingIdentifier(rule.resource)} WITH =, tstzrange(${start}, ${end}, '[)'::text) WITH &&)${predicate}`;
      for (const [name, type, expected] of [[rule.intervalName, 'c', interval], [rule.overlapName, 'x', overlap]]) {
        const matches = rows.filter((row: Row) => row?.table_name === rule.table && row.name === name);
        if (matches.length !== 1) return false;
        const row = matches[0] as Row;
        if (row.type !== type || row.validated !== true || row.deferrable !== false || row.index_valid !== true
          || typeof row.definition !== 'string' || !row.fields || typeof row.fields !== 'object') return false;
        // Quote bare identifiers with a SQL-aware scanner; literals stay byte exact.
        const actual = row.definition.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|[a-z_][a-z0-9_]*/g, (token, offset, source) =>
          [rule.resource, rule.start, rule.end, rule.status].includes(token) && !source.slice(offset + token.length).startsWith('(')
            && !source.slice(0, offset).endsWith('::') && !source.slice(0, offset).endsWith('USING ') ? bookingIdentifier(token) : token);
        if (actual !== expected) return false;
        const fields = row.fields as Record<string, { required?: unknown; type?: unknown }>;
        for (const [field, fieldType] of [[rule.resource, 'uuid'], [rule.start, 'timestamp with time zone'], [rule.end, 'timestamp with time zone'], ...(rule.status ? [[rule.status, 'text']] : [])]) {
          if (fields[field]?.required !== true || fields[field]?.type !== fieldType) return false;
        }
      }
    }
    return true;
  } catch { return false; }
}

// Keep quoted literal bytes and case intact; even whitespace inside a SQL
// literal can change access semantics. Only trim transport padding.
const compact = (expression: string) => expression.trim();

async function verifyRoleInfrastructure(query: Query): Promise<boolean> {
  const [schemaRows, tableRows, functionRows] = await Promise.all([
    query(ROLE_SCHEMA_SQL), query(ROLE_TABLE_SQL), query(ROLE_FUNCTION_SQL),
  ]);
  if (!Array.isArray(schemaRows) || schemaRows.length !== 1 || schemaRows[0]?.anon_usage !== false
    || schemaRows[0]?.authenticated_usage !== true || !Array.isArray(tableRows)
    || tableRows.length !== 2 || !Array.isArray(functionRows)) return false;
  const expectedTables = new Set(['app_user_roles', 'app_role_administrators']);
  for (const row of tableRows as Row[]) {
    if (!expectedTables.delete(row?.table_name as string) || row.relation_kind !== 'r'
      || row.rls !== true || row.anon_all !== false || row.authenticated_all !== false
      || row.anon_columns !== false || row.authenticated_columns !== false) return false;
  }
  const expectedFunctions = applicationRoleFunctionManifest();
  if (functionRows.length !== expectedFunctions.length) return false;
  const seen = new Set<string>();
  for (const row of functionRows as Row[]) {
    const key = `${row?.schema_name}.${row?.function_name}`;
    const expected = expectedFunctions.find(item => `${item.schema}.${item.name}` === key);
    if (!expected || seen.has(key) || row.arguments !== expected.arguments
      || String(row.result).toLowerCase() !== expected.result || row.language !== expected.language
      || row.kind !== 'f' || row.security_definer !== expected.securityDefiner
      || row.volatility !== (expected.stable ? 's' : 'v') || row.source !== expected.source
      || row.owner_name !== 'postgres' || !Array.isArray(row.configuration)
      || row.configuration.length !== 1 || row.configuration[0] !== 'search_path='
      || row.anon_execute !== false
      || row.authenticated_execute !== (expected.name !== 'app_bootstrap_role_admin')
      || (expected.name === 'app_bootstrap_role_admin' && row.service_execute !== true)) return false;
    seen.add(key);
  }
  return seen.size === expectedFunctions.length;
}

/** Fail closed if any generated table, privilege or policy differs. This
 * conservative text equality can require review after PostgreSQL rewrites a
 * valid expression; it never treats names alone as proof of policy semantics. */
export async function verifyOwnedSupabaseCatalogSecurity(definition: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const app = readApplicationDefinition(definition);
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
    return seenTables.size === tables.size && seenPolicies.size === expectedPolicies.length
      && (!app.roles.length || await verifyRoleInfrastructure(query))
      && await verifyOwnedSupabaseBookingConstraints(app, query)
      && await verifyOwnedCounterCatalog(app, query);
  } catch { return false; }
}
