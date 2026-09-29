-- Disconnect one Tayar project without uninstalling the customer's account-wide
-- Vercel Integration configuration, which may be shared by other projects.
create function public.website_disconnect_vercel_connection(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,
  p_expected_version bigint,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_version bigint;
begin
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found or p_connection_id is null or p_expected_version is null
    or p_expected_version<1 or p_commit_id is null then raise exception 'Project unavailable'; end if;
  update private.website_infrastructure_connections set
    status='disconnected',target_id=null,permissions='{}'::text[],verified_at=null,
    operation_id=null,version=version+1,last_commit_id=p_commit_id,updated_at=clock_timestamp()
  where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
    and provider='vercel' and version=p_expected_version and status<>'disconnected'
  returning version into v_version;
  if v_version is null then raise exception 'Vercel connection changed'; end if;
  delete from private.website_vercel_integration_custody
  where connection_id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id;
  return v_version;
end $$;
revoke all on function public.website_disconnect_vercel_connection(uuid,uuid,uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_disconnect_vercel_connection(uuid,uuid,uuid,bigint,uuid) to service_role;

-- A retry after a lost SQL response recognizes only the exact next version and
-- commit, and also requires that Vault custody is already gone.
create function public.website_reconcile_vercel_disconnect(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,
  p_expected_version bigint,p_commit_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select c.version from private.website_infrastructure_connections c
  join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='vercel' and c.status='disconnected' and c.target_id is null
    and cardinality(c.permissions)=0 and c.verified_at is null and c.operation_id is null
    and c.version=p_expected_version+1 and c.last_commit_id=p_commit_id
    and not exists (select 1 from private.website_vercel_integration_custody v
      where v.connection_id=c.id);
$$;
revoke all on function public.website_reconcile_vercel_disconnect(uuid,uuid,uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_vercel_disconnect(uuid,uuid,uuid,bigint,uuid) to service_role;

