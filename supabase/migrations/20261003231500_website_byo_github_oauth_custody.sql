-- GitHub App user grants remain customer-scoped orchestration credentials.
-- Persist them only in Vault-backed custody tied to one verified repository.
create table private.website_github_oauth_custody (
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check (environment in ('preview','production')),
  account_id text not null,
  installation_id text not null,
  repository_id text not null,
  repository_full_name text not null,
  default_branch text not null,
  secret_id uuid not null unique,
  connection_version bigint not null check (connection_version > 0),
  version bigint not null check (version > 0),
  last_operation_id uuid not null unique,
  access_expires_at timestamptz,
  refresh_expires_at timestamptz,
  custody_expires_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);
create index website_github_oauth_custody_expiry_idx
  on private.website_github_oauth_custody(custody_expires_at);
create index website_github_oauth_custody_project_idx
  on private.website_github_oauth_custody(project_id);
alter table private.website_github_oauth_custody enable row level security;
revoke all on private.website_github_oauth_custody from public, anon, authenticated;

create function private.website_github_oauth_custody_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id=old.secret_id;
  return old;
end $$;
revoke all on function private.website_github_oauth_custody_cleanup() from public, anon, authenticated;
create trigger website_github_oauth_custody_cleanup
after delete on private.website_github_oauth_custody for each row
execute function private.website_github_oauth_custody_cleanup();

-- Connection metadata and encrypted OAuth custody commit in one transaction.
create function public.website_bind_github_repository(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_version bigint,
  p_environment text,p_account_id text,p_installation_id text,p_repository_id text,
  p_repository_full_name text,p_default_branch text,p_access_token text,p_refresh_token text,
  p_access_expires_at timestamptz,p_refresh_expires_at timestamptz,
  p_custody_expires_at timestamptz,p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_connection_version bigint; v_secret_id uuid; v_name text; v_payload text;
begin
  if p_account_id is null or p_account_id !~ '^[1-9][0-9]{0,19}$'
    or p_installation_id is null or p_installation_id !~ '^[1-9][0-9]{0,19}$'
    or p_repository_id is null or p_repository_id !~ '^[1-9][0-9]{0,19}$'
    or p_repository_full_name is null
      or p_repository_full_name !~ '^[a-zA-Z0-9_.-]{1,39}/[a-zA-Z0-9_.-]{1,100}$'
    or p_default_branch is null or p_default_branch !~ '^[a-zA-Z0-9_./-]{1,200}$'
    or p_default_branch like '%..%' or left(p_default_branch,1)='/' or right(p_default_branch,1)='/'
    or p_access_token is null or length(p_access_token)<20 or octet_length(p_access_token)>65536
    or p_access_token ~ '[[:space:]]'
    or (p_refresh_token is not null and
      (length(p_refresh_token)<20 or octet_length(p_refresh_token)>65536 or p_refresh_token ~ '[[:space:]]'))
    or ((p_access_expires_at is null) is distinct from (p_refresh_token is null))
    or ((p_refresh_expires_at is null) is distinct from (p_refresh_token is null))
    or (p_access_expires_at is not null and
      (p_access_expires_at<=clock_timestamp() or p_access_expires_at>clock_timestamp()+interval '1 day'))
    or (p_refresh_expires_at is not null and
      (p_refresh_expires_at<=p_access_expires_at or p_refresh_expires_at>clock_timestamp()+interval '200 days'))
    or p_custody_expires_at is null or p_custody_expires_at<=clock_timestamp()
    or p_custody_expires_at>clock_timestamp()+interval '200 days'
    or (p_refresh_expires_at is not null and p_custody_expires_at>p_refresh_expires_at) then
    raise exception 'GitHub binding unavailable';
  end if;
  v_connection_version:=public.website_record_infrastructure_connection(
    p_connection_id,p_project_id,p_owner_id,p_expected_version,'github',p_environment,
    p_account_id,p_repository_id,array['contents:write'],'connected',null,clock_timestamp(),p_operation_id
  );
  delete from private.website_github_oauth_custody where connection_id=p_connection_id;
  v_payload:=jsonb_build_object('accessToken',p_access_token,'refreshToken',p_refresh_token)::text;
  v_name:='website_github_oauth_' || p_connection_id::text;
  v_secret_id:=vault.create_secret(v_payload,v_name,'Customer GitHub App user grant',null);
  insert into private.website_github_oauth_custody
    (connection_id,project_id,owner_id,environment,account_id,installation_id,repository_id,
     repository_full_name,default_branch,secret_id,connection_version,version,last_operation_id,
     access_expires_at,refresh_expires_at,custody_expires_at)
  values (p_connection_id,p_project_id,p_owner_id,p_environment,p_account_id,p_installation_id,
    p_repository_id,p_repository_full_name,p_default_branch,v_secret_id,v_connection_version,1,p_operation_id,
    p_access_expires_at,p_refresh_expires_at,p_custody_expires_at);
  return v_connection_version;
end $$;
revoke all on function public.website_bind_github_repository(uuid,uuid,uuid,bigint,text,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.website_bind_github_repository(uuid,uuid,uuid,bigint,text,text,text,text,text,text,text,text,timestamptz,timestamptz,timestamptz,uuid) to service_role;

create function public.website_reconcile_github_repository_binding(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_version bigint,
  p_installation_id text,p_repository_id text,p_operation_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select c.version from private.website_infrastructure_connections c
  join private.website_github_oauth_custody g on g.connection_id=c.id
  join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='github' and c.target_id=p_repository_id
    and c.status='connected' and c.version=p_expected_version+1 and c.last_commit_id=p_operation_id
    and g.connection_version=c.version and g.account_id=c.account_id and g.repository_id=c.target_id
    and g.installation_id=p_installation_id and g.last_operation_id=p_operation_id
    and g.custody_expires_at>clock_timestamp();
$$;
revoke all on function public.website_reconcile_github_repository_binding(uuid,uuid,uuid,bigint,text,text,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_github_repository_binding(uuid,uuid,uuid,bigint,text,text,uuid) to service_role;

create function public.website_read_github_oauth_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object('version',g.version,'accountId',g.account_id,
    'installationId',g.installation_id,'repositoryId',g.repository_id,
    'repositoryFullName',g.repository_full_name,'defaultBranch',g.default_branch,
    'environment',g.environment,'accessExpiresAt',g.access_expires_at,
    'refreshExpiresAt',g.refresh_expires_at,'custodyExpiresAt',g.custody_expires_at,
    'grant',d.decrypted_secret::jsonb)
  into v_result from private.website_github_oauth_custody g
  join private.website_infrastructure_connections c on c.id=g.connection_id
  join public.projects p on p.id=g.project_id
  join vault.decrypted_secrets d on d.id=g.secret_id
  where g.connection_id=p_connection_id and g.project_id=p_project_id and g.owner_id=p_owner_id
    and g.connection_version=p_expected_connection_version and g.custody_expires_at>clock_timestamp()
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.project_id=g.project_id and c.owner_id=g.owner_id and c.provider='github'
    and c.version=g.connection_version and c.account_id=g.account_id and c.target_id=g.repository_id
    and c.environment=g.environment and c.status in ('connected','setup-incomplete','deployment-failed','ready');
  return v_result;
end $$;
revoke all on function public.website_read_github_oauth_custody(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.website_read_github_oauth_custody(uuid,uuid,uuid,bigint) to service_role;

create function public.website_refresh_github_oauth_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
  p_expected_version bigint,p_access_token text,p_refresh_token text,
  p_access_expires_at timestamptz,p_refresh_expires_at timestamptz,
  p_custody_expires_at timestamptz,p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_custody private.website_github_oauth_custody%rowtype; v_name text; v_payload text;
begin
  if p_expected_version is null or p_expected_version<1 or p_operation_id is null
    or p_access_token is null or length(p_access_token)<20 or octet_length(p_access_token)>65536
    or p_access_token ~ '[[:space:]]'
    or p_refresh_token is null or length(p_refresh_token)<20 or octet_length(p_refresh_token)>65536
    or p_refresh_token ~ '[[:space:]]'
    or p_access_expires_at is null or p_access_expires_at<=clock_timestamp()
    or p_access_expires_at>clock_timestamp()+interval '1 day'
    or p_refresh_expires_at is null or p_refresh_expires_at<=p_access_expires_at
    or p_refresh_expires_at>clock_timestamp()+interval '200 days'
    or p_custody_expires_at is null or p_custody_expires_at<=clock_timestamp()
    or p_custody_expires_at>p_refresh_expires_at then
    raise exception 'GitHub OAuth custody changed';
  end if;
  select g.* into v_custody from private.website_github_oauth_custody g
  join private.website_infrastructure_connections c on c.id=g.connection_id
  join public.projects p on p.id=g.project_id
  where g.connection_id=p_connection_id and g.project_id=p_project_id and g.owner_id=p_owner_id
    and g.connection_version=p_expected_connection_version and g.version=p_expected_version
    and g.custody_expires_at>clock_timestamp()
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='github' and c.version=g.connection_version and c.account_id=g.account_id
    and c.target_id=g.repository_id and c.environment=g.environment
    and c.status in ('connected','setup-incomplete','deployment-failed','ready')
  for update;
  if not found then raise exception 'GitHub OAuth custody changed'; end if;
  v_payload:=jsonb_build_object('accessToken',p_access_token,'refreshToken',p_refresh_token)::text;
  v_name:='website_github_oauth_' || p_connection_id::text;
  perform vault.update_secret(v_custody.secret_id,v_payload,v_name,'Customer GitHub App user grant',null);
  update private.website_github_oauth_custody set version=version+1,last_operation_id=p_operation_id,
    access_expires_at=p_access_expires_at,refresh_expires_at=p_refresh_expires_at,
    custody_expires_at=p_custody_expires_at,updated_at=clock_timestamp()
  where connection_id=p_connection_id;
  return p_expected_version+1;
end $$;
revoke all on function public.website_refresh_github_oauth_custody(uuid,uuid,uuid,bigint,bigint,text,text,timestamptz,timestamptz,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.website_refresh_github_oauth_custody(uuid,uuid,uuid,bigint,bigint,text,text,timestamptz,timestamptz,timestamptz,uuid) to service_role;

create function public.website_reconcile_github_oauth_refresh(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
  p_expected_version bigint,p_operation_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select g.version from private.website_github_oauth_custody g
  join private.website_infrastructure_connections c on c.id=g.connection_id
  join public.projects p on p.id=g.project_id
  where g.connection_id=p_connection_id and g.project_id=p_project_id and g.owner_id=p_owner_id
    and g.connection_version=p_expected_connection_version and g.version=p_expected_version+1
    and g.last_operation_id=p_operation_id and g.custody_expires_at>clock_timestamp()
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='github' and c.version=g.connection_version and c.account_id=g.account_id
    and c.target_id=g.repository_id and c.environment=g.environment;
$$;
revoke all on function public.website_reconcile_github_oauth_refresh(uuid,uuid,uuid,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_github_oauth_refresh(uuid,uuid,uuid,bigint,bigint,uuid) to service_role;

create function public.website_delete_github_oauth_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then return false; end if;
  delete from private.website_github_oauth_custody g
  using private.website_infrastructure_connections c
  where g.connection_id=p_connection_id and g.project_id=p_project_id and g.owner_id=p_owner_id
    and c.id=g.connection_id and c.provider='github' and c.version=p_expected_connection_version;
  return found;
end $$;
revoke all on function public.website_delete_github_oauth_custody(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.website_delete_github_oauth_custody(uuid,uuid,uuid,bigint) to service_role;

create function public.website_cleanup_expired_github_oauth_custody()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from private.website_github_oauth_custody where custody_expires_at<=clock_timestamp();
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function public.website_cleanup_expired_github_oauth_custody() from public, anon, authenticated;
grant execute on function public.website_cleanup_expired_github_oauth_custody() to service_role;
