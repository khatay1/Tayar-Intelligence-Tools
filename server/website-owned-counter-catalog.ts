import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { applicationCounterFunctionManifest } from '../src/modules/website-builder/core/application-counter-sql';
type Row = Record<string, unknown>;
type Query = (query: string) => Promise<unknown>;
const functionsSql = `select n.nspname as schema_name, p.proname as function_name, pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result, l.lanname as language, p.prokind as kind, p.prosecdef as security_definer,
  p.provolatile as volatility, p.prosrc as source, p.proconfig as configuration, r.rolname as owner_name,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang join pg_roles r on r.oid=p.proowner
where n.nspname in ('private','public') and (p.proname = 'app_counter_write_guard' or left(p.proname,19) = 'app_adjust_counter_')`;
const tablesSql = `select t.relname as name, t.relkind as kind, t.relrowsecurity as rls,
  has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_all,
  has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_all,
  has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE') as anon_columns,
  has_any_column_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE') as authenticated_columns,
  (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text)) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields,
  (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid=t.oid and c.contype='p') as primary_key
from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='private' and t.relname in ('app_counter_requests','app_counter_context')`;
const guardsSql = `select t.relname as name, g.tgenabled as enabled, g.tgtype as type, g.tgargs as arguments,
  pn.nspname as function_schema, p.proname as function_name, pg_get_constraintdef(c.oid) as bounds, c.convalidated as validated,
  (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text)) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields
from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_trigger g on g.tgrelid=t.oid
join pg_proc p on p.oid=g.tgfoid join pg_namespace pn on pn.oid=p.pronamespace
left join pg_constraint c on c.conrelid=t.oid and left(c.conname,19)='app_counter_bounds_'
where n.nspname='public' and g.tgname='app_counter_guard' and not g.tgisinternal`;
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const numeric = (value: number) => Number.isInteger(value)
  ? value >= -2147483648 && value <= 2147483647 ? `(${value})::numeric` : `(${literal(String(value))}::bigint)::numeric`
  : value.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });

/** Counter RPCs are privileged, so exact bodies, grants, ledger uniqueness and
 * write guards are mandatory. Revision JSON alone is never a counter proof. */
export async function verifyOwnedCounterCatalog(input: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const app = readApplicationDefinition(input), counters = app.tables.filter(table => table.counter);
    if (!counters.length) return true;
    const [functions, tables, guards] = await Promise.all([query(functionsSql), query(tablesSql), query(guardsSql)]);
    const manifest = applicationCounterFunctionManifest(app);
    if (!Array.isArray(functions) || functions.length !== manifest.length || !Array.isArray(tables) || tables.length !== 2
      || !Array.isArray(guards) || guards.length !== counters.length) return false;
    const seen = new Set<string>();
    for (const row of functions as Row[]) {
      const key = `${row?.schema_name}.${row?.function_name}`, expected = manifest.find(item => `${item.schema}.${item.name}` === key);
      if (!expected || seen.has(key) || row.arguments !== expected.arguments || row.result !== expected.result || row.language !== expected.language
        || row.kind !== 'f' || row.security_definer !== expected.securityDefiner || row.volatility !== 'v' || row.source !== expected.source
        || row.owner_name !== 'postgres' || !Array.isArray(row.configuration) || row.configuration.length !== 1
        || !['search_path=', 'search_path=""'].includes(row.configuration[0]) || row.anon_execute !== false
        || row.authenticated_execute !== (expected.name !== 'app_counter_write_guard')) return false;
      seen.add(key);
    }
    const definitions: Record<string, Record<string, string>> = {
      app_counter_requests: { actor_id: 'uuid', request_id: 'uuid', table_name: 'text', record_id: 'uuid', delta: 'numeric' },
      app_counter_context: { transaction_id: 'bigint', actor_id: 'uuid', table_name: 'text', record_id: 'uuid', field_name: 'text', delta: 'numeric' },
    };
    const privateSeen = new Set<string>();
    for (const row of tables as Row[]) {
      const fields = definitions[String(row?.name)];
      if (!fields || privateSeen.has(String(row.name)) || row.kind !== 'r' || row.rls !== true || row.anon_all !== false || row.authenticated_all !== false
        || row.anon_columns !== false || row.authenticated_columns !== false || !object(row.fields) || Object.keys(row.fields).length !== Object.keys(fields).length
        || row.primary_key !== (row.name === 'app_counter_requests' ? 'PRIMARY KEY (actor_id, request_id)' : 'PRIMARY KEY (transaction_id)')) return false;
      for (const [key, type] of Object.entries(fields)) { const field = row.fields[key]; if (!object(field) || field.required !== true || field.type !== type) return false; }
      privateSeen.add(String(row.name));
    }
    for (const table of counters) {
      const rule = table.counter!, field = table.fields.find(field => field.id === rule.fieldId)!;
      const rows = (guards as Row[]).filter(row => row?.name === `app_${table.key}`);
      if (rows.length !== 1) return false;
      const row = rows[0], name = `"${field.key}"`;
      const expectedBounds = `CHECK (((${name} >= ${numeric(rule.minimum)})${rule.maximum === undefined ? '' : ` AND (${name} <= ${numeric(rule.maximum)})`}${rule.integer ? ` AND (${name} = trunc(${name}))` : ''} AND (${name} <> ALL (ARRAY['NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric]))))`;
      const bounds = typeof row.bounds === 'string' ? row.bounds.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|[a-z_][a-z0-9_]*/g,
        (token, offset, source) => token === field.key && !source.slice(offset + token.length).startsWith('(') && !source.slice(0, offset).endsWith('::') ? name : token) : '';
      const args = `\\x${BufferlessHex(`${field.key}\0${rule.minimum}\0`)}`;
      const actualField = object(row.fields) ? row.fields[field.key] : undefined;
      if (row.enabled !== 'O' || row.type !== 23 || row.function_schema !== 'private' || row.function_name !== 'app_counter_write_guard'
        || row.arguments !== args || row.validated !== true || bounds !== expectedBounds || !object(actualField) || actualField.required !== true || actualField.type !== 'numeric') return false;
    }
    return true;
  } catch { return false; }
}
function BufferlessHex(value: string) { return Array.from(new TextEncoder().encode(value), byte => byte.toString(16).padStart(2, '0')).join(''); }
