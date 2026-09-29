-- Runtime secrets are copied to the customer's Vercel project and then erased
-- from Tayar Vault. This table retains destination metadata only.
create table private.website_vercel_secret_handoffs (
  id uuid primary key,
  connection_id uuid not null references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  connection_version bigint not null check (connection_version>0),
  source_connection_id text not null,
  source_field text not null,
  source_environment text not null check (source_environment in ('preview','staging','production')),
  source_updated_at timestamptz not null,
  vercel_project_id text not null,
  environment_key text not null,
  target text not null check (target in ('preview','production')),
  git_branch text not null default '',
  vercel_environment_id text,
  status text not null check (status in ('preparing','verified','removed')),
  operation_id uuid not null unique,
  last_commit_id uuid,
  version bigint not null check (version>0),
  verified_at timestamptz,
  updated_at timestamptz not null default clock_timestamp(),
  unique(connection_id,source_connection_id,source_field,source_environment,environment_key,target,git_branch)
);
alter table private.website_vercel_secret_handoffs enable row level security;
revoke all on private.website_vercel_secret_handoffs from public, anon, authenticated;

create function public.website_begin_vercel_secret_handoff(
  p_id uuid,p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_connection_version bigint,
  p_expected_handoff_version bigint,p_source_connection_id text,p_source_field text,
  p_source_environment text,p_source_updated_at timestamptz,p_environment_key text,
  p_target text,p_git_branch text,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_handoff private.website_vercel_secret_handoffs%rowtype; v_version bigint;
  v_token text; v_value text; v_user_id text; v_account_id text; v_vercel_project_id text;
begin
  if p_id is null or p_operation_id is null or p_connection_version is null or p_connection_version<1
    or p_expected_handoff_version is null or p_expected_handoff_version<0
    or p_source_connection_id is null or p_source_connection_id !~ '^[a-zA-Z0-9][a-zA-Z0-9_-]{0,119}$'
    or p_source_field is null or p_source_field !~ '^[a-zA-Z][a-zA-Z0-9_-]{0,63}$'
    or p_source_environment is null or p_source_environment not in ('preview','staging','production')
    or p_source_updated_at is null or p_environment_key is null
    or p_environment_key !~ '^[A-Z][A-Z0-9_]{1,99}$'
    or p_target is null or p_target not in ('preview','production') or p_git_branch is null
    or (p_target='production' and p_git_branch<>'')
    or (p_target='preview' and p_git_branch<>'' and (p_git_branch !~ '^[a-zA-Z0-9_./-]{1,200}$'
      or p_git_branch like '%..%' or left(p_git_branch,1)='/' or right(p_git_branch,1)='/'))
    then raise exception 'Invalid Vercel secret handoff'; end if;
  select d.decrypted_secret,s_secret.decrypted_secret,v.user_id,v.account_id,v.vercel_project_id
  into v_token,v_value,v_user_id,v_account_id,v_vercel_project_id
  from private.website_infrastructure_connections c
  join private.website_vercel_integration_custody v on v.connection_id=c.id
  join vault.decrypted_secrets d on d.id=v.secret_id
  join private.website_project_secrets s on s.project_id=c.project_id
  join vault.decrypted_secrets s_secret on s_secret.id=s.secret_id
  join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='vercel' and c.version=p_connection_version
    and c.status in ('connected','setup-incomplete','deployment-failed','ready')
    and v.project_id=c.project_id and v.owner_id=c.owner_id and v.connection_version=c.version
    and v.vercel_project_id=c.target_id and v.custody_expires_at>clock_timestamp()
    and s.connection_id=p_source_connection_id and s.field=p_source_field
    and s.environment=p_source_environment and s.updated_at=p_source_updated_at
  for update of c,s;
  if not found or v_token is null or v_value is null then raise exception 'Vercel secret handoff changed'; end if;
  select * into v_handoff from private.website_vercel_secret_handoffs where id=p_id for update;
  if found and v_handoff.operation_id=p_operation_id then
    if v_handoff.connection_id<>p_connection_id or v_handoff.project_id<>p_project_id
      or v_handoff.owner_id<>p_owner_id or v_handoff.connection_version<>p_connection_version
      or v_handoff.source_connection_id<>p_source_connection_id or v_handoff.source_field<>p_source_field
      or v_handoff.source_environment<>p_source_environment or v_handoff.source_updated_at<>p_source_updated_at
      or v_handoff.vercel_project_id<>v_vercel_project_id or v_handoff.environment_key<>p_environment_key
      or v_handoff.target<>p_target or v_handoff.git_branch<>p_git_branch then raise exception 'Vercel secret handoff changed'; end if;
    return jsonb_build_object('handoffVersion',v_handoff.version,'accessToken',v_token,
      'secretValue',v_value,'userId',v_user_id,'accountId',v_account_id,'vercelProjectId',v_vercel_project_id);
  end if;
  if p_expected_handoff_version=0 then
    if found then raise exception 'Vercel secret handoff changed'; end if;
    insert into private.website_vercel_secret_handoffs
      (id,connection_id,project_id,owner_id,connection_version,source_connection_id,source_field,
       source_environment,source_updated_at,vercel_project_id,environment_key,target,git_branch,
       status,operation_id,version)
    values (p_id,p_connection_id,p_project_id,p_owner_id,p_connection_version,p_source_connection_id,
      p_source_field,p_source_environment,p_source_updated_at,v_vercel_project_id,p_environment_key,
      p_target,p_git_branch,'preparing',p_operation_id,1);
    v_version:=1;
  else
    if not found or v_handoff.version<>p_expected_handoff_version or v_handoff.status<>'verified'
      or v_handoff.connection_id<>p_connection_id or v_handoff.project_id<>p_project_id
      or v_handoff.owner_id<>p_owner_id or v_handoff.source_connection_id<>p_source_connection_id
      or v_handoff.source_field<>p_source_field or v_handoff.source_environment<>p_source_environment
      or v_handoff.environment_key<>p_environment_key or v_handoff.target<>p_target
      or v_handoff.git_branch<>p_git_branch
      then raise exception 'Vercel secret handoff changed'; end if;
    v_version:=v_handoff.version+1;
    update private.website_vercel_secret_handoffs set connection_version=p_connection_version,
      source_updated_at=p_source_updated_at,vercel_project_id=v_vercel_project_id,status='preparing',
      operation_id=p_operation_id,vercel_environment_id=null,last_commit_id=null,verified_at=null,
      version=v_version,updated_at=clock_timestamp() where id=p_id;
  end if;
  return jsonb_build_object('handoffVersion',v_version,'accessToken',v_token,'secretValue',v_value,
    'userId',v_user_id,'accountId',v_account_id,'vercelProjectId',v_vercel_project_id);
end $$;
revoke all on function public.website_begin_vercel_secret_handoff(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,timestamptz,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.website_begin_vercel_secret_handoff(uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,timestamptz,text,text,text,uuid) to service_role;

create function public.website_commit_vercel_secret_handoff(
  p_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_handoff_version bigint,
  p_operation_id uuid,p_vercel_environment_id text,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_handoff private.website_vercel_secret_handoffs%rowtype; v_next bigint;
begin
  if p_operation_id is null or p_commit_id is null or p_expected_handoff_version is null
    or p_expected_handoff_version<1 or p_vercel_environment_id is null
    or p_vercel_environment_id !~ '^[a-zA-Z0-9_-]{3,128}$' then raise exception 'Invalid Vercel secret commit'; end if;
  select h.* into v_handoff from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  join private.website_infrastructure_connections c on c.id=h.connection_id
  join private.website_vercel_integration_custody v on v.connection_id=c.id
  where h.id=p_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_expected_handoff_version and h.operation_id=p_operation_id and h.status='preparing'
    and c.project_id=h.project_id and c.owner_id=h.owner_id and c.provider='vercel'
    and c.version=h.connection_version and c.target_id=h.vercel_project_id
    and v.connection_version=c.version and v.custody_expires_at>clock_timestamp()
  for update of h;
  if not found then raise exception 'Vercel secret handoff changed'; end if;
  delete from private.website_project_secrets where project_id=v_handoff.project_id
    and connection_id=v_handoff.source_connection_id and field=v_handoff.source_field
    and environment=v_handoff.source_environment and updated_at=v_handoff.source_updated_at;
  if not found then raise exception 'Project secret changed'; end if;
  v_next:=v_handoff.version+1;
  update private.website_vercel_secret_handoffs set status='verified',
    vercel_environment_id=p_vercel_environment_id,last_commit_id=p_commit_id,
    version=v_next,verified_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_id;
  return v_next;
end $$;
revoke all on function public.website_commit_vercel_secret_handoff(uuid,uuid,uuid,bigint,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.website_commit_vercel_secret_handoff(uuid,uuid,uuid,bigint,uuid,text,uuid) to service_role;

create function public.website_reconcile_vercel_secret_handoff(
  p_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_handoff_version bigint,
  p_operation_id uuid,p_vercel_environment_id text,p_commit_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select h.version from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  where h.id=p_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_expected_handoff_version+1 and h.operation_id=p_operation_id
    and h.status='verified' and h.vercel_environment_id=p_vercel_environment_id
    and h.last_commit_id=p_commit_id
    and not exists (select 1 from private.website_project_secrets s where s.project_id=h.project_id
      and s.connection_id=h.source_connection_id and s.field=h.source_field
      and s.environment=h.source_environment and s.updated_at=h.source_updated_at);
$$;
revoke all on function public.website_reconcile_vercel_secret_handoff(uuid,uuid,uuid,bigint,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_vercel_secret_handoff(uuid,uuid,uuid,bigint,uuid,text,uuid) to service_role;

-- A verified destination receipt keeps the opaque project reference useful
-- after Tayar erases the raw Vault value. A newly entered rotation takes priority.
create or replace function private.website_project_secret_refs_impl(p_project_id uuid)
returns table(connection_id text, field text, environment text, ref text, updated_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.projects where id=p_project_id
    and user_id=(select auth.uid()) and type='website-builder' and deleted_at is null
    and (((select auth.jwt())->>'is_anonymous')::boolean) is not true) then raise exception 'Project access denied'; end if;
  return query select distinct on (r.connection_id,r.field,r.environment)
    r.connection_id,r.field,r.environment,
    'secret://website/' || p_project_id::text || '/' || r.connection_id || '/' || r.field || '/' || r.environment,
    r.updated_at
  from (
    select s.connection_id,s.field,s.environment,s.updated_at,0 as priority
      from private.website_project_secrets s where s.project_id=p_project_id
    union all
    select h.source_connection_id,h.source_field,h.source_environment,h.verified_at,1
      from private.website_vercel_secret_handoffs h where h.project_id=p_project_id and h.status='verified'
  ) r order by r.connection_id,r.field,r.environment,r.priority,r.updated_at desc;
end $$;
revoke all on function private.website_project_secret_refs_impl(uuid) from public;
grant execute on function private.website_project_secret_refs_impl(uuid) to authenticated;
