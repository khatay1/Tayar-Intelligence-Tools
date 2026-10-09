import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { applicationWorkflowFunctionManifest } from '../src/modules/website-builder/core/application-workflow-sql';

type Row = Record<string, unknown>;
type Query = (sql: string) => Promise<unknown>;
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const functionsSql = `select n.nspname as schema_name,p.proname as function_name,pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result,l.lanname as language,p.prokind as kind,p.prosecdef as security_definer,p.provolatile as volatility,
  p.prosrc as source,p.proconfig as configuration,r.rolname as owner_name,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang join pg_roles r on r.oid=p.proowner
where n.nspname in ('private','public') and (p.proname='app_workflow_write_guard' or left(p.proname,24)='app_transition_workflow_')`;
const tablesSql = `select t.relname as name,t.relkind as kind,t.relrowsecurity as rls,
  has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_all,
  has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_all,
  has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE') as anon_columns,
  has_any_column_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE') as authenticated_columns,
  (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text)) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields,
  (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid=t.oid and c.contype='p') as primary_key
from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='private' and t.relname in ('app_workflow_requests','app_workflow_context')`;
const guardsSql = `select t.relname as name,g.tgenabled as enabled,g.tgtype as type,g.tgargs as arguments,
 pn.nspname as function_schema,p.proname as function_name
from pg_class t join pg_namespace n on n.oid=t.relnamespace join pg_trigger g on g.tgrelid=t.oid
join pg_proc p on p.oid=g.tgfoid join pg_namespace pn on pn.oid=p.pronamespace
where n.nspname='public' and g.tgname='app_workflow_guard' and not g.tgisinternal`;

/** Revision metadata does not prove a privileged workflow function is safe. */
export async function verifyOwnedWorkflowCatalog(input: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const app = readApplicationDefinition(input), workflows = app.tables.filter(table => table.workflow);
    if (!workflows.length) return true;
    const [functions, tables, guards] = await Promise.all([query(functionsSql), query(tablesSql), query(guardsSql)]);
    const manifest = applicationWorkflowFunctionManifest(app);
    if (!Array.isArray(functions) || functions.length !== manifest.length || !Array.isArray(tables) || tables.length !== 2
      || !Array.isArray(guards) || guards.length !== workflows.length) return false;
    const seen = new Set<string>();
    for (const row of functions) {
      if (!object(row)) return false;
      const key = `${row.schema_name}.${row.function_name}`, expected = manifest.find(item => `${item.schema}.${item.name}` === key);
      if (!expected || seen.has(key) || row.arguments !== expected.arguments || row.result !== expected.result || row.language !== expected.language
        || row.kind !== 'f' || row.security_definer !== expected.securityDefiner || row.volatility !== 'v' || row.source !== expected.source
        || row.owner_name !== 'postgres' || !Array.isArray(row.configuration) || row.configuration.length !== 1
        || !['search_path=', 'search_path=""'].includes(row.configuration[0]) || row.anon_execute !== false
        || row.authenticated_execute !== (expected.schema === 'public')) return false;
      seen.add(key);
    }
    const definitions: Record<string, Record<string, string>> = {
      app_workflow_requests: { actor_id: 'uuid', request_id: 'uuid', table_name: 'text', record_id: 'uuid', transition_id: 'text', from_state: 'text', to_state: 'text' },
      app_workflow_context: { transaction_id: 'bigint', actor_id: 'uuid', table_name: 'text', record_id: 'uuid', field_name: 'text', from_state: 'text', to_state: 'text' },
    };
    const privateSeen = new Set<string>();
    for (const row of tables) {
      if (!object(row)) return false;
      const fields = definitions[String(row.name)];
      if (!fields || privateSeen.has(String(row.name)) || row.kind !== 'r' || row.rls !== true || row.anon_all !== false || row.authenticated_all !== false
        || row.anon_columns !== false || row.authenticated_columns !== false || !object(row.fields) || Object.keys(row.fields).length !== Object.keys(fields).length
        || row.primary_key !== (row.name === 'app_workflow_requests' ? 'PRIMARY KEY (actor_id, request_id)' : 'PRIMARY KEY (transaction_id)')) return false;
      for (const [key, type] of Object.entries(fields)) { const field = row.fields[key]; if (!object(field) || field.required !== true || field.type !== type) return false; }
      privateSeen.add(String(row.name));
    }
    for (const table of workflows) {
      const field = table.fields.find(item => item.id === table.workflow!.fieldId)!;
      const rows = guards.filter(row => object(row) && row.name === `app_${table.key}`);
      if (rows.length !== 1 || !object(rows[0])) return false;
      const row = rows[0];
      const hex = Array.from(new TextEncoder().encode(`${field.key}\0${field.defaultValue}\0`), byte => byte.toString(16).padStart(2, '0')).join('');
      if (row.enabled !== 'O' || row.type !== 23 || row.function_schema !== 'private' || row.function_name !== 'app_workflow_write_guard' || row.arguments !== `\\x${hex}`) return false;
    }
    return true;
  } catch { return false; }
}
