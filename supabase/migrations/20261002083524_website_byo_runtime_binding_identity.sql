-- Add immutable CAS identities to the service-only Publish projection. The
-- public/browser roles retain no execute access and no credential is exposed.
create or replace function public.website_byo_runtime_binding_for_worker(
 p_project_id uuid,p_owner_id uuid,p_environment text
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('projectId',b.project_id,'ownerId',b.owner_id,'environment',b.environment,
  'bindingVersion',b.version,'supabaseConnectionId',b.supabase_connection_id,
  'supabaseConnectionVersion',b.supabase_connection_version,'vercelConnectionId',b.vercel_connection_id,
  'vercelConnectionVersion',b.vercel_connection_version,'applicationOrigin',b.application_origin,
  'backend',jsonb_build_object('url','https://'||s.target_id||'.supabase.co','projectRef',s.target_id,
   'publishableKey',b.publishable_key))
 from private.website_byo_runtime_bindings b
 join public.projects p on p.id=b.project_id
 join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
 where b.project_id=p_project_id and b.owner_id=p_owner_id and b.environment=p_environment
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p.content->'application'=b.application_definition
  and b.version>0 and s.project_id=b.project_id and s.owner_id=b.owner_id and s.provider='supabase'
  and s.environment=b.environment and s.version=b.supabase_connection_version and s.status='ready'
  and s.target_id~'^[a-z0-9]{20}$' and s.verified_at is not null
  and v.project_id=b.project_id and v.owner_id=b.owner_id and v.provider='vercel'
  and v.environment=b.environment and v.version=b.vercel_connection_version
  and v.status in('connected','setup-incomplete','deployment-failed','ready')and v.verified_at is not null
$$;
revoke all on function public.website_byo_runtime_binding_for_worker(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.website_byo_runtime_binding_for_worker(uuid,uuid,text) to service_role;
