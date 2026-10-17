import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

/** Function bodies, grants and the level's counter/reservation guards are
 * verified by the shared stock gate. This proves private, immutable receipts. */
export async function verifyOwnedStockTransfersCatalog(
  app: ApplicationDefinition, tableId: string, query: (sql: string) => Promise<unknown>,
): Promise<boolean> {
  const index = app.tables.findIndex(table => table.id === tableId);
  const table = app.tables[index];
  if (!table?.stockLocations) return true;
  try {
    const name = 'app_stock_transfers_' + index;
    const [rows, constraints] = await Promise.all([
      query(`select t.relkind as kind,t.relrowsecurity as rls,
        has_table_privilege('anon',t.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_all,
        has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE') as authenticated_all,
        has_any_column_privilege('anon',t.oid,'SELECT,INSERT,UPDATE') as anon_columns,
        has_any_column_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE') as authenticated_columns,
        (select jsonb_object_agg(a.attname,jsonb_build_object('required',a.attnotnull,'type',a.atttypid::regtype::text))
          from pg_attribute a where a.attrelid=t.oid and a.attnum>0 and not a.attisdropped) as fields
        from pg_class t join pg_namespace n on n.oid=t.relnamespace where n.nspname='private' and t.relname='${name}'`),
      query(`select c.contype as type,pg_get_constraintdef(c.oid) as definition,c.convalidated as validated,c.condeferrable as deferrable,
        case when c.contype='p' then i.indisvalid and i.indisready and i.indimmediate else true end as valid
        from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
        left join pg_index i on i.indexrelid=c.conindid where n.nspname='private' and t.relname='${name}'`),
    ]);
    if (!Array.isArray(rows) || rows.length !== 1 || !object(rows[0])) return false;
    const row = rows[0];
    if (row.kind !== 'r' || row.rls !== true || !['anon_all','authenticated_all','anon_columns','authenticated_columns'].every(key=>row[key] === false)
      || !object(row.fields) || Object.keys(row.fields).length !== 5) return false;
    for (const [key,type] of Object.entries({actor_id:'uuid',request_id:'uuid',source_id:'uuid',destination_id:'uuid',quantity:'numeric'})) {
      const field = row.fields[key];
      if (!object(field) || field.type !== type || field.required !== true) return false;
    }
    if (!Array.isArray(constraints) || constraints.length !== 5 || constraints.some(c=>!object(c) || c.validated !== true || c.deferrable !== false || c.valid !== true)) return false;
    const expected = [
      ['p','PRIMARY KEY (actor_id, request_id)'],
      ['f',`FOREIGN KEY (source_id) REFERENCES app_${table.key}(id) ON DELETE RESTRICT`],
      ['f',`FOREIGN KEY (destination_id) REFERENCES app_${table.key}(id) ON DELETE RESTRICT`],
      ['c',"CHECK (((quantity > (0)::numeric) AND (quantity <= ('1000000000000'::bigint)::numeric) AND (quantity = trunc(quantity))))"],
      ['c','CHECK ((source_id <> destination_id))'],
    ];
    return expected.every(([type,definition])=>constraints.filter(c=>c.type === type && c.definition === definition).length === 1);
  } catch { return false; }
}
