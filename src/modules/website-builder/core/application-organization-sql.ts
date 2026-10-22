import type { ApplicationDefinition } from './application-model';

const sqlName = (value: string) => `"${value}"`;
const sqlLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Initial-install organization membership. Membership data stays private;
 * authenticated clients can only use bounded invoker wrappers. */
export function compileApplicationOrganizationInfrastructure(app: ApplicationDefinition): string[] {
  if (!app.tenancy) return [];
  const root = app.tables.find(table => table.id === app.tenancy!.organizationTableId);
  if (!root) throw new Error('Organization tenancy is unavailable.');
  const organizations = `public.${sqlName(`app_${root.key}`)}`;
  const scopedTriggers = app.tables.flatMap(table => {
    const field = table.fields.find(field => field.id === table.organizationFieldId);
    return field ? [`create trigger app_guard_organization_scope before update on public.${sqlName(`app_${table.key}`)}
for each row execute function public.app_guard_organization_scope(${sqlLiteral(field.key)});`] : [];
  });
  return [
    'grant usage on schema private to authenticated;',
    `create table private.app_organization_members (
  organization_id uuid not null references ${organizations}(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  administrator boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);`,
    'alter table private.app_organization_members enable row level security;',
    'revoke all on private.app_organization_members from public, anon, authenticated;',
    `create function public.app_guard_organization_scope() returns trigger language plpgsql set search_path = '' as $$
begin
  if to_jsonb(new)->TG_ARGV[0] is distinct from to_jsonb(old)->TG_ARGV[0] then
    raise exception 'Immutable application organization scope';
  end if;
  return new;
end $$;`,
    'revoke all on function public.app_guard_organization_scope() from public, anon, authenticated;',
    ...scopedTriggers,
    `create function private.app_has_organization_access(requested_organization uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true
    and exists (select 1 from private.app_organization_members m
      where m.organization_id = requested_organization and m.user_id = (select auth.uid()))
$$;`,
    'revoke all on function private.app_has_organization_access(uuid) from public;',
    'grant execute on function private.app_has_organization_access(uuid) to authenticated;',
    `create function private.app_add_organization_owner() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.owner_id is null or new.owner_id is distinct from (select auth.uid())
    or (((select auth.jwt())->>'is_anonymous')::boolean) is true then
    raise exception 'Organization owner unavailable';
  end if;
  insert into private.app_organization_members(organization_id,user_id,administrator)
    values(new.id,new.owner_id,true);
  return new;
end $$;`,
    'revoke all on function private.app_add_organization_owner() from public, anon, authenticated;',
    `create trigger app_add_organization_owner after insert on ${organizations}
for each row execute function private.app_add_organization_owner();`,
    `create function private.app_set_organization_member_impl(requested_organization uuid, target_user uuid, enabled boolean, administrator boolean) returns void language plpgsql security definer set search_path = '' as $$
declare target_is_admin boolean;
begin
  if (select auth.uid()) is null or (((select auth.jwt())->>'is_anonymous')::boolean) is true
    or requested_organization is null or target_user is null or enabled is null or administrator is null
    or not exists (select 1 from private.app_organization_members m where m.organization_id = requested_organization
      and m.user_id = (select auth.uid()) and m.administrator) then
    raise exception 'Organization membership administration denied';
  end if;
  if not exists (select 1 from auth.users u where u.id = target_user and u.is_anonymous is not true) then
    raise exception 'Valid permanent application user required';
  end if;
  select m.administrator into target_is_admin from private.app_organization_members m
    where m.organization_id = requested_organization and m.user_id = target_user;
  if not enabled and target_is_admin is true and
    (select count(*) from private.app_organization_members m where m.organization_id = requested_organization and m.administrator) <= 1 then
    raise exception 'Organization requires an administrator';
  end if;
  if enabled then
    insert into private.app_organization_members(organization_id,user_id,administrator)
      values(requested_organization,target_user,administrator)
      on conflict (organization_id,user_id) do update set administrator = excluded.administrator;
  else
    delete from private.app_organization_members m where m.organization_id = requested_organization and m.user_id = target_user;
  end if;
end $$;`,
    'revoke all on function private.app_set_organization_member_impl(uuid,uuid,boolean,boolean) from public;',
    'grant execute on function private.app_set_organization_member_impl(uuid,uuid,boolean,boolean) to authenticated;',
    `create function public.app_set_organization_member(requested_organization uuid, target_user uuid, enabled boolean, administrator boolean) returns void language sql security invoker set search_path = '' as $$
  select private.app_set_organization_member_impl(requested_organization,target_user,enabled,administrator)
$$;`,
    'revoke all on function public.app_set_organization_member(uuid,uuid,boolean,boolean) from public, anon;',
    'grant execute on function public.app_set_organization_member(uuid,uuid,boolean,boolean) to authenticated;',
    `create function private.app_my_organizations_impl() returns setof uuid language sql stable security definer set search_path = '' as $$
  select m.organization_id from private.app_organization_members m where m.user_id = (select auth.uid())
    and (select auth.uid()) is not null and (((select auth.jwt())->>'is_anonymous')::boolean) is not true
$$;`,
    'revoke all on function private.app_my_organizations_impl() from public;',
    'grant execute on function private.app_my_organizations_impl() to authenticated;',
    `create function public.app_my_organizations() returns setof uuid language sql stable security invoker set search_path = '' as $$
  select * from private.app_my_organizations_impl()
$$;`,
    'revoke all on function public.app_my_organizations() from public, anon;',
    'grant execute on function public.app_my_organizations() to authenticated;',
  ];
}

/** Catalog proof is derived from the exact compiler bodies so publication
 * cannot accept a same-named but weaker privileged function. */
export function applicationOrganizationFunctionManifest(app: ApplicationDefinition): Array<{
  schema: string; name: string; arguments: string; result: string;
  language: string; stable: boolean; securityDefiner: boolean; source: string;
  authenticatedExecute: boolean;
}> {
  const authenticated = new Set([
    'private.app_has_organization_access',
    'private.app_set_organization_member_impl',
    'public.app_set_organization_member',
    'private.app_my_organizations_impl',
    'public.app_my_organizations',
  ]);
  const statements = compileApplicationOrganizationInfrastructure(app)
    .filter(statement => statement.startsWith('create function '));
  const functions = statements.map(statement => {
    const match = /^create function (private|public)\.(app_[a-z_]+)\(([^)]*)\) returns (setof )?(boolean|void|uuid|trigger) language (sql|plpgsql)( stable)?(?: security (definer|invoker))? set search_path = '' as \$\$([\s\S]*)\$\$;$/.exec(statement);
    if (!match) throw new Error('Application organization function manifest is unavailable.');
    const key = `${match[1]}.${match[2]}`;
    return { schema: match[1], name: match[2], arguments: match[3].replace(/,\s*/g, ', '),
      result: `${match[4] ?? ''}${match[5]}`, language: match[6], stable: Boolean(match[7]),
      securityDefiner: match[8] === 'definer', source: match[9], authenticatedExecute: authenticated.has(key) };
  });
  if (functions.length !== 7) throw new Error('Application organization function manifest is incomplete.');
  return functions;
}
