import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { compileApplicationInventoryReservationSchema } from '../src/modules/website-builder/core/application-inventory-reservation-sql';

type Row = Record<string, unknown>;
type Query = (sql: string) => Promise<unknown>;
const object = (x: unknown): x is Row => !!x && typeof x === 'object' && !Array.isArray(x);
const literal = (x: string) => "'" + x.replace(/'/g, "''") + "'";

/** SQL bodies are security boundaries: metadata labels alone do not establish
 * that deployed customer-stock code is authorized, isolated, or unchanged. */
export async function verifyOwnedStockReservationCatalog(
  input: ApplicationDefinition, itemTableId: string, query: Query,
): Promise<boolean> {
  try {
    const index = input.tables.findIndex(table => table.id === itemTableId);
    if (index < 0) return false;
    const compiled = compileApplicationInventoryReservationSchema(input, itemTableId).join('\n');
    const manifest = new Map<string, { args: string; result: string; lang: string; definer: boolean; source: string }>();
    const expression = /create function (private|public)\.(app_stock_[a-z0-9_]+)\(([^)]*)\) returns (text|numeric|trigger) language (plpgsql|sql) security (definer|invoker) set search_path = '' as \$(stock_[a-z]+)\$([\s\S]*?)\$\7\$;/g;
    for (const match of compiled.matchAll(expression)) {
      const key = match[1] + '.' + match[2];
      if (manifest.has(key)) return false;
      manifest.set(key, { args: match[3], result: match[4], lang: match[5], definer: match[6] === 'definer', source: match[8] });
    }
    if (manifest.size !== 7) return false;
    const names = ['app_stock_reserve_' + index, 'app_stock_finalize_' + index,
      'app_stock_available_' + index, 'app_stock_floor_' + index];
    const conditions = "p.proname in (" + names.map(literal).join(',') + ")";
    const functionsSql = `select n.nspname as schema_name,p.proname as function_name,
      pg_get_function_identity_arguments(p.oid) as arguments,pg_get_function_result(p.oid) as result,
      l.lanname as language,p.prokind as kind,p.prosecdef as security_definer,p.provolatile as volatility,
      p.prosrc as source,p.proconfig as configuration,r.rolname as owner_name,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
      has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      join pg_language l on l.oid=p.prolang join pg_roles r on r.oid=p.proowner
      where n.nspname in ('public','private') and ${conditions}`;
    const ledger = 'app_stock_reservations_' + index;
    const tableSql = `select t.relkind as kind,t.relrowsecurity as rls,
      has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_all,
      has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_all,
      has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE') as anon_columns,
      has_any_column_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE') as authenticated_columns,
      (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text))
        from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields,
      (select pg_get_constraintdef(c.oid) from pg_constraint c where c.conrelid=t.oid and c.contype='p') as primary_key
      from pg_class t join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='private' and t.relname=${literal(ledger)}`;
    const triggerSql = `select g.tgenabled as enabled,g.tgtype as type,
      n.nspname as schema_name,p.proname as function_name,
      t.relname as item_table
      from pg_trigger g join pg_class t on t.oid=g.tgrelid
      join pg_namespace tn on tn.oid=t.relnamespace join pg_proc p on p.oid=g.tgfoid
      join pg_namespace n on n.oid=p.pronamespace
      where tn.nspname='public' and g.tgname=${literal('app_stock_reservation_floor_' + index)} and not g.tgisinternal`;
    const constraintSql = `select c.contype as type,pg_get_constraintdef(c.oid) as definition
      from pg_constraint c join pg_class t on t.oid=c.conrelid
      join pg_namespace n on n.oid=t.relnamespace
      where n.nspname='private' and t.relname=${literal(ledger)}`;
    const [functions, tables, triggers, constraints] = await Promise.all([
      query(functionsSql),query(tableSql),query(triggerSql),query(constraintSql),
    ]);
    if (!Array.isArray(functions) || functions.length !== manifest.size
      || !Array.isArray(tables) || tables.length !== 1
      || !Array.isArray(triggers) || triggers.length !== 1
      || !Array.isArray(constraints) || constraints.length !== 4) return false;
    const seen = new Set<string>();
    for (const item of functions) {
      if (!object(item)) return false;
      const key = item.schema_name + '.' + item.function_name;
      const expected = manifest.get(key);
      if (!expected || seen.has(key) || item.arguments !== expected.args
        || item.result !== expected.result || item.language !== expected.lang
        || item.kind !== 'f' || item.security_definer !== expected.definer
        || item.volatility !== 'v' || item.source !== expected.source
        || item.owner_name !== 'postgres' || !Array.isArray(item.configuration)
        || item.configuration.length !== 1
        || !['search_path=', 'search_path=""'].includes(item.configuration[0])
        || item.anon_execute !== false
        || item.authenticated_execute !== (item.function_name !== 'app_stock_floor_' + index)) return false;
      seen.add(key);
    }
    const table = tables[0] as Row;
    const fields = table.fields;
    const expectedFields: Record<string,string> = {
      actor_id:'uuid',reservation_id:'uuid',item_id:'uuid',location_id:'uuid',
      quantity:'numeric',status:'text',expires_at:'timestamp with time zone',
    };
    if (table.kind !== 'r' || table.rls !== true
      || table.anon_all !== false || table.authenticated_all !== false
      || table.anon_columns !== false || table.authenticated_columns !== false
      || table.primary_key !== 'PRIMARY KEY (actor_id, reservation_id)'
      || !object(fields) || Object.keys(fields).length !== Object.keys(expectedFields).length) return false;
    for (const [key,type] of Object.entries(expectedFields)) {
      const value = fields[key];
      if (!object(value) || value.type !== type || value.required !== true) return false;
    }
    const trigger = triggers[0] as Row;
    if (trigger.enabled !== 'O' || trigger.type !== 19
      || trigger.schema_name !== 'private' || trigger.function_name !== 'app_stock_floor_' + index
      || trigger.item_table !== 'app_' + input.tables[index].key) return false;
    const constraintsByType = new Map<string,string[]>();
    for (const row of constraints) {
      if (!object(row) || typeof row.type !== 'string' || typeof row.definition !== 'string') return false;
      constraintsByType.set(row.type,[...(constraintsByType.get(row.type) ?? []),row.definition]);
    }
    if ((constraintsByType.get('p')?.length ?? 0) !== 1 || (constraintsByType.get('f')?.length ?? 0) !== 1
      || (constraintsByType.get('c')?.length ?? 0) !== 2) return false;
    const checks = constraintsByType.get('c')!;
    // Match PostgreSQL's actual canonical constraint deparser, rather than
    // rewriting arbitrary parenthesized expressions (which can erase the
    // left-hand quantity comparison and hide dangerous predicate changes).
    const expectedQuantity = "CHECK (((quantity > (0)::numeric) AND (quantity <= ('1000000000000'::bigint)::numeric) AND (quantity = trunc(quantity))))";
    const expectedStatus = "CHECK ((status = ANY (ARRAY['reserved'::text, 'released'::text, 'fulfilled'::text, 'expired'::text])))";
    const foreign = constraintsByType.get('f')![0];
    if (!checks.includes(expectedQuantity) || !checks.includes(expectedStatus)
      || foreign !== `FOREIGN KEY (item_id) REFERENCES app_${input.tables[index].key}(id) ON DELETE RESTRICT`) return false;
    return true;
  } catch { return false; }
}
