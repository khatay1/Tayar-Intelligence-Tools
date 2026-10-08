import type { ApplicationDefinition, ApplicationField, ApplicationPermission, ApplicationTable } from './application-model';
import { readApplicationDefinition } from './application-validation';

const quoted = (value: string) => `"${value}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const permanentUser = "((select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true)";
const type = (field: ApplicationField) => ({ text: 'text', number: 'numeric', boolean: 'boolean', date: 'date', datetime: 'timestamptz', uuid: 'uuid', json: 'jsonb', enum: 'text', reference: 'uuid' })[field.type];
const defaultSql = (field: ApplicationField) => field.defaultValue === undefined || field.defaultValue === null ? 'null'
  : typeof field.defaultValue === 'string' ? literal(field.defaultValue) : String(field.defaultValue);

function access(rule: ApplicationPermission, alias?: string) {
  const owner = alias ? `${alias}.owner_id` : '(select auth.uid())';
  if (rule.access === 'public') return 'true';
  if (rule.access === 'authenticated') return permanentUser;
  if (rule.access === 'owner') return `(${permanentUser} and ${owner} = (select auth.uid()))`;
  return `(${permanentUser} and (select private.app_has_role(${literal(rule.roleId!)})))`;
}
const permission = (table: ApplicationTable, operation: 'read' | 'create' | 'update', alias?: string) =>
  `(${table.permissions.filter(rule => rule.operation === operation).map(rule => access(rule, alias)).join(' or ') || 'false'})`;

function fieldShape(field: ApplicationField) {
  const value = `attrs->${literal(field.key)}`, text = `attrs->>${literal(field.key)}`;
  const required = field.required && field.defaultValue === undefined ? `not (attrs ? ${literal(field.key)}) or jsonb_typeof(${value}) = 'null' or ` : '';
  const expected = field.type === 'number' ? `'number'` : field.type === 'boolean' ? `'boolean'`
    : field.type === 'json' ? 'jsonb_typeof(' + value + ')' : `'string'`;
  const mismatch = field.type === 'json' ? 'false' : `jsonb_typeof(${value}) <> ${expected}`;
  const length = ['text', 'enum'].includes(field.type) ? ` or length(${text}) > 20000` : '';
  return `${required}((attrs ? ${literal(field.key)}) and jsonb_typeof(${value}) <> 'null' and (${mismatch}${length}))`;
}

function fieldValue(field: ApplicationField) {
  const value = field.type === 'json' ? `attrs->${literal(field.key)}` : `attrs->>${literal(field.key)}`;
  const cast = field.type === 'text' || field.type === 'enum' ? value : `(${value})::${type(field)}`;
  return `case when attrs ? ${literal(field.key)} then ${cast} else ${defaultSql(field)} end`;
}

export function applicationTransactionInfrastructure(): string[] {
  return [
    'grant usage on schema private to authenticated;',
    'create table if not exists private.app_transaction_requests (actor_id uuid not null, request_id uuid not null, table_name text not null, record_id uuid not null, attributes jsonb not null, items jsonb not null, primary key(actor_id, request_id));',
    'alter table private.app_transaction_requests enable row level security;',
    'revoke all on private.app_transaction_requests from public, anon, authenticated;',
  ];
}

export function compileApplicationTransactionSchema(input: ApplicationDefinition, index: number, existing = false): string[] {
  const app = readApplicationDefinition(input), table = app.tables[index], rule = table?.transaction;
  if (!table || !rule) return [];
  const itemIndex = app.tables.findIndex(candidate => candidate.id === rule.itemTableId), item = app.tables[itemIndex];
  const lineIndex = app.tables.findIndex(candidate => candidate.id === rule.lineTableId), lineTable = app.tables[lineIndex];
  const counter = item.counter!, counterField = item.fields.find(field => field.id === counter.fieldId)!;
  const parentField = lineTable.fields.find(field => field.id === rule.lineTransactionFieldId)!;
  const itemField = lineTable.fields.find(field => field.id === rule.lineItemFieldId)!;
  const quantityField = lineTable.fields.find(field => field.id === rule.lineQuantityFieldId)!;
  const parentName = `public.${quoted(`app_${table.key}`)}`, itemName = `public.${quoted(`app_${item.key}`)}`, lineName = `public.${quoted(`app_${lineTable.key}`)}`;
  const inner = `app_create_transaction_${index}`;
  const allowed = table.fields.length ? `array[${table.fields.map(field => literal(field.key)).join(',')}]::text[]` : 'array[]::text[]';
  const columns = table.fields.map(field => quoted(field.key));
  const values = table.fields.map(fieldValue);
  const parentInsert = `insert into ${parentName}(id, owner_id, _tayar_request_id${columns.length ? `, ${columns.join(', ')}` : ''}) values (parent_id, actor, ${inner}.request_id${values.length ? `, ${values.join(', ')}` : ''});`;
  const delta = rule.counterDirection === 'decrement' ? '-entry.quantity' : 'entry.quantity';
  const bound = `changed < ${counter.minimum}${counter.maximum === undefined ? '' : ` or changed > ${counter.maximum}`}`;
  const shapeChecks = table.fields.map(fieldShape).join(' or ') || 'false';
  const candidateInteger = counter.integer ? ' or candidate.quantity <> trunc(candidate.quantity)' : '';
  const lineConstraint = `alter table ${lineName} add constraint ${quoted(`app_transaction_quantity_${index}`)} check (${quoted(quantityField.key)} > 0 and ${quoted(quantityField.key)} <= 1000000000000 and ${quoted(quantityField.key)} not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)${counter.integer ? ` and ${quoted(quantityField.key)} = trunc(${quoted(quantityField.key)})` : ''});`;
  const body = `
<<transaction_operation>>
declare actor uuid := (select auth.uid()); parent_id uuid := gen_random_uuid(); normalized jsonb; item_count integer; unique_count integer;
  claimed uuid; prior private.app_transaction_requests%rowtype; entry record; balance numeric; changed numeric;
begin
  if not ${permanentUser} or ${inner}.request_id is null or jsonb_typeof(attrs) <> 'object' or jsonb_typeof(lines) <> 'array'
    or jsonb_array_length(lines) < 1 or jsonb_array_length(lines) > 100 or attrs - ${allowed} <> '{}'::jsonb
    or ${shapeChecks} or not ${permission(table, 'create')} then raise exception 'Application transaction unavailable'; end if;
  if exists (select 1 from jsonb_array_elements(lines) value where jsonb_typeof(value) <> 'object'
    or value - array['itemId','quantity']::text[] <> '{}'::jsonb or jsonb_typeof(value->'itemId') <> 'string'
    or (value->>'itemId') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or jsonb_typeof(value->'quantity') <> 'number') then raise exception 'Application transaction unavailable'; end if;
  select jsonb_agg(jsonb_build_object('itemId', item_id, 'quantity', quantity) order by item_id), count(*), count(distinct item_id)
    into normalized, item_count, unique_count from (select (value->>'itemId')::uuid item_id, (value->>'quantity')::numeric quantity from jsonb_array_elements(lines) value) parsed;
  if item_count <> unique_count or exists (select 1 from jsonb_to_recordset(normalized) as candidate("itemId" uuid, quantity numeric)
    where candidate.quantity <= 0 or candidate.quantity > 1000000000000 or candidate.quantity in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)${candidateInteger})
    then raise exception 'Application transaction unavailable'; end if;
  insert into private.app_transaction_requests(actor_id,request_id,table_name,record_id,attributes,items)
    values (actor,${inner}.request_id,${literal(`app_${table.key}`)},parent_id,attrs,normalized)
    on conflict on constraint app_transaction_requests_pkey do nothing returning request_id into claimed;
  if claimed is null then
    select * into strict prior from private.app_transaction_requests r where r.actor_id=actor and r.request_id=${inner}.request_id;
    if prior.table_name <> ${literal(`app_${table.key}`)} or prior.attributes <> attrs or prior.items <> normalized then raise exception 'Application transaction request identity mismatch'; end if;
    return jsonb_build_object('status','already-created','id',prior.record_id);
  end if;
  for entry in select * from jsonb_to_recordset(normalized) as value("itemId" uuid, quantity numeric) order by "itemId" loop
    select t.${quoted(counterField.key)} into balance from ${itemName} t where t.id=entry."itemId" and ${permission(item, 'read', 't')} and ${permission(item, 'update', 't')} for update;
    if not found then raise exception 'Application transaction unavailable'; end if;
    changed := balance + (${delta});
    if ${bound} then raise exception 'Application transaction exceeds allowed bounds'; end if;
    insert into private.app_counter_context(transaction_id,actor_id,table_name,record_id,field_name,delta)
      values (txid_current(),actor,${literal(`app_${item.key}`)},entry."itemId",${literal(counterField.key)},${delta});
    update ${itemName} t set ${quoted(counterField.key)}=transaction_operation.changed where t.id=entry."itemId";
    delete from private.app_counter_context where transaction_id=txid_current();
  end loop;
  ${parentInsert}
  for entry in select * from jsonb_to_recordset(normalized) as value("itemId" uuid, quantity numeric) order by "itemId" loop
    insert into ${lineName}(owner_id,${quoted(parentField.key)},${quoted(itemField.key)},${quoted(quantityField.key)}) values (actor,parent_id,entry."itemId",entry.quantity);
  end loop;
  return jsonb_build_object('status','created','id',parent_id);
end `;
  const statements = [lineConstraint,
    `create function private.${inner}(attrs jsonb, lines jsonb, request_id uuid) returns jsonb language plpgsql security definer set search_path = '' as $$${body}$$;`,
    `revoke all on function private.${inner}(jsonb,jsonb,uuid) from public, anon;`,
    `grant execute on function private.${inner}(jsonb,jsonb,uuid) to authenticated;`,
    `create function public.${inner}(attrs jsonb, lines jsonb, request_id uuid) returns jsonb language sql security invoker set search_path = '' as $$\n  select private.${inner}(attrs, lines, request_id)\n$$;`,
    `revoke all on function public.${inner}(jsonb,jsonb,uuid) from public, anon;`,
    `grant execute on function public.${inner}(jsonb,jsonb,uuid) to authenticated;`,
  ];
  return existing ? statements.slice(1).map(statement => statement.replace('create function ', 'create or replace function ')) : statements;
}

export function applicationTransactionFunctionManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  if (!app.tables.some(table => table.transaction)) return [];
  const statements = app.tables.flatMap((_, index) => compileApplicationTransactionSchema(app, index));
  return statements.filter(statement => statement.startsWith('create function ')).map(statement => {
    const match = /^create function (private|public)\.(app_create_transaction_[0-9]+)\(([^)]*)\) returns (jsonb) language (sql|plpgsql) security (definer|invoker) set search_path = '' as \$\$([\s\S]*)\$\$;$/.exec(statement);
    if (!match) throw new Error('Transaction function manifest is unavailable.');
    return { schema: match[1], name: match[2], arguments: match[3].replace(/,\s*/g, ', '), result: match[4], language: match[5], securityDefiner: match[6] === 'definer', source: match[7] };
  });
}
