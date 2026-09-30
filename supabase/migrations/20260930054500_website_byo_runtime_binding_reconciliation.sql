-- Service-only selection keeps provider identities out of browser requests.
-- Live provider verifiers consume the leased custody records separately.
create function public.website_byo_runtime_setup_targets(
 p_project_id uuid,p_owner_id uuid,p_environment text
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'supabase',jsonb_build_object('connectionId',s.id,'version',s.version,'projectRef',s.target_id),
  'vercel',jsonb_build_object('connectionId',v.id,'version',v.version,'projectId',v.target_id))
 from public.projects p
 join private.website_infrastructure_connections s on s.project_id=p.id
 join private.website_supabase_oauth_custody sc on sc.connection_id=s.id
 join private.website_infrastructure_connections v on v.project_id=p.id
 join private.website_vercel_integration_custody vc on vc.connection_id=v.id
 where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p_environment in('preview','production')
  and s.owner_id=p_owner_id and s.provider='supabase' and s.environment=p_environment
  and s.status='ready' and s.target_id~'^[a-z]{20}$' and s.verified_at is not null
  and sc.project_id=p.id and sc.owner_id=p_owner_id and sc.environment=p_environment
  and sc.connection_version=s.version and sc.account_id=s.account_id and sc.project_ref=s.target_id
  and sc.access_expires_at>clock_timestamp() and sc.custody_expires_at>clock_timestamp()
  and v.owner_id=p_owner_id and v.provider='vercel' and v.environment=p_environment
  and v.status in('connected','setup-incomplete','deployment-failed','ready')
  and v.target_id~'^prj_[A-Za-z0-9]{8,128}$' and v.verified_at is not null
  and vc.project_id=p.id and vc.owner_id=p_owner_id and vc.environment=p_environment
  and vc.connection_version=v.version and vc.account_id=v.account_id and vc.vercel_project_id=v.target_id
  and vc.custody_expires_at>clock_timestamp()
$$;
revoke all on function public.website_byo_runtime_setup_targets(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.website_byo_runtime_setup_targets(uuid,uuid,text) to service_role;

-- A write response can be lost after commit. Reconcile only the exact operation,
-- next CAS version, saved Application definition and every observed target field.
create function public.website_reconcile_byo_runtime_binding(
 p_project_id uuid,p_owner_id uuid,p_environment text,p_expected_version bigint,
 p_supabase_connection_id uuid,p_supabase_connection_version bigint,
 p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_application_origin text,p_publishable_key text,p_application_definition jsonb,p_commit_id uuid
) returns bigint language sql stable security definer set search_path='' as $$
 select b.version from private.website_byo_runtime_bindings b
 join public.projects p on p.id=b.project_id
 join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
 where b.project_id=p_project_id and b.owner_id=p_owner_id and b.environment=p_environment
  and b.version=p_expected_version+1 and b.last_commit_id=p_commit_id
  and b.supabase_connection_id=p_supabase_connection_id
  and b.supabase_connection_version=p_supabase_connection_version
  and b.vercel_connection_id=p_vercel_connection_id
  and b.vercel_connection_version=p_vercel_connection_version
  and b.application_origin=p_application_origin and b.publishable_key=p_publishable_key
  and b.application_definition=p_application_definition
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p.content->'application'=b.application_definition
  and s.project_id=b.project_id and s.owner_id=b.owner_id and s.provider='supabase'
  and s.environment=b.environment and s.version=b.supabase_connection_version
  and s.status='ready' and s.target_id~'^[a-z]{20}$'
  and v.project_id=b.project_id and v.owner_id=b.owner_id and v.provider='vercel'
  and v.environment=b.environment and v.version=b.vercel_connection_version
  and v.status in('connected','setup-incomplete','deployment-failed','ready')
$$;
revoke all on function public.website_reconcile_byo_runtime_binding(uuid,uuid,text,bigint,uuid,bigint,uuid,bigint,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_reconcile_byo_runtime_binding(uuid,uuid,text,bigint,uuid,bigint,uuid,bigint,text,text,jsonb,uuid) to service_role;
