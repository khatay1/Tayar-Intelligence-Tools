-- Read-only, service-selected staging target. No provider grant or source body.
create function public.website_production_staging_target(p_operation_id uuid,p_project_id uuid,p_owner_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('scope',t.scope,'vercelConnectionId',e.vercel_connection_id,
  'vercelConnectionVersion',e.vercel_connection_version)
 from private.website_production_source_candidates c
 join private.website_vercel_runtime_environment_receipts e on e.project_id=c.project_id and e.owner_id=c.owner_id and e.environment='production'
 join private.website_vercel_integration_custody vc on vc.connection_id=e.vercel_connection_id
 cross join lateral(select jsonb_build_object('candidate',private.website_production_source_candidate_json(c),
  'accountId',vc.account_id,'projectId',vc.vercel_project_id,'repositoryId',vc.repository_id,
  'sourceBranch','tayar/'||c.project_id::text||'/production',
  'runtimeEnvironmentReceiptVersion',e.version,'runtimeEnvironmentIds',e.vercel_environment_ids) as scope) t
 where c.operation_id=p_operation_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and private.website_production_staging_scope_current(p_operation_id,p_project_id,p_owner_id,t.scope);
$$;
revoke all on function public.website_production_staging_target(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_production_staging_target(uuid,uuid,uuid) to service_role;
