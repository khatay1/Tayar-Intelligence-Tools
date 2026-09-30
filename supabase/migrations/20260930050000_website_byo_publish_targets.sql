-- Publish never accepts provider connection IDs from the browser. This
-- service-only projection selects the current customer-owned GitHub and
-- Vercel targets and proves both Vercel environments describe the same
-- repository/project before returning metadata to the trusted runner.
create function public.website_byo_publish_targets(
  p_project_id uuid,p_owner_id uuid
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_result jsonb;
begin
  if p_project_id is null or p_owner_id is null then return null; end if;
  select jsonb_build_object(
    'githubPreview',jsonb_build_object('connectionId',g.id,'version',g.version),
    'vercelPreview',jsonb_build_object('connectionId',vp.id,'version',vp.version),
    'vercelProduction',(select jsonb_build_object('connectionId',vr.id,'version',vr.version)
      from private.website_infrastructure_connections vr
      join private.website_vercel_integration_custody rvc on rvc.connection_id=vr.id
      where vr.project_id=g.project_id and vr.owner_id=g.owner_id
        and vr.provider='vercel' and vr.environment='production'
        and vr.status in('connected','setup-incomplete','deployment-failed','ready')
        and vr.target_id is not null and vr.verified_at is not null
        and rvc.project_id=vr.project_id and rvc.owner_id=vr.owner_id
        and rvc.environment=vr.environment and rvc.connection_version=vr.version
        and rvc.account_id=vr.account_id and rvc.vercel_project_id=vr.target_id
        and rvc.custody_expires_at>clock_timestamp()
        and pvc.account_id=rvc.account_id and pvc.vercel_project_id=rvc.vercel_project_id
        and pvc.repository_id=rvc.repository_id and pvc.repository_owner=rvc.repository_owner
        and pvc.repository_name=rvc.repository_name and pvc.production_branch=rvc.production_branch)
  ) into v_result
  from private.website_infrastructure_connections g
  join private.website_infrastructure_connections vp
    on vp.project_id=g.project_id and vp.owner_id=g.owner_id
  join private.website_vercel_integration_custody pvc on pvc.connection_id=vp.id
  join public.projects p on p.id=g.project_id
  where g.project_id=p_project_id and g.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and g.provider='github' and g.environment='preview'
    and g.status in('connected','ready') and g.target_id is not null and g.verified_at is not null
    and vp.provider='vercel' and vp.environment='preview'
    and vp.status in('connected','setup-incomplete','deployment-failed','ready')
    and vp.target_id is not null and vp.verified_at is not null
    and pvc.project_id=vp.project_id and pvc.owner_id=vp.owner_id
    and pvc.environment=vp.environment and pvc.connection_version=vp.version
    and pvc.account_id=vp.account_id and pvc.vercel_project_id=vp.target_id
    and pvc.repository_id=g.target_id and pvc.custody_expires_at>clock_timestamp();
  return v_result;
end $$;
revoke all on function public.website_byo_publish_targets(uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_byo_publish_targets(uuid,uuid) to service_role;
