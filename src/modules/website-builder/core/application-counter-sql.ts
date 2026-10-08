import type { ApplicationDefinition } from './application-model';
import { readApplicationDefinition } from './application-validation';
const quoted = (value: string) => `"${value}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const user = "((select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true)";

export function applicationCounterInfrastructure(): string[] {
  return [
    'grant usage on schema private to authenticated;',
    'create table if not exists private.app_counter_requests (actor_id uuid not null, request_id uuid not null, table_name text not null, record_id uuid not null, delta numeric not null, primary key(actor_id, request_id));',
    'alter table private.app_counter_requests enable row level security;',
    'revoke all on private.app_counter_requests from public, anon, authenticated;',
    'create table if not exists private.app_counter_context (transaction_id bigint primary key, actor_id uuid not null, table_name text not null, record_id uuid not null, field_name text not null, delta numeric not null);',
    'alter table private.app_counter_context enable row level security;',
    'revoke all on private.app_counter_context from public, anon, authenticated;',
    `create or replace function private.app_counter_write_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_value numeric; new_value numeric;
begin
  new_value := (to_jsonb(new)->>TG_ARGV[0])::numeric;
  if TG_OP = 'INSERT' then
    if new_value is distinct from TG_ARGV[1]::numeric then raise exception 'Counter records start at their configured minimum'; end if;
    return new;
  end if;
  old_value := (to_jsonb(old)->>TG_ARGV[0])::numeric;
  if new_value is not distinct from old_value then return new; end if;
  if not exists (select 1 from private.app_counter_context where transaction_id = txid_current()
    and actor_id = (select auth.uid()) and table_name = TG_TABLE_NAME and record_id = new.id
    and field_name = TG_ARGV[0] and delta = new_value - old_value) then
    raise exception 'Counter changes require an atomic adjustment';
  end if;
  return new;
end $$;`,
    'revoke all on function private.app_counter_write_guard() from public, anon, authenticated;',
  ];
}

export function compileApplicationCounterSchema(input: ApplicationDefinition, index: number, existing = false): string[] {
  const app = readApplicationDefinition(input), table = app.tables[index];
  if (!table?.counter) return [];
  const rule = table.counter, field = table.fields.find(field => field.id === rule.fieldId)!;
  const name = `public.${quoted(`app_${table.key}`)}`, column = quoted(field.key);
  const constraints = `${column} >= ${rule.minimum}${rule.maximum === undefined ? '' : ` and ${column} <= ${rule.maximum}`}${rule.integer ? ` and ${column} = trunc(${column})` : ''} and ${column} not in ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)`;
  const access = (operation: 'read' | 'update') => table.permissions.filter(rule => rule.operation === operation).map(rule =>
    rule.access === 'public' ? 'true' : rule.access === 'owner' ? `(${user} and owner_id = (select auth.uid()))`
      : rule.access === 'role' ? `(${user} and (select private.app_has_role(${literal(rule.roleId!)})))` : user).join(' or ');
  const inner = `app_adjust_counter_${index}`, wrapper = inner;
  const statements = [
    `alter table ${name} add constraint ${quoted(`app_counter_bounds_${index}`)} check (${constraints});`,
    `create trigger app_counter_guard before insert or update on ${name} for each row execute function private.app_counter_write_guard(${literal(field.key)}, ${literal(String(rule.minimum))});`,
    `create function private.${inner}(record_id uuid, adjustment numeric, request_id uuid) returns text language plpgsql security definer set search_path = '' as $$
<<counter_operation>>
declare actor uuid := (select auth.uid()); balance numeric; changed numeric; claimed uuid; existing private.app_counter_requests%rowtype;
begin
  if not ${user} or record_id is null or request_id is null or adjustment is null or adjustment = 0
    or adjustment not between -1000000000000 and 1000000000000${rule.integer ? ' or adjustment <> trunc(adjustment)' : ''} then
    raise exception 'Counter operation unavailable';
  end if;
  select t.${column} into balance from ${name} t where t.id = ${inner}.record_id and (${access('read')}) and (${access('update')}) for update;
  if not found then raise exception 'Counter operation unavailable'; end if;
  insert into private.app_counter_requests(actor_id, request_id, table_name, record_id, delta)
    values (counter_operation.actor, ${inner}.request_id, ${literal(`app_${table.key}`)}, ${inner}.record_id, ${inner}.adjustment)
    on conflict on constraint app_counter_requests_pkey do nothing returning app_counter_requests.request_id into claimed;
  if claimed is null then
    select * into strict existing from private.app_counter_requests r where r.actor_id = actor and r.request_id = app_adjust_counter_${index}.request_id;
    if existing.table_name <> ${literal(`app_${table.key}`)} or existing.record_id <> ${inner}.record_id or existing.delta <> ${inner}.adjustment then
      raise exception 'Counter request identity mismatch';
    end if;
    return 'already-adjusted';
  end if;
  changed := balance + adjustment;
  if changed < ${rule.minimum}${rule.maximum === undefined ? '' : ` or changed > ${rule.maximum}`} then raise exception 'Counter adjustment exceeds allowed bounds'; end if;
  insert into private.app_counter_context(transaction_id, actor_id, table_name, record_id, field_name, delta)
    values (txid_current(), counter_operation.actor, ${literal(`app_${table.key}`)}, ${inner}.record_id, ${literal(field.key)}, ${inner}.adjustment);
  update ${name} t set ${column} = counter_operation.changed where t.id = ${inner}.record_id;
  delete from private.app_counter_context where transaction_id = txid_current();
  return 'adjusted';
end $$;`,
    `revoke all on function private.${inner}(uuid,numeric,uuid) from public, anon;`,
    `grant execute on function private.${inner}(uuid,numeric,uuid) to authenticated;`,
    `create function public.${wrapper}(record_id uuid, adjustment numeric, request_id uuid) returns text language sql security invoker set search_path = '' as $$
  select private.${inner}(record_id, adjustment, request_id)
$$;`,
    `revoke all on function public.${wrapper}(uuid,numeric,uuid) from public, anon;`,
    `grant execute on function public.${wrapper}(uuid,numeric,uuid) to authenticated;`,
  ];
  return existing ? statements.slice(2).map(statement => statement.replace('create function ', 'create or replace function ')) : statements;
}

export function applicationCounterFunctionManifest(input: ApplicationDefinition) {
  const app = readApplicationDefinition(input);
  if (!app.tables.some(table => table.counter)) return [];
  const statements = [...applicationCounterInfrastructure(), ...app.tables.flatMap((_, index) => compileApplicationCounterSchema(app, index))];
  return statements.filter(statement => /^create (?:or replace )?function /.test(statement)).map(statement => {
    const match = /^create (?:or replace )?function (private|public)\.(app_[a-z_0-9]+)\(([^)]*)\) returns (text|trigger) language (sql|plpgsql) security (definer|invoker) set search_path = '' as \$\$([\s\S]*)\$\$;$/.exec(statement);
    if (!match) throw new Error('Counter function manifest is unavailable.');
    return { schema: match[1], name: match[2], arguments: match[3].replace(/,\s*/g, ', '), result: match[4], language: match[5], securityDefiner: match[6] === 'definer', source: match[7] };
  });
}
