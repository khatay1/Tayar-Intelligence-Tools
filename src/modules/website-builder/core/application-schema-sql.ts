import type { ApplicationDefinition, ApplicationField, ApplicationPermission, ApplicationTable } from './application-model';
import { readApplicationDefinition } from './application-validation';

const sqlName = (value: string) => `"${value}"`;
const literal = (value: string) => `'${value.replace(/'/g, "''")}'`;
const tableName = (table: ApplicationTable) => `app_${table.key}`;
const fieldType = (field: ApplicationField) => ({
  text: 'text', number: 'numeric', boolean: 'boolean', date: 'date', datetime: 'timestamptz',
  uuid: 'uuid', json: 'jsonb', enum: 'text', reference: 'uuid',
})[field.type];
const operationSql = { read: 'SELECT', create: 'INSERT', update: 'UPDATE', delete: 'DELETE' } as const;
const permanentUser = "((select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true)";

function condition(rule: ApplicationPermission): string {
  switch (rule.access) {
    case 'public': return 'true';
    case 'authenticated': return permanentUser;
    case 'owner': return `(${permanentUser} and (select auth.uid()) = owner_id)`;
    case 'role': return `(${permanentUser} and (select private.app_has_role(${literal(rule.roleId!)})))`;
  }
}

function column(field: ApplicationField): string {
  const parts = [sqlName(field.key), fieldType(field)];
  if (field.required) parts.push('not null');
  if (field.defaultValue !== undefined && field.defaultValue !== null) {
    parts.push(`default ${typeof field.defaultValue === 'string' ? literal(field.defaultValue) : String(field.defaultValue)}`);
  }
  if (field.type === 'enum') parts.push(`check (${sqlName(field.key)} in (${field.options!.map(literal).join(', ')}))`);
  return parts.join(' ');
}

function fieldIndex(tableIndex: number, index: number, table: ApplicationTable, field: ApplicationField): string[] {
  const name = `public.${sqlName(tableName(table))}`;
  if (field.unique) return [`create unique index ${sqlName(`app_i_${tableIndex}_${index}_unique`)} on ${name} (${sqlName(field.key)});`];
  if (field.indexed || field.type === 'reference') return [`create index ${sqlName(`app_i_${tableIndex}_${index}`)} on ${name} (${sqlName(field.key)});`];
  return [];
}

function referenceConstraint(app: ApplicationDefinition, tableIndex: number, fieldIndex: number, field: ApplicationField): string {
  const table = app.tables[tableIndex];
  const target = app.tables.find(item => item.id === field.referenceTableId)!;
  return `alter table public.${sqlName(tableName(table))} add constraint ${sqlName(`app_fk_${tableIndex}_${fieldIndex}`)} foreign key (${sqlName(field.key)}) references public.${sqlName(tableName(target))}(id) on delete restrict;`;
}

function policies(table: ApplicationTable, tableIndex: number): string[] {
  const name = `public.${sqlName(tableName(table))}`;
  const statements: string[] = [];
  for (const operation of ['read', 'create', 'update', 'delete'] as const) {
    const rules = table.permissions.filter(rule => rule.operation === operation);
    if (!rules.length) continue;
    const verb = operationSql[operation];
    const audience = rules.some(rule => rule.access === 'public') ? 'anon, authenticated' : 'authenticated';
    const check = rules.map(condition).join(' or ');
    statements.push(`grant ${verb} on ${name} to ${audience};`);
    const policy = sqlName(`app_p_${tableIndex}_${operation}`);
    const options = operation === 'create' ? `with check ((${check}) and owner_id = (select auth.uid()))`
      : operation === 'update' ? `using (${check}) with check (${check})`
      : `using (${check})`;
    statements.push(`create policy ${policy} on ${name} for ${verb} to ${audience} ${options};`);
  }
  return statements;
}

function roleInfrastructure(): string[] {
  return [
    'grant usage on schema private to authenticated;',
    'create table private.app_user_roles (user_id uuid not null references auth.users(id) on delete cascade, role_id text not null, primary key (user_id, role_id));',
    'alter table private.app_user_roles enable row level security;',
    'revoke all on private.app_user_roles from public, anon, authenticated;',
    'create table private.app_role_administrators (user_id uuid primary key references auth.users(id) on delete cascade);',
    'alter table private.app_role_administrators enable row level security;',
    'revoke all on private.app_role_administrators from public, anon, authenticated;',
    `create function private.app_has_role(requested_role text) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true
    and exists (select 1 from private.app_user_roles where user_id = (select auth.uid()) and role_id = requested_role)
$$;`,
    'revoke all on function private.app_has_role(text) from public;',
    'grant execute on function private.app_has_role(text) to authenticated;',
    `create function public.app_bootstrap_role_admin(target_user uuid) returns void language plpgsql security definer set search_path = '' as $$
begin
  if target_user is null or not exists (select 1 from auth.users where id = target_user and is_anonymous is not true) then
    raise exception 'Valid permanent application user required';
  end if;
  insert into private.app_role_administrators(user_id) values (target_user) on conflict do nothing;
end $$;`,
    'revoke all on function public.app_bootstrap_role_admin(uuid) from public, anon, authenticated;',
    'grant execute on function public.app_bootstrap_role_admin(uuid) to service_role;',
    `create function private.app_is_role_admin_impl() returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true
    and exists (select 1 from private.app_role_administrators where user_id = (select auth.uid()))
$$;`,
    'revoke all on function private.app_is_role_admin_impl() from public;',
    'grant execute on function private.app_is_role_admin_impl() to authenticated;',
    `create function public.app_is_role_admin() returns boolean language sql stable security invoker set search_path = '' as $$
  select private.app_is_role_admin_impl()
$$;`,
    'revoke all on function public.app_is_role_admin() from public, anon;',
    'grant execute on function public.app_is_role_admin() to authenticated;',
    `create function private.app_my_roles_impl() returns setof text language sql stable security definer set search_path = '' as $$
  select r.role_id from private.app_user_roles r where r.user_id = (select auth.uid())
    and (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true
$$;`,
    'revoke all on function private.app_my_roles_impl() from public;',
    'grant execute on function private.app_my_roles_impl() to authenticated;',
    `create function public.app_my_roles() returns setof text language sql stable security invoker set search_path = '' as $$
  select * from private.app_my_roles_impl()
$$;`,
    'revoke all on function public.app_my_roles() from public, anon;',
    'grant execute on function public.app_my_roles() to authenticated;',
    `create function private.app_set_user_role_impl(target_user uuid, requested_role text, enabled boolean) returns void language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null or (((select auth.jwt())->>'is_anonymous')::boolean) is true
    or not exists (select 1 from private.app_role_administrators where user_id = (select auth.uid())) then
    raise exception 'Application role administration denied';
  end if;
  if target_user is null or not exists (select 1 from auth.users where id = target_user and is_anonymous is not true) then
    raise exception 'Valid permanent application user required';
  end if;
  if requested_role is null or not exists (
    select 1 from private.app_schema_revisions s, jsonb_array_elements(s.definition->'roles') as r(value)
    where s.id = true and r.value->>'id' = requested_role
  ) then raise exception 'Unknown application role'; end if;
  if enabled is null then raise exception 'Role state required'; end if;
  if enabled then
    insert into private.app_user_roles(user_id,role_id) values (target_user,requested_role) on conflict do nothing;
  else
    delete from private.app_user_roles where user_id = target_user and role_id = requested_role;
  end if;
end $$;`,
    'revoke all on function private.app_set_user_role_impl(uuid,text,boolean) from public;',
    'grant execute on function private.app_set_user_role_impl(uuid,text,boolean) to authenticated;',
    `create function public.app_set_user_role(target_user uuid, requested_role text, enabled boolean) returns void language sql security invoker set search_path = '' as $$
  select private.app_set_user_role_impl(target_user, requested_role, enabled)
$$;`,
    'revoke all on function public.app_set_user_role(uuid,text,boolean) from public, anon;',
    'grant execute on function public.app_set_user_role(uuid,text,boolean) to authenticated;',
  ];
}

/** A nullable request UUID leaves ordinary CRUD unchanged. Bound creates will
 * use it to prevent a second row when a browser loses the first response. */
function formRequestFunction(): string[] {
  return [`create or replace function public.app_guard_form_request() returns trigger language plpgsql set search_path = '' as $$
begin
  if new._tayar_request_id is distinct from old._tayar_request_id then
    raise exception 'Immutable application request identity';
  end if;
  return new;
end $$;`,
    `create or replace function private.app_record_form_request() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new._tayar_request_id is not null then
    insert into private.app_form_request_ledger(owner_id, table_name, request_id, record_id)
      values (new.owner_id, TG_TABLE_NAME, new._tayar_request_id, new.id);
  end if;
  return new;
end $$;`,
    'revoke all on function private.app_record_form_request() from public, anon, authenticated;'];
}

function formRequestLedger(): string[] {
  return [
    'create table private.app_form_request_ledger (owner_id uuid not null, table_name text not null, request_id uuid not null, record_id uuid not null, primary key (owner_id, table_name, request_id));',
    'alter table private.app_form_request_ledger enable row level security;',
    'revoke all on private.app_form_request_ledger from public, anon, authenticated;',
  ];
}

function formRequestCapability(): string[] {
  return [
    'create table private.app_runtime_capabilities (id boolean primary key default true check (id), form_request_version integer not null check (form_request_version in (1, 2)));',
    'revoke all on private.app_runtime_capabilities from public, anon, authenticated;',
    'insert into private.app_runtime_capabilities (id, form_request_version) values (true, 2);',
    `create or replace function private.app_form_request_revision() returns integer language sql stable security definer set search_path = '' as $$
  select form_request_version from private.app_runtime_capabilities where id = true
$$;`,
    'revoke all on function private.app_form_request_revision() from public, anon, authenticated;',
    'grant execute on function private.app_form_request_revision() to service_role;',
    `create or replace function public.app_form_request_revision() returns integer language sql stable security invoker set search_path = '' as $$
  select private.app_form_request_revision()
$$;`,
    'revoke all on function public.app_form_request_revision() from public, anon, authenticated;',
    'grant execute on function public.app_form_request_revision() to service_role;',
  ];
}

function formRequestIndex(tableIndex: number, table: ApplicationTable): string {
  return `create unique index ${sqlName(`app_i_${tableIndex}_request`)} on public.${sqlName(tableName(table))} (owner_id, _tayar_request_id) where _tayar_request_id is not null;`;
}

function formRequestTrigger(table: ApplicationTable): string {
  return `create trigger app_guard_form_request before update on public.${sqlName(tableName(table))} for each row execute function public.app_guard_form_request();`;
}

function formRequestLedgerTrigger(table: ApplicationTable): string {
  return `create trigger app_record_form_request after insert on public.${sqlName(tableName(table))} for each row execute function private.app_record_form_request();`;
}

function revisionReadInfrastructure(): string[] {
  return [
    'grant usage on schema private to service_role;',
    `create or replace function private.app_deployed_definition() returns jsonb language sql stable security definer set search_path = '' as $$
  select definition from private.app_schema_revisions where id = true
$$;`,
    'revoke all on function private.app_deployed_definition() from public, anon, authenticated;',
    'grant execute on function private.app_deployed_definition() to service_role;',
    `create or replace function public.app_deployed_definition() returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.app_deployed_definition()
$$;`,
    'revoke all on function public.app_deployed_definition() from public, anon, authenticated;',
    'grant execute on function public.app_deployed_definition() to service_role;',
  ];
}

/** Initial schema for one isolated generated-app Supabase database. No migration of existing data. */
export function compileInitialApplicationSchema(input: ApplicationDefinition): string[] {
  const app = readApplicationDefinition(input);
  const statements: string[] = [];
  statements.push('create schema private;');
  statements.push('revoke all on schema private from public;');
  statements.push('create table private.app_schema_revisions (id boolean primary key default true check (id), definition jsonb not null);');
  statements.push('revoke all on private.app_schema_revisions from public, anon, authenticated;');
  statements.push(`insert into private.app_schema_revisions (id, definition) values (true, ${literal(JSON.stringify(app))}::jsonb);`);
  statements.push(...revisionReadInfrastructure());
  statements.push(...formRequestLedger(), ...formRequestFunction(), ...formRequestCapability());
  statements.push(`create function public.app_guard_audit_fields() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'Immutable application record identity';
  end if;
  new.updated_at := now();
  return new;
end $$;`);
  if (app.roles.length) statements.push(...roleInfrastructure());
  for (const [tableIndex, table] of app.tables.entries()) {
    const name = `public.${sqlName(tableName(table))}`;
    const fields = table.fields.map(column);
    statements.push(`create table ${name} (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  _tayar_request_id uuid${fields.length ? `,\n  ${fields.join(',\n  ')}` : ''}
);`);
    statements.push(`alter table ${name} enable row level security;`);
    statements.push(`revoke all on ${name} from public, anon, authenticated;`);
    statements.push(`create index ${sqlName(`app_i_${tableIndex}_owner`)} on ${name} (owner_id);`);
    statements.push(`create trigger app_guard_audit before update on ${name} for each row execute function public.app_guard_audit_fields();`);
    statements.push(formRequestIndex(tableIndex, table), formRequestTrigger(table), formRequestLedgerTrigger(table));
    for (const [index, field] of table.fields.entries()) statements.push(...fieldIndex(tableIndex, index, table, field));
  }
  // Add references only after all tables exist, including cyclic relationships.
  for (const [tableIndex, table] of app.tables.entries()) for (const [fieldIndex, field] of table.fields.entries()) {
    if (field.type !== 'reference') continue;
    statements.push(referenceConstraint(app, tableIndex, fieldIndex, field));
  }
  for (const [tableIndex, table] of app.tables.entries()) {
    statements.push(...policies(table, tableIndex));
  }
  return statements;
}

/** Additive upgrade only. The caller must apply the returned statements in one database transaction. */
export function compileAdditiveApplicationMigration(previous: ApplicationDefinition, next: ApplicationDefinition): string[] {
  const before = readApplicationDefinition(previous);
  const after = readApplicationDefinition(next);
  if (JSON.stringify(before.auth) !== JSON.stringify(after.auth)) {
    throw new Error('Authentication changes require a separately reviewed backend migration.');
  }
  if (before.roles.length > after.roles.length || before.roles.some((role, index) => JSON.stringify(role) !== JSON.stringify(after.roles[index]))) {
    throw new Error('Removing, reordering or changing existing roles requires a separately reviewed backend migration.');
  }
  if (before.tables.length > after.tables.length || before.tables.some((table, index) => {
    const updated = after.tables[index];
    return !updated || table.id !== updated.id || table.key !== updated.key || table.name !== updated.name || table.fields.length > updated.fields.length
      || table.fields.some((field, fieldIndex) => JSON.stringify(field) !== JSON.stringify(updated.fields[fieldIndex]));
  })) throw new Error('Removing, reordering or changing existing tables and fields requires a separately reviewed data migration.');
  if (JSON.stringify(before) === JSON.stringify(after)) return [];

  const statements: string[] = [
    `do $revision$ begin
  perform 1 from private.app_schema_revisions where id = true for update;
  if not exists (select 1 from private.app_schema_revisions where id = true and definition = ${literal(JSON.stringify(before))}::jsonb) then
    raise exception 'Application schema revision does not match deployed definition';
  end if;
end $revision$;`,
  ];
  statements.push(...revisionReadInfrastructure());
  if (!before.roles.length && after.roles.length) statements.push(...roleInfrastructure());
  if (after.tables.length > before.tables.length) statements.push(...formRequestFunction());
  for (const [index, table] of after.tables.entries()) {
    const old = before.tables[index];
    const name = `public.${sqlName(tableName(table))}`;
    if (!old) {
      const fields = table.fields.map(column);
      statements.push(`create table ${name} (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  _tayar_request_id uuid${fields.length ? `,\n  ${fields.join(',\n  ')}` : ''}
);`);
      statements.push(`alter table ${name} enable row level security;`);
      statements.push(`revoke all on ${name} from public, anon, authenticated;`);
      statements.push(`create index ${sqlName(`app_i_${index}_owner`)} on ${name} (owner_id);`);
      statements.push(`create trigger app_guard_audit before update on ${name} for each row execute function public.app_guard_audit_fields();`);
      statements.push(formRequestIndex(index, table), formRequestTrigger(table));
      // Legacy deployments can still add tables before the guarded v2 upgrade.
      // That upgrade backfills and installs the ledger trigger on every table.
      statements.push(`do $form_ledger$ begin
  if to_regclass('private.app_form_request_ledger') is not null then
    execute ${literal(formRequestLedgerTrigger(table))};
  end if;
end $form_ledger$;`);
    }
    for (let fieldIndexValue = old?.fields.length ?? 0; fieldIndexValue < table.fields.length; fieldIndexValue++) {
      const field = table.fields[fieldIndexValue];
      if (old) {
        if (field.required && field.defaultValue === undefined) throw new Error(`Required field ${table.key}.${field.key} needs a default or a reviewed backfill.`);
        statements.push(`alter table ${name} add column ${column(field)};`);
      }
      statements.push(...fieldIndex(index, fieldIndexValue, table, field));
    }
  }
  // References are added after every new table/column, so cross-table and cyclic references resolve.
  for (const [index, table] of after.tables.entries()) {
    for (let fieldIndexValue = before.tables[index]?.fields.length ?? 0; fieldIndexValue < table.fields.length; fieldIndexValue++) {
      const field = table.fields[fieldIndexValue];
      if (field.type === 'reference') statements.push(referenceConstraint(after, index, fieldIndexValue, field));
    }
  }
  for (const [index, table] of after.tables.entries()) {
    const old = before.tables[index];
    if (old && JSON.stringify(old.permissions) === JSON.stringify(table.permissions)) continue;
    if (old) {
      // Revoke before creating replacement policies; a removed rule cannot retain a stale grant.
      statements.push(`revoke all on ${`public.${sqlName(tableName(table))}`} from anon, authenticated;`);
      for (const operation of ['read', 'create', 'update', 'delete'] as const) {
        if (old.permissions.some(rule => rule.operation === operation)) {
          statements.push(`drop policy ${sqlName(`app_p_${index}_${operation}`)} on public.${sqlName(tableName(table))};`);
        }
      }
    }
    statements.push(...policies(table, index));
  }
  statements.push(`update private.app_schema_revisions set definition = ${literal(JSON.stringify(after))}::jsonb where id = true;`);
  return statements;
}

/** One guarded transaction upgrades a legacy isolated backend without changing
 * its application definition. The private capability row is written last, so
 * retries either observe a complete upgrade or run from the original schema.
 * The caller still must verify the marker against the same dedicated backend. */
export function compileApplicationFormRequestUpgrade(input: ApplicationDefinition): string[] {
  const app = readApplicationDefinition(input);
  const actions = [...formRequestLedger(), ...formRequestFunction()].map(statement => `execute ${literal(statement)};`);
  for (const [index, table] of app.tables.entries()) {
    const name = `public.${sqlName(tableName(table))}`;
    const indexName = sqlName(`app_i_${index}_request`);
    actions.push(`execute ${literal(`alter table ${name} add column if not exists _tayar_request_id uuid;`)};`);
    actions.push(`if not exists (select 1 from pg_attribute where attrelid = ${literal(name)}::regclass
      and attname = '_tayar_request_id' and atttypid = 'uuid'::regtype and not attnotnull and not attisdropped)
      then raise exception 'Application request column is invalid'; end if;`);
    actions.push(`execute ${literal(formRequestIndex(index, table).replace('create unique index ', 'create unique index if not exists '))};`);
    actions.push(`if not exists (select 1 from pg_index i join pg_class c on c.oid = i.indexrelid
      where i.indrelid = ${literal(name)}::regclass and c.relnamespace = 'public'::regnamespace
      and c.relname = ${literal(`app_i_${index}_request`)} and i.indisunique and i.indisvalid and i.indisready
      and i.indnkeyatts = 2 and i.indnatts = 2 and i.indexprs is null
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = ${literal(name)}::regclass and attname = 'owner_id')
      and i.indkey[1] = (select attnum from pg_attribute where attrelid = ${literal(name)}::regclass and attname = '_tayar_request_id')
      and pg_get_expr(i.indpred, i.indrelid) = '(_tayar_request_id IS NOT NULL)')
      then raise exception 'Application request index ${indexName} is invalid'; end if;`);
    actions.push(`execute ${literal(formRequestTrigger(table).replace('create trigger ', 'create or replace trigger '))};`);
    actions.push(`execute ${literal(`insert into private.app_form_request_ledger(owner_id, table_name, request_id, record_id)
      select owner_id, ${literal(tableName(table))}, _tayar_request_id, id from ${name} where _tayar_request_id is not null;`)};`);
    actions.push(`execute ${literal(formRequestLedgerTrigger(table).replace('create trigger ', 'create or replace trigger '))};`);
  }
  const capability = formRequestCapability().map(statement => `execute ${literal(statement)};`);
  return [`do $form_request_upgrade$
declare v_version integer;
begin
  perform 1 from private.app_schema_revisions where id = true for update;
  if not found or not exists (
    select 1 from private.app_schema_revisions where id = true and definition = ${literal(JSON.stringify(app))}::jsonb
  ) then raise exception 'Application schema revision does not match deployed definition'; end if;
  if to_regclass('private.app_runtime_capabilities') is not null then
    execute 'select form_request_version from private.app_runtime_capabilities where id = true' into v_version;
    if v_version = 2 then return; end if;
    if v_version is distinct from 1 then raise exception 'Application request capability is invalid'; end if;
  end if;
  ${actions.join('\n  ')}
  if v_version = 1 then
    alter table private.app_runtime_capabilities drop constraint app_runtime_capabilities_form_request_version_check;
    alter table private.app_runtime_capabilities add constraint app_runtime_capabilities_form_request_version_check
      check (form_request_version in (1, 2));
    update private.app_runtime_capabilities set form_request_version = 2 where id = true;
  else
    ${capability.join('\n    ')}
  end if;
end $form_request_upgrade$;`];
}
