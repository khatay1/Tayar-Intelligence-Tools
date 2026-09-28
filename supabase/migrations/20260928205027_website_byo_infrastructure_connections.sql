-- BYO connection metadata only. OAuth grants and runtime secrets are never
-- written to projects.content or this registry.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table private.website_infrastructure_connections (
  id uuid primary key,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  provider text not null check (provider in ('github','supabase','vercel','stripe','external')),
  environment text not null check (environment in ('preview','production')),
  account_id text not null check (account_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$'),
  target_id text check (target_id ~ '^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$'),
  permissions text[] not null default '{}',
  status text not null check (status in ('disconnected','connecting','connected','permissions-missing',
    'setup-incomplete','outdated-schema','deployment-failed','credentials-revoked','ready')),
  version bigint not null check (version > 0),
  operation_id uuid,
  last_commit_id uuid not null unique,
  verified_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (project_id, provider, environment),
  check ((status = 'connecting') = (operation_id is not null)),
  check (status <> 'ready' or (target_id is not null and verified_at is not null)),
  check (status not in ('connected','ready') or verified_at is not null),
  check (cardinality(permissions) <= 40)
);
create index website_infrastructure_connections_owner_idx
  on private.website_infrastructure_connections(owner_id, project_id);
alter table private.website_infrastructure_connections enable row level security;
revoke all on private.website_infrastructure_connections from public, anon, authenticated;

-- A trusted provider adapter first verifies the account/installation and then
-- records its observed state. expected_version is a mandatory CAS guard.
create function public.website_record_infrastructure_connection(
  p_id uuid, p_project_id uuid, p_owner_id uuid, p_expected_version bigint, p_provider text,
  p_environment text, p_account_id text, p_target_id text, p_permissions text[],
  p_status text, p_operation_id uuid, p_verified_at timestamptz, p_commit_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_owner uuid; v_version bigint; v_permission text;
begin
  select user_id into v_owner from public.projects
  where id = p_project_id and type = 'website-builder' and deleted_at is null for update;
  if not found or v_owner is null or p_owner_id is distinct from v_owner then
    raise exception 'Project unavailable';
  end if;
  if p_id is null or p_commit_id is null or p_expected_version is null or p_expected_version < 0
    or p_provider is null or p_provider not in ('github','supabase','vercel','stripe','external')
    or p_environment is null or p_environment not in ('preview','production')
    or p_account_id is null or p_account_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$'
    or (p_target_id is not null and p_target_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_./:-]{0,199}$')
    or p_status is null or p_status not in ('disconnected','connecting','connected','permissions-missing',
      'setup-incomplete','outdated-schema','deployment-failed','credentials-revoked','ready')
    or (p_status = 'connecting') is distinct from (p_operation_id is not null)
    or (p_status = 'ready' and p_target_id is null)
    or (p_status in ('connected','ready') and p_verified_at is null)
    or p_permissions is null or cardinality(p_permissions) > 40 then
    raise exception 'Invalid infrastructure connection';
  end if;
  foreach v_permission in array p_permissions loop
    if v_permission is null or v_permission !~ '^[a-zA-Z0-9][a-zA-Z0-9_:./-]{0,119}$' then
      raise exception 'Invalid infrastructure permission';
    end if;
  end loop;
  if (select count(distinct item) from unnest(p_permissions) item) <> cardinality(p_permissions) then
    raise exception 'Duplicate infrastructure permission';
  end if;
  if p_expected_version = 0 then
    insert into private.website_infrastructure_connections
      (id,project_id,owner_id,provider,environment,account_id,target_id,permissions,status,version,operation_id,verified_at,last_commit_id)
    values (p_id,p_project_id,v_owner,p_provider,p_environment,p_account_id,p_target_id,p_permissions,
      p_status,1,p_operation_id,p_verified_at,p_commit_id);
    return 1;
  end if;
  update private.website_infrastructure_connections set target_id=p_target_id,
    permissions=p_permissions,status=p_status,operation_id=p_operation_id,verified_at=p_verified_at,
    version=version+1,last_commit_id=p_commit_id,updated_at=clock_timestamp()
  where id=p_id and project_id=p_project_id and owner_id=v_owner and provider=p_provider
    and environment=p_environment and account_id=p_account_id and version=p_expected_version
  returning version into v_version;
  if v_version is null then raise exception 'Infrastructure connection changed'; end if;
  return v_version;
end $$;
revoke all on function public.website_record_infrastructure_connection(uuid,uuid,uuid,bigint,text,text,text,text,text[],text,uuid,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.website_record_infrastructure_connection(uuid,uuid,uuid,bigint,text,text,text,text,text[],text,uuid,timestamptz,uuid) to service_role;

-- A timed-out write may have committed. Reconcile only an exact owner/project,
-- connection, target, handoff operation and next-version match. No token is
-- returned, and a later update invalidates the old acknowledgement.
create function public.website_reconcile_infrastructure_connection(
  p_id uuid, p_project_id uuid, p_owner_id uuid, p_provider text,
  p_commit_id uuid, p_expected_version bigint, p_target_id text
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if p_id is null or p_project_id is null or p_owner_id is null or p_commit_id is null
    or p_expected_version is null or p_expected_version < 0 or p_target_id is null then return null; end if;
  select jsonb_build_object('connectionId',c.id,'repositoryId',c.target_id,
    'version',c.version,'environment',c.environment) into v_result
  from private.website_infrastructure_connections c join public.projects p on p.id=c.project_id
  where c.id=p_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider=p_provider and c.last_commit_id=p_commit_id
    and c.version=p_expected_version+1 and c.target_id=p_target_id and c.status='connected';
  return v_result;
end $$;
revoke all on function public.website_reconcile_infrastructure_connection(uuid,uuid,uuid,text,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.website_reconcile_infrastructure_connection(uuid,uuid,uuid,text,uuid,bigint,text) to service_role;

create function private.website_infrastructure_connections_for_owner(p_project_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  if not exists (select 1 from public.projects where id=p_project_id
    and user_id=(select auth.uid()) and type='website-builder' and deleted_at is null
    and (((select auth.jwt())->>'is_anonymous')::boolean) is not true) then
    raise exception 'Project access denied';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,'ownerId',c.owner_id,'projectId',c.project_id,'provider',c.provider,
    'environment',c.environment,'accountId',c.account_id,'targetId',c.target_id,
    'permissions',c.permissions,'status',c.status,'version',c.version,
    'verifiedAt',c.verified_at,'updatedAt',c.updated_at) order by c.provider,c.environment),'[]'::jsonb)
  into v_result from private.website_infrastructure_connections c where c.project_id=p_project_id;
  return v_result;
end $$;
revoke all on function private.website_infrastructure_connections_for_owner(uuid) from public, anon;
grant execute on function private.website_infrastructure_connections_for_owner(uuid) to authenticated;

create function public.website_infrastructure_connections_for_owner(p_project_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.website_infrastructure_connections_for_owner(p_project_id)
$$;
revoke all on function public.website_infrastructure_connections_for_owner(uuid) from public, anon;
grant execute on function public.website_infrastructure_connections_for_owner(uuid) to authenticated;
