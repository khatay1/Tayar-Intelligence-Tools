-- Source-only BYO setup credential custody. Never place these grants in the
-- editable project, public connection registry, GitHub or customer runtime.
create table private.website_supabase_oauth_custody (
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check (environment in ('preview','production')),
  account_id text not null,
  organization_id text not null,
  organization_slug text not null,
  project_ref text not null check (project_ref ~ '^[a-z]{20}$'),
  secret_id uuid not null unique,
  connection_version bigint not null check (connection_version > 0),
  version bigint not null check (version > 0),
  last_operation_id uuid not null unique,
  access_expires_at timestamptz not null,
  custody_expires_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);
create index website_supabase_oauth_custody_expiry_idx
  on private.website_supabase_oauth_custody(custody_expires_at);
alter table private.website_supabase_oauth_custody enable row level security;
revoke all on private.website_supabase_oauth_custody from public, anon, authenticated;

create function private.website_supabase_oauth_custody_cleanup() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from vault.secrets where id=old.secret_id;
  return old;
end $$;
revoke all on function private.website_supabase_oauth_custody_cleanup() from public, anon, authenticated;
create trigger website_supabase_oauth_custody_cleanup
after delete on private.website_supabase_oauth_custody for each row
execute function private.website_supabase_oauth_custody_cleanup();

-- The trusted worker must first verify the OAuth profile, organization Owner,
-- selected project and current Tayar connection. Every update is version-CAS.
create function public.website_store_supabase_oauth_custody(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid, p_expected_connection_version bigint,
  p_expected_version bigint, p_account_id text, p_organization_id text,
  p_organization_slug text, p_project_ref text, p_access_token text,
  p_refresh_token text, p_access_expires_at timestamptz,
  p_custody_expires_at timestamptz, p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_connection private.website_infrastructure_connections%rowtype;
  v_custody private.website_supabase_oauth_custody%rowtype; v_secret_id uuid;
  v_name text; v_payload text; v_exists boolean;
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project unavailable'; end if;
  select * into v_connection from private.website_infrastructure_connections
    where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
      and provider='supabase' for update;
  if not found or v_connection.environment not in ('preview','production')
    or v_connection.account_id is distinct from p_account_id
    or v_connection.target_id is distinct from p_project_ref
    or v_connection.version is distinct from p_expected_connection_version
    or v_connection.status not in ('connected','setup-incomplete','outdated-schema','ready')
    or p_expected_version is null or p_expected_version < 0 or p_operation_id is null
    or p_organization_id is null or p_organization_id !~ '^[a-zA-Z0-9_-]{1,200}$'
    or p_organization_slug is null or p_organization_slug !~ '^[a-z0-9][a-z0-9-]{0,199}$'
    or p_project_ref is null or p_project_ref !~ '^[a-z]{20}$'
    or p_access_token is null or length(p_access_token) < 20 or octet_length(p_access_token) > 4096
    or p_refresh_token is null or length(p_refresh_token) < 20 or octet_length(p_refresh_token) > 4096
    or p_access_expires_at is null or p_access_expires_at <= clock_timestamp()
    or p_access_expires_at > clock_timestamp() + interval '1 day'
    or p_custody_expires_at is null or p_custody_expires_at <= clock_timestamp()
    or p_custody_expires_at > clock_timestamp() + interval '30 days' then
    raise exception 'OAuth custody scope changed';
  end if;
  select * into v_custody from private.website_supabase_oauth_custody
    where connection_id=p_connection_id for update;
  v_exists:=found;
  v_payload:=jsonb_build_object('accessToken',p_access_token,'refreshToken',p_refresh_token)::text;
  v_name:='website_supabase_oauth_' || p_connection_id::text;
  if p_expected_version=0 then
    if v_exists then raise exception 'OAuth custody changed'; end if;
    v_secret_id:=vault.create_secret(v_payload,v_name,'Temporary customer Supabase setup grant',null);
    insert into private.website_supabase_oauth_custody
      (connection_id,project_id,owner_id,environment,account_id,organization_id,
       organization_slug,project_ref,secret_id,connection_version,version,last_operation_id,
       access_expires_at,custody_expires_at)
    values (p_connection_id,p_project_id,p_owner_id,v_connection.environment,p_account_id,p_organization_id,
      p_organization_slug,p_project_ref,v_secret_id,p_expected_connection_version,1,p_operation_id,
      p_access_expires_at,p_custody_expires_at);
    return 1;
  end if;
  if not v_exists or v_custody.version<>p_expected_version or v_custody.owner_id<>p_owner_id
    or v_custody.project_id<>p_project_id or v_custody.environment<>v_connection.environment
    or v_custody.account_id<>p_account_id or v_custody.organization_id<>p_organization_id
    or v_custody.organization_slug<>p_organization_slug or v_custody.project_ref<>p_project_ref
    or v_custody.custody_expires_at<=clock_timestamp() then
    raise exception 'OAuth custody changed';
  end if;
  perform vault.update_secret(v_custody.secret_id,v_payload,v_name,'Temporary customer Supabase setup grant',null);
  update private.website_supabase_oauth_custody set version=version+1,
    connection_version=p_expected_connection_version,last_operation_id=p_operation_id,
    access_expires_at=p_access_expires_at,custody_expires_at=p_custody_expires_at,
    updated_at=clock_timestamp() where connection_id=p_connection_id;
  return p_expected_version+1;
end $$;
revoke all on function public.website_store_supabase_oauth_custody(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text,text,timestamptz,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.website_store_supabase_oauth_custody(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text,text,timestamptz,timestamptz,uuid) to service_role;

create function public.website_read_supabase_oauth_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object('version',s.version,'accountId',s.account_id,
    'organizationId',s.organization_id,'organizationSlug',s.organization_slug,
    'projectRef',s.project_ref,'environment',s.environment,
    'accessExpiresAt',s.access_expires_at,'custodyExpiresAt',s.custody_expires_at,
    'grant',d.decrypted_secret::jsonb)
  into v_result from private.website_supabase_oauth_custody s
  join private.website_infrastructure_connections c on c.id=s.connection_id
  join public.projects p on p.id=s.project_id
  join vault.decrypted_secrets d on d.id=s.secret_id
  where s.connection_id=p_connection_id and s.project_id=p_project_id and s.owner_id=p_owner_id
    and s.connection_version=p_expected_connection_version and s.custody_expires_at>clock_timestamp()
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.project_id=s.project_id and c.owner_id=s.owner_id and c.provider='supabase'
    and c.version=s.connection_version and c.account_id=s.account_id and c.target_id=s.project_ref
    and c.environment=s.environment and c.status in ('connected','setup-incomplete','outdated-schema','ready');
  return v_result;
end $$;
revoke all on function public.website_read_supabase_oauth_custody(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.website_read_supabase_oauth_custody(uuid,uuid,uuid,bigint) to service_role;

-- Reconcile only metadata after a lost SQL response; never return tokens here.
create function public.website_reconcile_supabase_oauth_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
  p_expected_version bigint,p_operation_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select s.version from private.website_supabase_oauth_custody s
  join private.website_infrastructure_connections c on c.id=s.connection_id
  join public.projects p on p.id=s.project_id
  where s.connection_id=p_connection_id and s.project_id=p_project_id and s.owner_id=p_owner_id
    and s.connection_version=p_expected_connection_version and s.version=p_expected_version+1
    and s.last_operation_id=p_operation_id and s.custody_expires_at>clock_timestamp()
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.project_id=s.project_id and c.owner_id=s.owner_id and c.provider='supabase'
    and c.version=s.connection_version and c.account_id=s.account_id and c.target_id=s.project_ref
    and c.environment=s.environment;
$$;
revoke all on function public.website_reconcile_supabase_oauth_custody(uuid,uuid,uuid,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_supabase_oauth_custody(uuid,uuid,uuid,bigint,bigint,uuid) to service_role;

create function public.website_delete_supabase_oauth_custody(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint
) returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then return false; end if;
  delete from private.website_supabase_oauth_custody s using private.website_infrastructure_connections c
  where s.connection_id=p_connection_id and s.project_id=p_project_id and s.owner_id=p_owner_id
    and c.id=s.connection_id
    and c.project_id=s.project_id and c.owner_id=s.owner_id and c.provider='supabase'
    and c.version=p_expected_connection_version;
  return found;
end $$;
revoke all on function public.website_delete_supabase_oauth_custody(uuid,uuid,uuid,bigint) from public, anon, authenticated;
grant execute on function public.website_delete_supabase_oauth_custody(uuid,uuid,uuid,bigint) to service_role;

-- Expiry is enforced on reads even without a scheduler. The trusted cleanup
-- worker must call this periodically to erase expired Vault material.
create function public.website_cleanup_expired_supabase_oauth_custody()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  delete from private.website_supabase_oauth_custody where custody_expires_at<=clock_timestamp();
  get diagnostics v_count=row_count;
  return v_count;
end $$;
revoke all on function public.website_cleanup_expired_supabase_oauth_custody() from public, anon, authenticated;
grant execute on function public.website_cleanup_expired_supabase_oauth_custody() to service_role;
