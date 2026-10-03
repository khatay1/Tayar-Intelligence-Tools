-- Forward-only capacity alignment for already-migrated environments.
-- Historical migrations are also corrected for fresh installs, but deployed
-- databases need these CREATE OR REPLACE statements to receive the same limits.
--
-- OAuth provider tokens remain bounded to 64 KiB each. The temporary handoff
-- envelope is bounded to 128 KiB so a validated access+refresh grant can pass
-- from the callback into encrypted Vault custody without browser exposure.

create or replace function public.website_store_connection_handoff(
  p_id uuid, p_owner_id uuid, p_project_id uuid, p_provider text,
  p_environment text, p_token text, p_expires_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare v_secret_id uuid;
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project access denied'; end if;
  if p_id is null or p_provider is null or p_provider not in ('github','supabase','vercel','stripe')
    or p_environment is null or p_environment not in ('preview','production')
    or p_token is null or length(p_token) < 20 or octet_length(p_token) > 131072
    or p_expires_at is null or p_expires_at <= clock_timestamp()
    or p_expires_at > clock_timestamp() + interval '5 minutes' then
    raise exception 'Invalid connection handoff';
  end if;
  delete from private.website_connection_handoffs
    where project_id=p_project_id and expires_at <= clock_timestamp();
  if (select count(*) from private.website_connection_handoffs where project_id=p_project_id) >= 5 then
    raise exception 'Too many active connection handoffs';
  end if;
  v_secret_id:=vault.create_secret(p_token,'website_connection_handoff_' || p_id::text,
    'Temporary customer provider authorization',null);
  insert into private.website_connection_handoffs
    (id,owner_id,project_id,provider,environment,secret_id,expires_at)
  values (p_id,p_owner_id,p_project_id,p_provider,p_environment,v_secret_id,p_expires_at);
end $$;
revoke all on function public.website_store_connection_handoff(uuid,uuid,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.website_store_connection_handoff(uuid,uuid,uuid,text,text,text,timestamptz) to service_role;

create or replace function public.website_store_supabase_oauth_custody(
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
    or p_access_token is null or length(p_access_token) < 20 or octet_length(p_access_token) > 65536
    or p_refresh_token is null or length(p_refresh_token) < 20 or octet_length(p_refresh_token) > 65536
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
