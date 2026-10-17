-- Private one-shot claim, not a deployment/runtime/delivery approval.
create table private.website_production_staging_claims (
 operation_id uuid primary key references private.website_production_source_candidates(operation_id) on delete cascade,
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 deployment_id text check(deployment_id~'^dpl_[A-Za-z0-9]{8,128}$'),
 claimed_at timestamptz not null default clock_timestamp()
);
alter table private.website_production_staging_claims enable row level security;
revoke all on private.website_production_staging_claims from public,anon,authenticated,service_role;

create function private.website_production_staging_scope_current(p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_scope jsonb)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.website_production_source_candidates c
 join private.website_vercel_runtime_environment_receipts e on e.project_id=c.project_id and e.owner_id=c.owner_id and e.environment='production'
 join private.website_vercel_integration_custody vc on vc.connection_id=e.vercel_connection_id
 where c.operation_id=p_operation_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and c.scope=private.website_production_source_scope(c.project_id,c.owner_id,c.preview_operation_id,c.github_connection_id)
  and private.website_production_source_candidate_json(c)=p_scope->'candidate'
  and (select array_agg(k order by k) from jsonb_object_keys(p_scope) k)
   =array['accountId','candidate','projectId','repositoryId','runtimeEnvironmentIds','runtimeEnvironmentReceiptVersion','sourceBranch']
  and e.status='verified' and e.superseded_environment_ids is null
  and private.website_production_runtime_receipt_current(e)
  and e.version::text=p_scope->>'runtimeEnvironmentReceiptVersion'
  and e.vercel_environment_ids=p_scope->'runtimeEnvironmentIds'
  and jsonb_typeof(p_scope->'runtimeEnvironmentReceiptVersion')='number'
  and jsonb_typeof(p_scope->'runtimeEnvironmentIds')='object'
  and vc.account_id=p_scope->>'accountId' and vc.vercel_project_id=p_scope->>'projectId'
  and vc.repository_id=p_scope->>'repositoryId'
  and p_scope->>'sourceBranch'='tayar/'||c.project_id::text||'/production'
  and vc.production_branch<>p_scope->>'sourceBranch'
  and vc.project_id=c.project_id and vc.owner_id=c.owner_id and vc.environment='production'
  and vc.custody_expires_at>clock_timestamp());
$$;
revoke all on function private.website_production_staging_scope_current(uuid,uuid,uuid,jsonb) from public,anon,authenticated,service_role;

create function private.website_lock_production_staging_scope(p_operation_id uuid,p_project_id uuid,p_owner_id uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.projects where id=p_project_id and user_id=p_owner_id for share;
 perform c.id from private.website_infrastructure_connections c where c.project_id=p_project_id and c.owner_id=p_owner_id order by c.id for share;
 perform 1 from private.website_byo_runtime_bindings where project_id=p_project_id and owner_id=p_owner_id order by environment for share;
 perform 1 from private.website_github_export_cursors where project_id=p_project_id and owner_id=p_owner_id order by connection_id for share;
 perform 1 from private.website_byo_publish_operations where project_id=p_project_id and owner_id=p_owner_id order by operation_id for share;
 perform 1 from private.website_production_source_candidates where operation_id=p_operation_id for share;
 perform 1 from private.website_vercel_runtime_environment_receipts where project_id=p_project_id and owner_id=p_owner_id and environment='production' for share;
 perform 1 from private.website_vercel_integration_custody where project_id=p_project_id and owner_id=p_owner_id order by connection_id for share;
end $$;
revoke all on function private.website_lock_production_staging_scope(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function public.website_claim_production_staging(p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_scope jsonb)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare v private.website_production_staging_claims%rowtype;v_claimed uuid;
begin
 if p_operation_id is null or p_project_id is null or p_owner_id is null or p_scope is null
  or jsonb_typeof(p_scope)<>'object' or octet_length(p_scope::text)>16384 then raise exception 'Production staging unavailable';end if;
 perform private.website_lock_production_staging_scope(p_operation_id,p_project_id,p_owner_id);
 if not private.website_production_staging_scope_current(p_operation_id,p_project_id,p_owner_id,p_scope)
  then raise exception 'Production staging changed';end if;
 insert into private.website_production_staging_claims(operation_id,scope) values(p_operation_id,p_scope)
  on conflict(operation_id) do nothing returning operation_id into v_claimed;
 select * into v from private.website_production_staging_claims where operation_id=p_operation_id for update;
 if not found or v.scope<>p_scope then raise exception 'Production staging changed';end if;
 return jsonb_build_object('issueCreate',v_claimed is not null,'deploymentId',v.deployment_id);
end $$;
revoke all on function public.website_claim_production_staging(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.website_claim_production_staging(uuid,uuid,uuid,jsonb) to service_role;

create function public.website_record_production_staging(p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_scope jsonb,p_deployment_id text)
returns text language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare v private.website_production_staging_claims%rowtype;
begin
 if p_operation_id is null or p_project_id is null or p_owner_id is null or p_scope is null
  or jsonb_typeof(p_scope)<>'object' or octet_length(p_scope::text)>16384
  or p_deployment_id is null or p_deployment_id!~'^dpl_[A-Za-z0-9]{8,128}$' then raise exception 'Production staging unavailable';end if;
 perform private.website_lock_production_staging_scope(p_operation_id,p_project_id,p_owner_id);
 if not private.website_production_staging_scope_current(p_operation_id,p_project_id,p_owner_id,p_scope)
  then raise exception 'Production staging changed';end if;
 select * into v from private.website_production_staging_claims where operation_id=p_operation_id for update;
 if not found or v.scope<>p_scope or v.deployment_id is not null and v.deployment_id<>p_deployment_id
  then raise exception 'Production staging changed';end if;
 if v.deployment_id is null then update private.website_production_staging_claims set deployment_id=p_deployment_id where operation_id=p_operation_id;end if;
 return p_deployment_id;
end $$;
revoke all on function public.website_record_production_staging(uuid,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.website_record_production_staging(uuid,uuid,uuid,jsonb,text) to service_role;
