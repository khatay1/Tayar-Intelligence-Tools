-- One transaction binds observed customer metadata and encrypted setup grants.
-- Status is connected; schema/Auth/RLS checks must later promote it to ready.
create function public.website_bind_supabase_project(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid, p_expected_version bigint,
  p_environment text, p_account_id text, p_organization_id text,
  p_organization_slug text, p_project_ref text, p_access_token text,
  p_refresh_token text, p_access_expires_at timestamptz,
  p_custody_expires_at timestamptz, p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_connection_version bigint; v_custody_version bigint;
begin
  v_connection_version:=public.website_record_infrastructure_connection(
    p_connection_id,p_project_id,p_owner_id,p_expected_version,'supabase',
    p_environment,p_account_id,p_project_ref,
    array['projects:read','organizations:read','database:read'],
    'connected',null,clock_timestamp(),p_operation_id
  );
  -- A reconnect has no surviving custody because disconnect erases it.
  v_custody_version:=public.website_store_supabase_oauth_custody(
    p_connection_id,p_project_id,p_owner_id,v_connection_version,0,
    p_account_id,p_organization_id,p_organization_slug,p_project_ref,
    p_access_token,p_refresh_token,p_access_expires_at,p_custody_expires_at,p_operation_id
  );
  if v_custody_version<>1 then raise exception 'Supabase custody unavailable'; end if;
  return v_connection_version;
end $$;
revoke all on function public.website_bind_supabase_project(uuid,uuid,uuid,bigint,text,text,text,text,text,text,text,timestamptz,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.website_bind_supabase_project(uuid,uuid,uuid,bigint,text,text,text,text,text,text,text,timestamptz,timestamptz,uuid) to service_role;

-- Metadata-only reconciliation after a lost RPC response. Tokens never leave
-- custody, and both records must match the exact operation and next version.
create function public.website_reconcile_supabase_project_binding(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_version bigint,
  p_project_ref text,p_operation_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select c.version from private.website_infrastructure_connections c
  join private.website_supabase_oauth_custody s on s.connection_id=c.id
  join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='supabase' and c.target_id=p_project_ref and c.status='connected'
    and c.version=p_expected_version+1 and c.last_commit_id=p_operation_id
    and s.project_id=c.project_id and s.owner_id=c.owner_id
    and s.connection_version=c.version and s.project_ref=c.target_id
    and s.account_id=c.account_id and s.version=1
    and s.last_operation_id=p_operation_id and s.custody_expires_at>clock_timestamp();
$$;
revoke all on function public.website_reconcile_supabase_project_binding(uuid,uuid,uuid,bigint,text,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_supabase_project_binding(uuid,uuid,uuid,bigint,text,uuid) to service_role;
