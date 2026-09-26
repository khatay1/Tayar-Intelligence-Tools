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

/** Initial schema for one isolated generated-app Supabase database. No migration of existing data. */
export function compileInitialApplicationSchema(input: ApplicationDefinition): string[] {
  const app = readApplicationDefinition(input);
  const statements: string[] = [];
  statements.push(`create function public.app_guard_audit_fields() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id or new.created_at is distinct from old.created_at then
    raise exception 'Immutable application record identity';
  end if;
  new.updated_at := now();
  return new;
end $$;`);
  if (app.roles.length) {
    statements.push('create schema private;');
    statements.push('revoke all on schema private from public;');
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
    const fields = table.fields.map(field => {
      const parts = [sqlName(field.key), fieldType(field)];
      if (field.required) parts.push('not null');
      if (field.defaultValue !== undefined && field.defaultValue !== null) {
        parts.push(`default ${typeof field.defaultValue === 'string' ? literal(field.defaultValue) : String(field.defaultValue)}`);
      }
      if (field.type === 'enum') parts.push(`check (${sqlName(field.key)} in (${field.options!.map(literal).join(', ')}))`);
      return parts.join(' ');
    });
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
    for (const [fieldIndex, field] of table.fields.entries()) {
      if (field.unique) statements.push(`create unique index ${sqlName(`app_i_${tableIndex}_${fieldIndex}_unique`)} on ${name} (${sqlName(field.key)});`);
      else if (field.indexed || field.type === 'reference') statements.push(`create index ${sqlName(`app_i_${tableIndex}_${fieldIndex}`)} on ${name} (${sqlName(field.key)});`);
    }
  }
  // Add references only after all tables exist, including cyclic relationships.
  for (const [tableIndex, table] of app.tables.entries()) for (const [fieldIndex, field] of table.fields.entries()) {
    if (field.type !== 'reference') continue;
    const target = app.tables.find(item => item.id === field.referenceTableId)!;
    statements.push(`alter table public.${sqlName(tableName(table))} add constraint ${sqlName(`app_fk_${tableIndex}_${fieldIndex}`)} foreign key (${sqlName(field.key)}) references public.${sqlName(tableName(target))}(id) on delete restrict;`);
  }
  for (const [tableIndex, table] of app.tables.entries()) {
    const name = `public.${sqlName(tableName(table))}`;
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
  }
  return statements;
}
