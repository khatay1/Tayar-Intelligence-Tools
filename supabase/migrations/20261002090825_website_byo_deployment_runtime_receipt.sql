-- A Preview deployment attempt is valid only for the exact verified Vercel
-- runtime-environment receipt that existed before the source push.
alter table private.website_vercel_deployment_attempts
 add column runtime_environment_receipt_version bigint check(runtime_environment_receipt_version>0),
 add column runtime_environment_ids jsonb;

drop function public.website_begin_vercel_deployment_attempt(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text[],uuid);
create function public.website_begin_vercel_deployment_attempt(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_connection_version bigint,
 p_expected_attempt_version bigint,p_vercel_project_id text,p_repository_id text,
 p_source_commit_sha text,p_target text,p_required_environment text[],
 p_runtime_environment_receipt_version bigint,p_runtime_environment_ids jsonb,p_operation_id uuid
) returns bigint language plpgsql security definer set search_path='' as $$
declare a private.website_vercel_deployment_attempts%rowtype;v_item text;v_next bigint;
begin
 if p_operation_id is null or p_connection_version is null or p_connection_version<1
  or p_expected_attempt_version is null or p_expected_attempt_version<0
  or p_vercel_project_id!~'^prj_[A-Za-z0-9]{8,128}$' or p_repository_id!~'^[0-9]{1,30}$'
  or p_source_commit_sha!~'^[0-9a-f]{40}$' or p_target is distinct from 'preview'
  or p_required_environment is null or cardinality(p_required_environment)>64
  or p_runtime_environment_receipt_version is null or p_runtime_environment_receipt_version<1
  or p_runtime_environment_ids is null
  or jsonb_typeof(p_runtime_environment_ids)<>'object'
  then raise exception 'Invalid Vercel deployment attempt';end if;
 foreach v_item in array p_required_environment loop
  if v_item!~'^[A-Z][A-Z0-9_]{1,99}$' then raise exception 'Invalid environment name';end if;
 end loop;
 if cardinality(p_required_environment)<>(select count(distinct x)from unnest(p_required_environment)x)
  or p_required_environment<>(select coalesce(array_agg(x order by x),'{}')from unnest(p_required_environment)x)
  or (select array_agg(k order by k)from jsonb_object_keys(p_runtime_environment_ids)k)<>p_required_environment
  or exists(select 1 from jsonb_each_text(p_runtime_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or (select count(*)from jsonb_object_keys(p_runtime_environment_ids))<>(select count(distinct e.value)from jsonb_each_text(p_runtime_environment_ids)e)
  then raise exception 'Invalid runtime environment receipt';end if;
 perform 1 from private.website_infrastructure_connections c
 join private.website_vercel_integration_custody v on v.connection_id=c.id
 join private.website_vercel_runtime_environment_receipts e on e.project_id=c.project_id and e.environment='preview'
 join public.projects p on p.id=c.project_id
 where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.provider='vercel' and c.version=p_connection_version and c.target_id=p_vercel_project_id
  and c.environment='preview' and c.status in('connected','setup-incomplete','deployment-failed','ready')
  and v.connection_version=c.version and v.vercel_project_id=c.target_id and v.repository_id=p_repository_id
  and v.custody_expires_at>clock_timestamp()
  and e.owner_id=p_owner_id and e.binding_version>0 and e.vercel_connection_id=c.id
  and e.vercel_connection_version=c.version and e.vercel_project_id=c.target_id
  and e.git_branch='tayar/'||p_project_id::text||'/preview' and e.status='verified'
  and e.superseded_environment_ids is null and e.version=p_runtime_environment_receipt_version
  and e.vercel_environment_ids=p_runtime_environment_ids
 for update of c,e;
 if not found then raise exception 'Vercel runtime environment changed';end if;
 select * into a from private.website_vercel_deployment_attempts where connection_id=p_connection_id for update;
 if found and a.operation_id=p_operation_id then
  if a.project_id<>p_project_id or a.owner_id<>p_owner_id or a.connection_version<>p_connection_version
   or a.vercel_project_id<>p_vercel_project_id or a.repository_id<>p_repository_id
   or a.source_commit_sha<>p_source_commit_sha or a.target<>p_target
   or a.required_environment<>p_required_environment
   or a.runtime_environment_receipt_version<>p_runtime_environment_receipt_version
   or a.runtime_environment_ids<>p_runtime_environment_ids then raise exception 'Deployment attempt changed';end if;
  return a.version;
 end if;
 if p_expected_attempt_version=0 then
  if found then raise exception 'Deployment attempt changed';end if;
  insert into private.website_vercel_deployment_attempts(connection_id,project_id,owner_id,connection_version,
   vercel_project_id,repository_id,source_commit_sha,target,required_environment,
   runtime_environment_receipt_version,runtime_environment_ids,status,operation_id,version)
  values(p_connection_id,p_project_id,p_owner_id,p_connection_version,p_vercel_project_id,p_repository_id,
   p_source_commit_sha,p_target,p_required_environment,p_runtime_environment_receipt_version,
   p_runtime_environment_ids,'connecting',p_operation_id,1);return 1;
 end if;
 if not found or a.version<>p_expected_attempt_version or a.status='connecting' then raise exception 'Deployment attempt changed';end if;
 v_next:=a.version+1;
 update private.website_vercel_deployment_attempts set connection_version=p_connection_version,
  vercel_project_id=p_vercel_project_id,repository_id=p_repository_id,source_commit_sha=p_source_commit_sha,
  target=p_target,required_environment=p_required_environment,
  runtime_environment_receipt_version=p_runtime_environment_receipt_version,
  runtime_environment_ids=p_runtime_environment_ids,deployment_id=null,status='connecting',observed_state=null,
  missing_environment='{}'::text[],live_url=null,operation_id=p_operation_id,last_commit_id=null,
  version=v_next,started_at=clock_timestamp(),updated_at=clock_timestamp() where connection_id=p_connection_id;
 return v_next;
end $$;
revoke all on function public.website_begin_vercel_deployment_attempt(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text[],bigint,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_begin_vercel_deployment_attempt(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text[],bigint,jsonb,uuid) to service_role;

create or replace function public.website_commit_vercel_deployment_observation(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,
 p_operation_id uuid,p_deployment_id text,p_status text,p_observed_state text,
 p_missing_environment text[],p_live_url text,p_commit_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare a private.website_vercel_deployment_attempts%rowtype;v_attempt_version bigint;
 v_connection_version bigint;v_item text;
begin
 if p_operation_id is null or p_commit_id is null or p_expected_attempt_version<1
  or p_deployment_id!~'^dpl_[A-Za-z0-9]{8,128}$'
  or p_status not in('connecting','setup-incomplete','deployment-failed','ready')
  or p_observed_state!~'^[A-Z_]{3,40}$' or p_missing_environment is null
  or cardinality(p_missing_environment)>64
  or(p_status='ready'and(cardinality(p_missing_environment)<>0 or p_live_url is null
   or p_live_url!~'^https://[a-z0-9-]+[.]vercel[.]app$'))
  or(p_status='setup-incomplete'and cardinality(p_missing_environment)=0)
  or(p_status<>'ready'and p_live_url is not null)then raise exception 'Invalid deployment observation';end if;
 foreach v_item in array p_missing_environment loop if v_item!~'^[A-Z][A-Z0-9_]{1,99}$'
  then raise exception 'Invalid environment name';end if;end loop;
 if cardinality(p_missing_environment)<>(select count(distinct x)from unnest(p_missing_environment)x)
  then raise exception 'Duplicate environment name';end if;
 select d.* into a from private.website_vercel_deployment_attempts d
 join private.website_vercel_runtime_environment_receipts e on e.project_id=d.project_id and e.environment='preview'
 where d.connection_id=p_connection_id and d.project_id=p_project_id and d.owner_id=p_owner_id
  and d.version=p_expected_attempt_version and d.operation_id=p_operation_id
  and e.owner_id=d.owner_id and e.vercel_connection_id=d.connection_id
  and e.vercel_connection_version=d.connection_version and e.vercel_project_id=d.vercel_project_id
  and e.version=d.runtime_environment_receipt_version and e.vercel_environment_ids=d.runtime_environment_ids
  and e.git_branch='tayar/'||d.project_id::text||'/preview' and e.status='verified'
  and e.superseded_environment_ids is null
 for update of d,e;
 if not found then raise exception 'Deployment runtime environment changed';end if;
 v_attempt_version:=a.version+1;v_connection_version:=a.connection_version;
 if p_status<>'connecting' then
  update private.website_infrastructure_connections set status=p_status,
   permissions=array['deployment:read','project-env-vars:read','project:read','team:read','user:read'],
   verified_at=clock_timestamp(),operation_id=null,version=version+1,last_commit_id=p_commit_id,updated_at=clock_timestamp()
  where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id and provider='vercel'
   and version=a.connection_version and target_id=a.vercel_project_id returning version into v_connection_version;
  if v_connection_version is null then raise exception 'Vercel connection changed';end if;
  update private.website_vercel_integration_custody set connection_version=v_connection_version,updated_at=clock_timestamp()
  where connection_id=p_connection_id and connection_version=a.connection_version;
  if not found then raise exception 'Vercel custody changed';end if;
 end if;
 update private.website_vercel_deployment_attempts set deployment_id=p_deployment_id,status=p_status,
  observed_state=p_observed_state,missing_environment=p_missing_environment,live_url=p_live_url,
  connection_version=v_connection_version,last_commit_id=p_commit_id,version=v_attempt_version,
  updated_at=clock_timestamp() where connection_id=p_connection_id;
 return jsonb_build_object('attemptVersion',v_attempt_version,'connectionVersion',v_connection_version);
end $$;

create or replace function public.website_reconcile_vercel_deployment_observation(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,
 p_operation_id uuid,p_deployment_id text,p_status text,p_observed_state text,
 p_missing_environment text[],p_live_url text,p_commit_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('attemptVersion',a.version,'connectionVersion',a.connection_version)
 from private.website_vercel_deployment_attempts a
 join private.website_vercel_runtime_environment_receipts e on e.project_id=a.project_id and e.environment='preview'
 join public.projects p on p.id=a.project_id
 where a.connection_id=p_connection_id and a.project_id=p_project_id and a.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and a.version=p_expected_attempt_version+1 and a.operation_id=p_operation_id
  and a.deployment_id=p_deployment_id and a.status=p_status and a.observed_state=p_observed_state
  and a.missing_environment=p_missing_environment and a.live_url is not distinct from p_live_url
  and a.last_commit_id=p_commit_id and e.owner_id=a.owner_id and e.vercel_connection_id=a.connection_id
  and e.vercel_project_id=a.vercel_project_id and e.version=a.runtime_environment_receipt_version
  and e.vercel_environment_ids=a.runtime_environment_ids
  and e.git_branch='tayar/'||a.project_id::text||'/preview' and e.status='verified'
  and e.superseded_environment_ids is null
$$;
