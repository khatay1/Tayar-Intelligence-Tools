import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';
import { applicationTransactionFunctionManifest } from '../src/modules/website-builder/core/application-transaction-sql';
type Row = Record<string, unknown>;
type Query = (query: string) => Promise<unknown>;
const functionsSql = `select n.nspname as schema_name,p.proname as function_name,pg_get_function_identity_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result,l.lanname as language,p.prokind as kind,p.prosecdef as security_definer,p.provolatile as volatility,
  p.prosrc as source,p.proconfig as configuration,r.rolname as owner_name,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang join pg_roles r on r.oid=p.proowner
where n.nspname in ('private','public') and left(p.proname,23)='app_create_transaction_'`;
const ledgerSql = `select t.relkind as kind,t.relrowsecurity as rls,
  has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_all,
  has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_all,
  has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE') as anon_columns,
  has_any_column_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE') as authenticated_columns,
  (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text)) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields,
  (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid=t.oid and c.contype='p') as primary_key
from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='private' and t.relname='app_transaction_requests'`;
const constraintsSql = `select t.relname as table_name,c.conname as name,c.convalidated as validated,pg_get_constraintdef(c.oid) as definition,
  (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text)) from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields
from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
where n.nspname='public' and left(c.conname,25)='app_transaction_quantity_'`;
const object = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);

/** Multi-row RPCs bypass RLS only after explicit in-body authorization. Their
 * exact bodies, private receipt ledger and quantity constraints are required. */
export async function verifyOwnedTransactionCatalog(input: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const app = readApplicationDefinition(input), transactions = app.tables.filter(table => table.transaction);
    if (!transactions.length) return true;
    const [functions, ledgers, constraints] = await Promise.all([query(functionsSql), query(ledgerSql), query(constraintsSql)]);
    const manifest = applicationTransactionFunctionManifest(app);
    if (!Array.isArray(functions) || functions.length !== manifest.length || !Array.isArray(ledgers) || ledgers.length !== 1
      || !Array.isArray(constraints) || constraints.length !== transactions.length) return false;
    const seen = new Set<string>();
    for (const row of functions as Row[]) {
      const key = `${row.schema_name}.${row.function_name}`, expected = manifest.find(item => `${item.schema}.${item.name}` === key);
      if (!expected || seen.has(key) || row.arguments !== expected.arguments || row.result !== expected.result || row.language !== expected.language
        || row.kind !== 'f' || row.security_definer !== expected.securityDefiner || row.volatility !== 'v' || row.source !== expected.source
        || row.owner_name !== 'postgres' || !Array.isArray(row.configuration) || row.configuration.length !== 1
        || !['search_path=', 'search_path=""'].includes(row.configuration[0]) || row.anon_execute !== false || row.authenticated_execute !== true) return false;
      seen.add(key);
    }
    const ledger = ledgers[0] as Row, expectedFields: Record<string, string> = { actor_id: 'uuid', request_id: 'uuid', table_name: 'text', record_id: 'uuid', attributes: 'jsonb', items: 'jsonb' };
    if (ledger.kind !== 'r' || ledger.rls !== true || ledger.anon_all !== false || ledger.authenticated_all !== false || ledger.anon_columns !== false
      || ledger.authenticated_columns !== false || ledger.primary_key !== 'PRIMARY KEY (actor_id, request_id)' || !object(ledger.fields)
      || Object.keys(ledger.fields).length !== Object.keys(expectedFields).length) return false;
    for (const [key, type] of Object.entries(expectedFields)) { const field = ledger.fields[key]; if (!object(field) || field.required !== true || field.type !== type) return false; }
    for (const [index, table] of app.tables.entries()) {
      if (!table.transaction) continue;
      const line = app.tables.find(candidate => candidate.id === table.transaction!.lineTableId)!;
      const quantity = line.fields.find(field => field.id === table.transaction!.lineQuantityFieldId)!;
      const item = app.tables.find(candidate => candidate.id === table.transaction!.itemTableId)!;
      const rows = (constraints as Row[]).filter(row => row.table_name === `app_${line.key}` && row.name === `app_transaction_quantity_${index}`);
      if (rows.length !== 1 || rows[0].validated !== true || !object(rows[0].fields)) return false;
      const field = rows[0].fields[quantity.key];
      if (!object(field) || field.required !== true || field.type !== 'numeric' || typeof rows[0].definition !== 'string') return false;
      const definition = rows[0].definition as string;
      // PostgreSQL may deparse the same numeric literal through an intermediate
      // bigint cast. Compare a cast/format-neutral form while retaining every
      // required bound and non-finite guard.
      const normalized = definition.replace(/::(?:bigint|numeric)/g, '').replace(/["'()\s]/g, '');
      if (!normalized.includes(`${quantity.key}>0`) || !normalized.includes(`${quantity.key}<=1000000000000`)
        || !normalized.includes('NaN') || !normalized.includes('Infinity') || !normalized.includes('-Infinity')
        || (item.counter!.integer && !normalized.includes(`trunc${quantity.key}`))) return false;
    }
    return seen.size === manifest.length;
  } catch { return false; }
}
