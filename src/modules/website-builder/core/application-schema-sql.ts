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

/** Initial schema for one isolated generated-app Supabase database. No migration of existing data. */
export function compileInitialApplicationSchema(input: ApplicationDefinition): string[] {
  const app = readApplicationDefinition(input);
  const statements: string[] = [];
  statements.push('create schema private;');
  statements.push('revoke all on schema private from public;');
  statements.push('create table private.app_schema_revisions (id boolean primary key default true check (id), definition jsonb not null);');
  statements.push('revoke all on private.app_schema_revisions from public, anon, authenticated;');
  statements.push(`insert into private.app_schema_revisions (id, definition) values (true, ${literal(JSON.stringify(app))}::jsonb);`);
  statements.push(`create function public.app_guard_audit_fields() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'Immutable application record identity';
  end if;
  new.updated_at := now();
  return new;
end $$;`);
  if (app.roles.length) {
    statements.push('grant usage on schema private to authenticated;');
    statements.push('create table private.app_user_roles (user_id uuid not null references auth.users(id) on delete cascade, role_id text not null, primary key (user_id, role_id));');
    statements.push('alter table private.app_user_roles enable row level security;');
    statements.push('revoke all on private.app_user_roles from public, anon, authenticated;');
    statements.push(`create function private.app_has_role(requested_role text) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true
    and exists (select 1 from private.app_user_roles where user_id = (select auth.uid()) and role_id = requested_role)
$$;`);
    statements.push('revoke all on function private.app_has_role(text) from public;');
    statements.push('grant execute on function private.app_has_role(text) to authenticated;');
  }
  for (const [tableIndex, table] of app.tables.entries()) {
    const name = `public.${sqlName(tableName(table))}`;
    const fields = table.fields.map(column);
    statements.push(`create table ${name} (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()${fields.length ? `,\n  ${fields.join(',\n  ')}` : ''}
);`);
    statements.push(`alter table ${name} enable row level security;`);
    statements.push(`revoke all on ${name} from public, anon, authenticated;`);
    statements.push(`create index ${sqlName(`app_i_${tableIndex}_owner`)} on ${name} (owner_id);`);
    statements.push(`create trigger app_guard_audit before update on ${name} for each row execute function public.app_guard_audit_fields();`);
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
  if (JSON.stringify(before.roles) !== JSON.stringify(after.roles) || JSON.stringify(before.auth) !== JSON.stringify(after.auth)) {
    throw new Error('Role or authentication changes require a separately reviewed backend migration.');
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
  for (const [index, table] of after.tables.entries()) {
    const old = before.tables[index];
    const name = `public.${sqlName(tableName(table))}`;
    if (!old) {
      const fields = table.fields.map(column);
      statements.push(`create table ${name} (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()${fields.length ? `,\n  ${fields.join(',\n  ')}` : ''}
);`);
      statements.push(`alter table ${name} enable row level security;`);
      statements.push(`revoke all on ${name} from public, anon, authenticated;`);
      statements.push(`create index ${sqlName(`app_i_${index}_owner`)} on ${name} (owner_id);`);
      statements.push(`create trigger app_guard_audit before update on ${name} for each row execute function public.app_guard_audit_fields();`);
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
