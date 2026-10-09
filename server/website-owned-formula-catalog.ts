import type { ApplicationDefinition } from '../src/modules/website-builder/core/application-model';
import { readApplicationDefinition } from '../src/modules/website-builder/core/application-validation';

type Query = (sql: string) => Promise<unknown>;
type Row = Record<string, unknown>;
const SQL = `select t.relname as table_name,a.attname as column_name,a.attgenerated as generated,
  a.attnotnull as required,a.atttypid::regtype::text as type,pg_catalog.pg_get_expr(d.adbin,d.adrelid) as expression
from pg_catalog.pg_attribute a join pg_catalog.pg_class t on t.oid=a.attrelid
join pg_catalog.pg_namespace n on n.oid=t.relnamespace
join pg_catalog.pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
where n.nspname='public' and pg_catalog.left(t.relname,4)='app_' and a.attgenerated<>''
order by t.relname,a.attname`;
const compact = (value: string) => value.replace(/["()\s]/g, '');

/** A saved definition cannot prove that a generated expression was not
 * changed later. Compare every actual stored expression with its formula. */
export async function verifyOwnedFormulaCatalog(input: ApplicationDefinition, query: Query): Promise<boolean> {
  try {
    const app = readApplicationDefinition(input);
    const expected = app.tables.flatMap(table => table.fields.flatMap(field => {
      if (!field.formula) return [];
      const operator = { sum: '+', subtract: '-', multiply: '*' }[field.formula.operation];
      return [{ table: `app_${table.key}`, column: field.key, expression: field.formula.fieldIds
        .map(id => table.fields.find(source => source.id === id)!.key).join(operator) }];
    }));
    const rows = await query(SQL);
    if (!Array.isArray(rows) || rows.length !== expected.length) return false;
    const seen = new Set<string>();
    for (const value of rows) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
      const row = value as Row, key = `${row.table_name}.${row.column_name}`;
      const item = expected.find(candidate => `${candidate.table}.${candidate.column}` === key);
      if (!item || seen.has(key) || row.generated !== 's' || row.required !== true || row.type !== 'numeric'
        || typeof row.expression !== 'string' || compact(row.expression) !== item.expression) return false;
      seen.add(key);
    }
    return seen.size === expected.length;
  } catch { return false; }
}
