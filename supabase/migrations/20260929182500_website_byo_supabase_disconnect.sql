-- Atomically sever a customer Supabase binding and erase its temporary OAuth
-- custody. Provider revocation is attempted by the trusted worker first.
create table private.website_supabase_disconnect_attempts (
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null, owner_id uuid not null, expected_version bigint not null,
  commit_id uuid not null unique, started_at timestamptz not null default clock_timestamp()
);
alter table private.website_supabase_disconnect_attempts enable row level security;
revoke all on private.website_supabase_disconnect_attempts from public, anon, authenticated;

-- The durable attempt is created before the non-idempotent provider POST.
-- A lost prepare response or crash causes the retry to skip provider revocation.
create function public.website_begin_supabase_disconnect(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid,
  p_expected_version bigint, p_commit_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_attempt private.website_supabase_disconnect_attempts%rowtype;
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found or p_connection_id is null or p_expected_version is null
    or p_expected_version < 1 or p_commit_id is null then raise exception 'Project unavailable'; end if;
  perform 1 from private.website_infrastructure_connections
  where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
    and provider='supabase' and version=p_expected_version and status<>'disconnected' for update;
  if not found then raise exception 'Supabase connection changed'; end if;
  delete from private.website_supabase_disconnect_attempts
  where connection_id=p_connection_id and expected_version<>p_expected_version;
  select * into v_attempt from private.website_supabase_disconnect_attempts
    where connection_id=p_connection_id for update;
  if found then
    if v_attempt.project_id<>p_project_id or v_attempt.owner_id<>p_owner_id
      or v_attempt.expected_version<>p_expected_version or v_attempt.commit_id<>p_commit_id then
      raise exception 'Supabase disconnect changed';
    end if;
    return false;
  end if;
  insert into private.website_supabase_disconnect_attempts
    (connection_id,project_id,owner_id,expected_version,commit_id)
  values (p_connection_id,p_project_id,p_owner_id,p_expected_version,p_commit_id);
  return true;
end $$;
revoke all on function public.website_begin_supabase_disconnect(uuid,uuid,uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_begin_supabase_disconnect(uuid,uuid,uuid,bigint,uuid) to service_role;

create function public.website_disconnect_supabase_connection(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid,
  p_expected_version bigint, p_commit_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_version bigint;
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found or p_connection_id is null or p_expected_version is null
    or p_expected_version < 1 or p_commit_id is null then
    raise exception 'Project unavailable';
  end if;
  perform 1 from private.website_supabase_disconnect_attempts
  where connection_id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
    and expected_version=p_expected_version and commit_id=p_commit_id for update;
  if not found then raise exception 'Supabase disconnect attempt unavailable'; end if;
  update private.website_infrastructure_connections set
    status='disconnected', target_id=null, permissions='{}'::text[],
    verified_at=null, operation_id=null, version=version+1,
    last_commit_id=p_commit_id, updated_at=clock_timestamp()
  where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
    and provider='supabase' and version=p_expected_version
  returning version into v_version;
  if v_version is null then raise exception 'Supabase connection changed'; end if;
  delete from private.website_supabase_oauth_custody
  where connection_id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id;
  delete from private.website_supabase_disconnect_attempts
  where connection_id=p_connection_id and commit_id=p_commit_id;
  return v_version;
end $$;
revoke all on function public.website_disconnect_supabase_connection(uuid,uuid,uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_disconnect_supabase_connection(uuid,uuid,uuid,bigint,uuid) to service_role;

-- Resolve a lost database response only for the exact disconnect operation.
create function public.website_reconcile_supabase_disconnect(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid,
  p_expected_version bigint, p_commit_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select c.version from private.website_infrastructure_connections c
  join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='supabase' and c.status='disconnected' and c.target_id is null
    and c.version=p_expected_version+1 and c.last_commit_id=p_commit_id
    and not exists (select 1 from private.website_supabase_oauth_custody s
      where s.connection_id=c.id);
$$;
revoke all on function public.website_reconcile_supabase_disconnect(uuid,uuid,uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_supabase_disconnect(uuid,uuid,uuid,bigint,uuid) to service_role;
