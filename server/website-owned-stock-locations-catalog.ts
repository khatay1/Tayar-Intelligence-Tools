import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';

const literal = (value: string) => "'" + value.replace(/'/g, "''") + "'";
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Exact function bodies/privileges are checked by the shared stock verifier.
 * This checks the additional physical dimensions, trigger, unique constraint
 * and restrictive foreign keys in the same read-only catalog session. */
export async function verifyOwnedStockLocationsCatalog(
  input: ApplicationDefinition, itemTableId: string, query: (sql: string) => Promise<unknown>,
): Promise<boolean> {
  const index = input.tables.findIndex(table => table.id === itemTableId);
  const table = input.tables[index], rule = table?.stockLocations;
  if (!rule) return true;
  try {
    const fields = [rule.itemFieldId, rule.locationFieldId].map(id => table.fields.find(field => field.id === id)!);
    const target = 'public.' + '"app_' + table.key + '"';
    const [columns, constraints, triggers] = await Promise.all([
      query(`select a.attname as name,a.attnotnull as required,a.atttypid::regtype::text as type
        from pg_attribute a where a.attrelid=${literal(target)}::regclass
        and a.attname in (${fields.map(field=>literal(field.key)).join(',')}) and a.attnum>0 and not a.attisdropped`),
      query(`select c.contype as type,c.convalidated as validated,c.condeferrable as deferrable,
        array(select a.attname from unnest(c.conkey) with ordinality k(id,n)
          join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.id order by k.n) as columns,
        c.confrelid::regclass::text as target,c.confdeltype as delete_action,c.confupdtype as update_action,
        array(select a.attname from unnest(c.confkey) with ordinality k(id,n)
          join pg_attribute a on a.attrelid=c.confrelid and a.attnum=k.id order by k.n) as target_columns,
        i.indisunique as unique,i.indisvalid as valid,i.indisready as ready,i.indimmediate as immediate,
        i.indpred is null as unfiltered,i.indexprs is null as plain,i.indnkeyatts as key_count
        from pg_constraint c left join pg_index i on i.indexrelid=c.conindid
        where c.conrelid=${literal(target)}::regclass and (c.conname=${literal('app_stock_location_unique_' + index)}
          or c.conname in (${['app_stock_item_owner_' + index, 'app_stock_location_owner_' + index].map(literal).join(',')}))`),
      query(`select g.tgtype as type,g.tgenabled as enabled,g.tgnargs as arguments,
        g.tgqual is null as unconditional,g.tgattr::text as columns,n.nspname as schema,p.proname as function
        from pg_trigger g join pg_proc p on p.oid=g.tgfoid join pg_namespace n on n.oid=p.pronamespace
        where g.tgrelid=${literal(target)}::regclass and not g.tgisinternal
          and g.tgname=${literal('app_stock_location_guard_' + index)}`),
    ]);
    if (!Array.isArray(columns) || columns.length !== 2 || columns.some(row=>!object(row)
      || row.required !== true || row.type !== 'uuid' || !fields.some(field=>field.key === row.name))) return false;
    if (!Array.isArray(triggers) || triggers.length !== 1 || !object(triggers[0])) return false;
    const trigger = triggers[0];
    if (trigger.type !== 23 || trigger.enabled !== 'O' || trigger.arguments !== 0 || trigger.unconditional !== true
      || trigger.columns !== '' || trigger.schema !== 'private' || trigger.function !== 'app_stock_location_guard_' + index) return false;
    if (!Array.isArray(constraints) || constraints.length !== 3 || constraints.some(row=>!object(row)
      || row.validated !== true || row.deferrable !== false)) return false;
    const unique = constraints.filter(row=>row.type === 'u');
    if (unique.length !== 1 || JSON.stringify(unique[0].columns) !== JSON.stringify(['owner_id',...fields.map(field=>field.key)])
      || !['unique','valid','ready','immediate','unfiltered','plain'].every(key=>unique[0][key] === true)
      || unique[0].key_count !== 3) return false;
    return fields.every(field=>constraints.some(row=>row.type === 'f'
      && JSON.stringify(row.columns) === JSON.stringify([field.key,'owner_id'])
      && row.target === 'app_' + input.tables.find(t=>t.id === field.referenceTableId)!.key
      && JSON.stringify(row.target_columns) === '["id","owner_id"]' && row.delete_action === 'r' && row.update_action === 'a'
      && ['unique','valid','ready','immediate','unfiltered','plain'].every(key=>row[key] === true) && row.key_count === 2));
  } catch { return false; }
}
