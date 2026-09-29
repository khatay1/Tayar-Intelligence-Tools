-- Customer Vercel Integration tokens are Tayar orchestration credentials, not
-- application runtime secrets. Keep them in scoped Vault custody with a lease.
create table private.website_vercel_integration_custody (
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check (environment in ('preview','production')),
  user_id text not null,
  account_id text not null,
  configuration_id text not null,
  vercel_project_id text not null,
  repository_id text not null,
  repository_owner text not null,
  repository_name text not null,
  production_branch text not null,
  secret_id uuid not null unique,
  connection_version bigint not null check (connection_version > 0),
  last_operation_id uuid not null unique,
  custody_expires_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);
create index website_vercel_integration_custody_expiry_idx
  on private.website_vercel_integration_custody(custody_expires_at);
alter table private.website_vercel_integration_custody enable row level security;
revoke all on private.website_vercel_integration_custody from public, anon, authenticated;

create function private.website_vercel_integration_custody_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id=old.secret_id;
  return old;
end $$;
revoke all on function private.website_vercel_integration_custody_cleanup() from public, anon, authenticated;
create trigger website_vercel_integration_custody_cleanup
after delete on private.website_vercel_integration_custody for each row
execute function private.website_vercel_integration_custody_cleanup();

-- Metadata and encrypted custody commit together. A reconnect replaces the
-- prior lease only after the connection CAS succeeds.
create function public.website_bind_vercel_project(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_version bigint,
  p_environment text,p_user_id text,p_account_id text,p_configuration_id text,
  p_vercel_project_id text,p_repository_id text,p_repository_owner text,
  p_repository_name text,p_production_branch text,p_access_token text,
  p_custody_expires_at timestamptz,p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_connection_version bigint; v_secret_id uuid; v_name text;
begin
  if p_user_id is null or p_user_id !~ '^[a-zA-Z0-9_-]{3,128}$'
    or p_account_id is null or p_account_id !~ '^[a-zA-Z0-9_-]{3,128}$'
    or p_configuration_id is null or p_configuration_id !~ '^icfg_[a-zA-Z0-9]{8,128}$'
    or p_vercel_project_id is null or p_vercel_project_id !~ '^prj_[a-zA-Z0-9]{8,128}$'
    or p_repository_id is null or p_repository_id !~ '^[0-9]{1,30}$'
    or p_repository_owner is null or p_repository_owner !~ '^[a-zA-Z0-9_.-]{1,100}$'
    or p_repository_name is null or p_repository_name !~ '^[a-zA-Z0-9_.-]{1,100}$'
    or p_production_branch is null or p_production_branch !~ '^[a-zA-Z0-9_./-]{1,200}$'
    or p_production_branch like '%..%' or left(p_production_branch,1)='/' or right(p_production_branch,1)='/'
    or p_access_token is null or length(p_access_token)<20 or octet_length(p_access_token)>4096
    or p_custody_expires_at is null or p_custody_expires_at<=clock_timestamp()
    or p_custody_expires_at>clock_timestamp()+interval '90 days' then
    raise exception 'Vercel binding unavailable';
  end if;
  v_connection_version:=public.website_record_infrastructure_connection(
    p_connection_id,p_project_id,p_owner_id,p_expected_version,'vercel',p_environment,
    p_account_id,p_vercel_project_id,array['user:read','team:read','project:read'],
    'connected',null,clock_timestamp(),p_operation_id
  );
  delete from private.website_vercel_integration_custody where connection_id=p_connection_id;
  v_name:='website_vercel_integration_' || p_connection_id::text;
  v_secret_id:=vault.create_secret(p_access_token,v_name,'Customer Vercel orchestration token',null);
  insert into private.website_vercel_integration_custody
    (connection_id,project_id,owner_id,environment,user_id,account_id,configuration_id,
     vercel_project_id,repository_id,repository_owner,repository_name,production_branch,
     secret_id,connection_version,last_operation_id,custody_expires_at)
  values (p_connection_id,p_project_id,p_owner_id,p_environment,p_user_id,p_account_id,
    p_configuration_id,p_vercel_project_id,p_repository_id,p_repository_owner,
    p_repository_name,p_production_branch,v_secret_id,v_connection_version,p_operation_id,
    p_custody_expires_at);
  return v_connection_version;
end $$;
revoke all on function public.website_bind_vercel_project(uuid,uuid,uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.website_bind_vercel_project(uuid,uuid,uuid,bigint,text,text,text,text,text,text,text,text,text,text,timestamptz,uuid) to service_role;

create function public.website_reconcile_vercel_project_binding(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_version bigint,
  p_account_id text,p_vercel_project_id text,p_configuration_id text,p_operation_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select c.version from private.website_infrastructure_connections c
  join private.website_vercel_integration_custody v on v.connection_id=c.id
  join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='vercel' and c.target_id=p_vercel_project_id and c.status='connected'
    and c.version=p_expected_version+1 and c.last_commit_id=p_operation_id
    and c.account_id=p_account_id and v.connection_version=c.version and v.configuration_id=p_configuration_id
    and v.vercel_project_id=c.target_id and v.account_id=c.account_id
    and v.owner_id=c.owner_id and v.project_id=c.project_id
    and v.last_operation_id=p_operation_id and v.custody_expires_at>clock_timestamp();
$$;
revoke all on function public.website_reconcile_vercel_project_binding(uuid,uuid,uuid,bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_vercel_project_binding(uuid,uuid,uuid,bigint,text,text,text,uuid) to service_role;

create function public.website_read_vercel_integration_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object('userId',v.user_id,'accountId',v.account_id,
    'configurationId',v.configuration_id,'vercelProjectId',v.vercel_project_id,
    'repositoryId',v.repository_id,'repositoryOwner',v.repository_owner,
    'repositoryName',v.repository_name,'productionBranch',v.production_branch,
    'environment',v.environment,'custodyExpiresAt',v.custody_expires_at,
    'accessToken',d.decrypted_secret)
  into v_result from private.website_vercel_integration_custody v
  join private.website_infrastructure_connections c on c.id=v.connection_id
  join public.projects p on p.id=v.project_id
  join vault.decrypted_secrets d on d.id=v.secret_id
  where v.connection_id=p_connection_id and v.project_id=p_project_id and v.owner_id=p_owner_id
    and v.connection_version=p_expected_connection_version and v.custody_expires_at>clock_timestamp()
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.project_id=v.project_id and c.owner_id=v.owner_id and c.provider='vercel'
    and c.version=v.connection_version and c.account_id=v.account_id
    and c.target_id=v.vercel_project_id and c.environment=v.environment
    and c.status in ('connected','setup-incomplete','deployment-failed','ready');
  return v_result;
end $$;
revoke all on function public.website_read_vercel_integration_custody(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.website_read_vercel_integration_custody(uuid,uuid,uuid,bigint) to service_role;

create function public.website_delete_vercel_integration_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then return false; end if;
  delete from private.website_vercel_integration_custody v
  using private.website_infrastructure_connections c
  where v.connection_id=p_connection_id and v.project_id=p_project_id and v.owner_id=p_owner_id
    and c.id=v.connection_id and c.provider='vercel' and c.version=p_expected_connection_version;
  return found;
end $$;
revoke all on function public.website_delete_vercel_integration_custody(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.website_delete_vercel_integration_custody(uuid,uuid,uuid,bigint) to service_role;

create function public.website_cleanup_expired_vercel_integration_custody()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from private.website_vercel_integration_custody where custody_expires_at<=clock_timestamp();
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function public.website_cleanup_expired_vercel_integration_custody() from public, anon, authenticated;
grant execute on function public.website_cleanup_expired_vercel_integration_custody() to service_role;
