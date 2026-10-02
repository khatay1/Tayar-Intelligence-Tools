-- Production gets its own exact metadata-only runtime receipt. It targets
-- Production globally and therefore must never carry a Preview git branch.
alter table private.website_vercel_runtime_environment_receipts
 drop constraint website_vercel_runtime_environment_receipts_environment_check,
 add constraint website_vercel_runtime_environment_receipts_environment_check
  check(environment in('preview','production')),
 alter column git_branch drop not null;

create function public.website_begin_vercel_production_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_binding_version bigint,
 p_supabase_connection_id uuid,p_supabase_connection_version bigint,
 p_production_connection_id uuid,p_production_connection_version bigint,p_vercel_project_id text,
 p_value_digests jsonb,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.website_vercel_runtime_environment_receipts%rowtype;v_marker text;
begin
 if p_binding_version is null or p_binding_version<1 or p_supabase_connection_version is null
  or p_supabase_connection_version<1 or p_production_connection_version is null
  or p_production_connection_version<1 or p_operation_id is null
  or p_vercel_project_id!~'^prj_[A-Za-z0-9]{8,128}$'
  or p_value_digests is null or jsonb_typeof(p_value_digests)<>'object'
  or (select array_agg(k order by k)from jsonb_object_keys(p_value_digests)k)
    <>array['SUPABASE_ANON_KEY','SUPABASE_URL']
  or exists(select 1 from jsonb_each_text(p_value_digests)e where e.value!~'^[0-9a-f]{64}$')
  then raise exception 'Production runtime environment unavailable';end if;
 perform 1 from private.website_byo_runtime_bindings b
 join public.projects p on p.id=b.project_id
 join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 join private.website_infrastructure_connections pv on pv.id=b.vercel_connection_id
 join private.website_vercel_integration_custody pvc on pvc.connection_id=pv.id
 join private.website_infrastructure_connections v on v.id=p_production_connection_id
 join private.website_vercel_integration_custody vc on vc.connection_id=v.id
 where b.project_id=p_project_id and b.owner_id=p_owner_id and b.environment='preview' and b.version=p_binding_version
  and b.supabase_connection_id=p_supabase_connection_id and b.supabase_connection_version=p_supabase_connection_version
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p.content->'application'=b.application_definition
  and s.project_id=b.project_id and s.owner_id=b.owner_id and s.provider='supabase' and s.environment='preview'
  and s.version=b.supabase_connection_version and s.status='ready' and s.verified_at is not null
  and p_value_digests->>'SUPABASE_URL'=encode(extensions.digest('https://'||s.target_id||'.supabase.co','sha256'),'hex')
  and p_value_digests->>'SUPABASE_ANON_KEY'=encode(extensions.digest(b.publishable_key,'sha256'),'hex')
  and pv.project_id=b.project_id and pv.owner_id=b.owner_id and pv.provider='vercel' and pv.environment='preview'
  and pv.version=b.vercel_connection_version and pv.target_id=p_vercel_project_id
  and pvc.project_id=b.project_id and pvc.owner_id=b.owner_id and pvc.connection_version=pv.version
  and pvc.vercel_project_id=p_vercel_project_id and pvc.custody_expires_at>clock_timestamp()
  and v.project_id=b.project_id and v.owner_id=b.owner_id and v.provider='vercel' and v.environment='production'
  and v.version=p_production_connection_version and v.target_id=p_vercel_project_id and v.verified_at is not null
  and v.status in('connected','setup-incomplete','deployment-failed','ready')
  and vc.project_id=b.project_id and vc.owner_id=b.owner_id and vc.connection_version=v.version
  and vc.vercel_project_id=p_vercel_project_id and vc.custody_expires_at>clock_timestamp()
  and pvc.account_id=vc.account_id and pvc.repository_id=vc.repository_id
  and pvc.repository_owner=vc.repository_owner and pvc.repository_name=vc.repository_name
  and pvc.production_branch=vc.production_branch
 for update of b,v;
 if not found then raise exception 'Production runtime environment changed';end if;
 select * into r from private.website_vercel_runtime_environment_receipts
  where project_id=p_project_id and environment='production' for update;
 if found and r.status='verified' and r.superseded_environment_ids is null and r.owner_id=p_owner_id
  and r.binding_version=p_binding_version and r.supabase_connection_id=p_supabase_connection_id
  and r.supabase_connection_version=p_supabase_connection_version
  and r.vercel_connection_id=p_production_connection_id
  and r.vercel_connection_version=p_production_connection_version
  and r.vercel_project_id=p_vercel_project_id and r.git_branch is null and r.value_digests=p_value_digests then
  return jsonb_build_object('receiptVersion',r.version,'status','verified','newlyClaimed',false,
   'marker',r.marker,'environmentIds',r.vercel_environment_ids,'supersededEnvironmentIds',null);end if;
 if found and r.operation_id=p_operation_id and r.status='verified'
  then raise exception 'Production runtime environment changed';end if;
 if found and r.status='preparing' and r.operation_id=p_operation_id then
  if r.owner_id<>p_owner_id or r.binding_version<>p_binding_version
   or r.supabase_connection_id<>p_supabase_connection_id
   or r.supabase_connection_version<>p_supabase_connection_version
   or r.vercel_connection_id<>p_production_connection_id
   or r.vercel_connection_version<>p_production_connection_version
   or r.vercel_project_id<>p_vercel_project_id or r.git_branch is not null or r.value_digests<>p_value_digests
   then raise exception 'Production runtime environment changed';end if;
  return jsonb_build_object('receiptVersion',r.version,'status','preparing','newlyClaimed',false,
   'marker',r.marker,'supersededEnvironmentIds',r.superseded_environment_ids);end if;
 v_marker:='Tayar production runtime '||p_operation_id::text;
 if not found then
  insert into private.website_vercel_runtime_environment_receipts(project_id,owner_id,environment,binding_version,
   supabase_connection_id,supabase_connection_version,vercel_connection_id,vercel_connection_version,
   vercel_project_id,git_branch,value_digests,marker,status,operation_id,version)
  values(p_project_id,p_owner_id,'production',p_binding_version,p_supabase_connection_id,p_supabase_connection_version,
   p_production_connection_id,p_production_connection_version,p_vercel_project_id,null,p_value_digests,
   v_marker,'preparing',p_operation_id,1) returning * into r;
 else
  update private.website_vercel_runtime_environment_receipts set owner_id=p_owner_id,binding_version=p_binding_version,
   supabase_connection_id=p_supabase_connection_id,supabase_connection_version=p_supabase_connection_version,
   vercel_connection_id=p_production_connection_id,vercel_connection_version=p_production_connection_version,
   vercel_project_id=p_vercel_project_id,git_branch=null,value_digests=p_value_digests,
   superseded_environment_ids=case when status='verified' then vercel_environment_ids else superseded_environment_ids end,
   vercel_environment_ids=null,removed_environment_ids='[]'::jsonb,marker=v_marker,status='preparing',
   operation_id=p_operation_id,last_commit_id=null,version=version+1,verified_at=null,updated_at=clock_timestamp()
  where project_id=p_project_id and environment='production' returning * into r;
 end if;
 return jsonb_build_object('receiptVersion',r.version,'status','preparing','newlyClaimed',true,
  'marker',r.marker,'supersededEnvironmentIds',r.superseded_environment_ids);
end $$;
revoke all on function public.website_begin_vercel_production_runtime_environment(uuid,uuid,bigint,uuid,bigint,uuid,bigint,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_begin_vercel_production_runtime_environment(uuid,uuid,bigint,uuid,bigint,uuid,bigint,text,jsonb,uuid) to service_role;

create function public.website_commit_vercel_production_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_expected_receipt_version bigint,p_operation_id uuid,
 p_vercel_environment_ids jsonb,p_removed_environment_ids jsonb,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path='' as $$
declare r private.website_vercel_runtime_environment_receipts%rowtype;v_next bigint;v_expected jsonb;
begin
 if p_expected_receipt_version is null or p_expected_receipt_version<1 or p_operation_id is null or p_commit_id is null
  or p_vercel_environment_ids is null or jsonb_typeof(p_vercel_environment_ids)<>'object'
  or (select array_agg(k order by k)from jsonb_object_keys(p_vercel_environment_ids)k)
    <>array['SUPABASE_ANON_KEY','SUPABASE_URL']
  or exists(select 1 from jsonb_each_text(p_vercel_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or (select count(*)from jsonb_object_keys(p_vercel_environment_ids))
    <>(select count(distinct e.value)from jsonb_each_text(p_vercel_environment_ids)e)
  or p_removed_environment_ids is null or jsonb_typeof(p_removed_environment_ids)<>'array'
  or exists(select 1 from jsonb_array_elements_text(p_removed_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or jsonb_array_length(p_removed_environment_ids)<>
    (select count(distinct e.value)from jsonb_array_elements_text(p_removed_environment_ids)e)
  then raise exception 'Production runtime environment commit unavailable';end if;
 select e.* into r from private.website_vercel_runtime_environment_receipts e
 join public.projects p on p.id=e.project_id
 join private.website_infrastructure_connections v on v.id=e.vercel_connection_id
 join private.website_vercel_integration_custody c on c.connection_id=v.id
 where e.project_id=p_project_id and e.owner_id=p_owner_id and e.environment='production'
  and e.version=p_expected_receipt_version and e.operation_id=p_operation_id and e.status='preparing'
  and e.git_branch is null and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and v.project_id=e.project_id and v.owner_id=e.owner_id and v.version=e.vercel_connection_version
  and v.environment='production' and v.target_id=e.vercel_project_id
  and c.connection_version=v.version and c.custody_expires_at>clock_timestamp()
 for update of e;
 if not found then raise exception 'Production runtime environment changed';end if;
 select coalesce(jsonb_agg(x.value order by x.value),'[]'::jsonb)into v_expected
 from jsonb_each_text(coalesce(r.superseded_environment_ids,'{}'::jsonb))x
 where not exists(select 1 from jsonb_each_text(p_vercel_environment_ids)n where n.value=x.value);
 if p_removed_environment_ids<>v_expected then raise exception 'Production runtime environment cleanup changed';end if;
 v_next:=r.version+1;
 update private.website_vercel_runtime_environment_receipts set status='verified',
  vercel_environment_ids=p_vercel_environment_ids,superseded_environment_ids=null,
  removed_environment_ids=p_removed_environment_ids,last_commit_id=p_commit_id,version=v_next,
  verified_at=clock_timestamp(),updated_at=clock_timestamp()
 where project_id=p_project_id and environment='production';return v_next;
end $$;
revoke all on function public.website_commit_vercel_production_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_commit_vercel_production_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) to service_role;

create function public.website_reconcile_vercel_production_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_expected_receipt_version bigint,p_operation_id uuid,
 p_vercel_environment_ids jsonb,p_removed_environment_ids jsonb,p_commit_id uuid
) returns bigint language sql stable security definer set search_path='' as $$
 select e.version from private.website_vercel_runtime_environment_receipts e join public.projects p on p.id=e.project_id
 where e.project_id=p_project_id and e.owner_id=p_owner_id and e.environment='production' and e.git_branch is null
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and e.version=p_expected_receipt_version+1 and e.operation_id=p_operation_id and e.status='verified'
  and e.vercel_environment_ids=p_vercel_environment_ids and e.superseded_environment_ids is null
  and e.removed_environment_ids=p_removed_environment_ids and e.last_commit_id=p_commit_id
$$;
revoke all on function public.website_reconcile_vercel_production_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_reconcile_vercel_production_runtime_environment(uuid,uuid,bigint,uuid,jsonb,jsonb,uuid) to service_role;

-- A terminal Preview observation advances the Vercel connection CAS. Keep the
-- unchanged binding and exact receipt on that same CAS in the same transaction
-- so Production preparation can prove continuity without rewriting values.
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
 join private.website_byo_runtime_bindings b on b.project_id=d.project_id and b.environment='preview'
 where d.connection_id=p_connection_id and d.project_id=p_project_id and d.owner_id=p_owner_id
  and d.version=p_expected_attempt_version and d.operation_id=p_operation_id
  and e.owner_id=d.owner_id and e.vercel_connection_id=d.connection_id
  and e.vercel_connection_version=d.connection_version and e.vercel_project_id=d.vercel_project_id
  and e.version=d.runtime_environment_receipt_version and e.vercel_environment_ids=d.runtime_environment_ids
  and e.git_branch='tayar/'||d.project_id::text||'/preview' and e.status='verified'
  and e.superseded_environment_ids is null and b.owner_id=d.owner_id and b.version=e.binding_version
  and b.vercel_connection_id=d.connection_id and b.vercel_connection_version=d.connection_version
 for update of d,e,b;
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
  update private.website_vercel_runtime_environment_receipts set vercel_connection_version=v_connection_version,
   updated_at=clock_timestamp() where project_id=p_project_id and environment='preview'
   and version=a.runtime_environment_receipt_version and vercel_environment_ids=a.runtime_environment_ids
   and vercel_connection_id=p_connection_id and vercel_connection_version=a.connection_version;
  if not found then raise exception 'Vercel runtime environment changed';end if;
  update private.website_byo_runtime_bindings set vercel_connection_version=v_connection_version,
   updated_at=clock_timestamp() where project_id=p_project_id and environment='preview'
   and vercel_connection_id=p_connection_id and vercel_connection_version=a.connection_version;
  if not found then raise exception 'Runtime binding changed';end if;
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
 join private.website_byo_runtime_bindings b on b.project_id=a.project_id and b.environment='preview'
 join public.projects p on p.id=a.project_id
 where a.connection_id=p_connection_id and a.project_id=p_project_id and a.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and a.version=p_expected_attempt_version+1 and a.operation_id=p_operation_id
  and a.deployment_id=p_deployment_id and a.status=p_status and a.observed_state=p_observed_state
  and a.missing_environment=p_missing_environment and a.live_url is not distinct from p_live_url
  and a.last_commit_id=p_commit_id and e.owner_id=a.owner_id and e.vercel_connection_id=a.connection_id
  and e.vercel_connection_version=a.connection_version and e.vercel_project_id=a.vercel_project_id
  and e.version=a.runtime_environment_receipt_version and e.vercel_environment_ids=a.runtime_environment_ids
  and e.git_branch='tayar/'||a.project_id::text||'/preview' and e.status='verified'
  and e.superseded_environment_ids is null and b.owner_id=a.owner_id and b.version=e.binding_version
  and b.vercel_connection_id=a.connection_id and b.vercel_connection_version=a.connection_version
$$;

alter table private.website_vercel_promotions
 add column runtime_environment_receipt_version bigint check(runtime_environment_receipt_version>0),
 add column runtime_environment_ids jsonb;

drop function public.website_begin_vercel_promotion(uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,text,text,text,text[],uuid);
create function public.website_begin_vercel_promotion(
 p_preview_connection_id uuid,p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,
 p_preview_connection_version bigint,p_production_connection_version bigint,p_preview_attempt_version bigint,
 p_expected_promotion_version bigint,p_runtime_environment_receipt_version bigint,p_runtime_environment_ids jsonb,
 p_vercel_project_id text,p_deployment_id text,p_source_commit_sha text,p_expected_aliases text[],p_operation_id uuid
) returns bigint language plpgsql security definer set search_path='' as $$
declare v_row private.website_vercel_promotions%rowtype;v_alias text;v_next bigint;
begin
 if p_preview_connection_id=p_production_connection_id or p_operation_id is null
  or p_preview_connection_version<1 or p_production_connection_version<1 or p_preview_attempt_version<1
  or p_expected_promotion_version<0 or p_runtime_environment_receipt_version<1
  or p_runtime_environment_ids is null or jsonb_typeof(p_runtime_environment_ids)<>'object'
  or (select array_agg(k order by k)from jsonb_object_keys(p_runtime_environment_ids)k)
    <>array['SUPABASE_ANON_KEY','SUPABASE_URL']
  or exists(select 1 from jsonb_each_text(p_runtime_environment_ids)e where e.value!~'^[A-Za-z0-9_-]{3,128}$')
  or (select count(*)from jsonb_object_keys(p_runtime_environment_ids))
    <>(select count(distinct e.value)from jsonb_each_text(p_runtime_environment_ids)e)
  or p_vercel_project_id!~'^prj_[A-Za-z0-9]{8,128}$'
  or p_deployment_id!~'^dpl_[A-Za-z0-9]{8,128}$' or p_source_commit_sha!~'^[0-9a-f]{40}$'
  or p_expected_aliases is null or cardinality(p_expected_aliases)<1 or cardinality(p_expected_aliases)>100
  then raise exception 'Invalid Vercel promotion';end if;
 foreach v_alias in array p_expected_aliases loop
  if length(v_alias)>253 or v_alias!~'^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z]{2,63}$'
   then raise exception 'Invalid production alias';end if;
 end loop;
 if(select count(distinct item)from unnest(p_expected_aliases)item)<>cardinality(p_expected_aliases)
  or p_expected_aliases<>(select array_agg(item order by item)from unnest(p_expected_aliases)item)
  then raise exception 'Invalid production aliases';end if;
 perform 1 from private.website_vercel_deployment_attempts a
 join private.website_infrastructure_connections pc on pc.id=a.connection_id
 join private.website_vercel_integration_custody pvc on pvc.connection_id=pc.id
 join private.website_infrastructure_connections rc on rc.id=p_production_connection_id
 join private.website_vercel_integration_custody rvc on rvc.connection_id=rc.id
 join private.website_vercel_runtime_environment_receipts e
  on e.project_id=a.project_id and e.environment='production'
 join private.website_byo_runtime_bindings b on b.project_id=a.project_id and b.environment='preview'
 join public.projects p on p.id=a.project_id
 where a.connection_id=p_preview_connection_id and a.project_id=p_project_id and a.owner_id=p_owner_id
  and a.version=p_preview_attempt_version and a.connection_version=p_preview_connection_version
  and a.vercel_project_id=p_vercel_project_id and a.deployment_id=p_deployment_id
  and a.source_commit_sha=p_source_commit_sha and a.target='preview' and a.status='ready'
  and pc.project_id=p_project_id and pc.owner_id=p_owner_id and pc.provider='vercel'
  and pc.environment='preview' and pc.version=p_preview_connection_version and pc.status='ready'
  and pvc.connection_version=pc.version and pvc.custody_expires_at>clock_timestamp()
  and rc.project_id=p_project_id and rc.owner_id=p_owner_id and rc.provider='vercel'
  and rc.environment='production' and rc.version=p_production_connection_version
  and rc.status in('connected','setup-incomplete','deployment-failed','ready')
  and rvc.connection_version=rc.version and rvc.custody_expires_at>clock_timestamp()
  and pvc.account_id=rvc.account_id and pvc.vercel_project_id=rvc.vercel_project_id
  and pvc.repository_id=rvc.repository_id and pvc.repository_owner=rvc.repository_owner
  and pvc.repository_name=rvc.repository_name and pvc.production_branch=rvc.production_branch
  and rvc.vercel_project_id=p_vercel_project_id and p.user_id=p_owner_id
  and p.type='website-builder' and p.deleted_at is null
  and e.owner_id=p_owner_id and e.vercel_connection_id=rc.id
  and e.vercel_connection_version=rc.version and e.vercel_project_id=rc.target_id
  and e.binding_version=b.version and e.supabase_connection_id=b.supabase_connection_id
  and e.supabase_connection_version=b.supabase_connection_version
  and b.owner_id=p_owner_id and b.vercel_connection_id=pc.id
  and b.vercel_connection_version=pc.version
  and e.version=p_runtime_environment_receipt_version and e.vercel_environment_ids=p_runtime_environment_ids
  and e.status='verified' and e.superseded_environment_ids is null and e.git_branch is null
  and e.operation_id=p_operation_id
 for update of rc,e;
 if not found then raise exception 'Vercel promotion scope changed';end if;
 select * into v_row from private.website_vercel_promotions
  where production_connection_id=p_production_connection_id for update;
 if found and v_row.operation_id=p_operation_id then
  if v_row.preview_connection_id<>p_preview_connection_id or v_row.project_id<>p_project_id
   or v_row.owner_id<>p_owner_id or v_row.preview_connection_version<>p_preview_connection_version
   or v_row.production_connection_version<>p_production_connection_version
   or v_row.preview_attempt_version<>p_preview_attempt_version or v_row.vercel_project_id<>p_vercel_project_id
   or v_row.deployment_id<>p_deployment_id or v_row.source_commit_sha<>p_source_commit_sha
   or v_row.expected_aliases<>p_expected_aliases
   or v_row.runtime_environment_receipt_version<>p_runtime_environment_receipt_version
   or v_row.runtime_environment_ids<>p_runtime_environment_ids then raise exception 'Vercel promotion changed';end if;
  return v_row.version;
 end if;
 if p_expected_promotion_version=0 then
  if found then raise exception 'Vercel promotion changed';end if;
  insert into private.website_vercel_promotions(production_connection_id,preview_connection_id,project_id,owner_id,
   preview_connection_version,production_connection_version,preview_attempt_version,
   runtime_environment_receipt_version,runtime_environment_ids,vercel_project_id,deployment_id,
   source_commit_sha,expected_aliases,status,operation_id,version)
  values(p_production_connection_id,p_preview_connection_id,p_project_id,p_owner_id,p_preview_connection_version,
   p_production_connection_version,p_preview_attempt_version,p_runtime_environment_receipt_version,
   p_runtime_environment_ids,p_vercel_project_id,p_deployment_id,p_source_commit_sha,p_expected_aliases,
   'prepared',p_operation_id,1);return 1;
 end if;
 if not found or v_row.version<>p_expected_promotion_version or v_row.status<>'ready'
  then raise exception 'Vercel promotion changed';end if;
 v_next:=v_row.version+1;
 update private.website_vercel_promotions set preview_connection_id=p_preview_connection_id,
  preview_connection_version=p_preview_connection_version,production_connection_version=p_production_connection_version,
  preview_attempt_version=p_preview_attempt_version,runtime_environment_receipt_version=p_runtime_environment_receipt_version,
  runtime_environment_ids=p_runtime_environment_ids,vercel_project_id=p_vercel_project_id,deployment_id=p_deployment_id,
  source_commit_sha=p_source_commit_sha,expected_aliases=p_expected_aliases,observed_aliases='{}'::text[],live_url=null,
  status='prepared',operation_id=p_operation_id,last_commit_id=null,version=v_next,claimed_at=null,verified_at=null,
  created_at=clock_timestamp(),updated_at=clock_timestamp() where production_connection_id=p_production_connection_id;
 return v_next;
end $$;
revoke all on function public.website_begin_vercel_promotion(uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,bigint,jsonb,text,text,text,text[],uuid) from public,anon,authenticated;
grant execute on function public.website_begin_vercel_promotion(uuid,uuid,uuid,uuid,bigint,bigint,bigint,bigint,bigint,jsonb,text,text,text,text[],uuid) to service_role;

create or replace function public.website_claim_vercel_promotion(
 p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_promotion_version bigint,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.website_vercel_promotions%rowtype;v_issue boolean:=false;v_token text;v_account text;v_branch text;
begin
 select v.* into v_row from private.website_vercel_promotions v
 join private.website_vercel_runtime_environment_receipts e
  on e.project_id=v.project_id and e.environment='production'
 where v.production_connection_id=p_production_connection_id and v.project_id=p_project_id
  and v.owner_id=p_owner_id and v.operation_id=p_operation_id
  and e.owner_id=v.owner_id and e.vercel_connection_id=v.production_connection_id
  and e.vercel_connection_version=v.production_connection_version and e.vercel_project_id=v.vercel_project_id
  and e.version=v.runtime_environment_receipt_version and e.vercel_environment_ids=v.runtime_environment_ids
  and e.status='verified' and e.superseded_environment_ids is null and e.git_branch is null
  and e.operation_id=v.operation_id
 for update of v,e;
 if not found or v_row.version<>p_expected_promotion_version or v_row.status not in('prepared','claimed')
  then raise exception 'Vercel promotion changed';end if;
 if v_row.status='prepared' then
  update private.website_vercel_promotions set status='claimed',version=version+1,
   claimed_at=clock_timestamp(),updated_at=clock_timestamp()
  where production_connection_id=p_production_connection_id returning * into v_row;v_issue:=true;
 end if;
 select d.decrypted_secret,v.account_id,v.production_branch into v_token,v_account,v_branch
 from private.website_vercel_integration_custody v join private.website_infrastructure_connections c on c.id=v.connection_id
 join vault.decrypted_secrets d on d.id=v.secret_id
 where v.connection_id=p_production_connection_id and v.project_id=p_project_id and v.owner_id=p_owner_id
  and v.connection_version=v_row.production_connection_version and v.vercel_project_id=v_row.vercel_project_id
  and v.custody_expires_at>clock_timestamp() and c.version=v.connection_version and c.provider='vercel'
  and c.environment='production' and c.account_id=v.account_id and c.target_id=v.vercel_project_id;
 if v_token is null then raise exception 'Vercel custody changed';end if;
 return jsonb_build_object('promotionVersion',v_row.version,'issuePromotion',v_issue,'accessToken',v_token,
  'accountId',v_account,'productionBranch',v_branch);
end $$;

create or replace function public.website_commit_vercel_promotion(
 p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_promotion_version bigint,
 p_operation_id uuid,p_deployment_id text,p_source_commit_sha text,p_observed_aliases text[],p_live_url text,p_commit_id uuid
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_row private.website_vercel_promotions%rowtype;v_version bigint;v_connection bigint;
begin
 if p_commit_id is null or p_observed_aliases is null or p_live_url is null then raise exception 'Invalid promotion proof';end if;
 select v.* into v_row from private.website_vercel_promotions v
 join private.website_vercel_runtime_environment_receipts e
  on e.project_id=v.project_id and e.environment='production'
 where v.production_connection_id=p_production_connection_id and v.project_id=p_project_id
  and v.owner_id=p_owner_id and v.operation_id=p_operation_id
  and e.owner_id=v.owner_id and e.vercel_connection_id=v.production_connection_id
  and e.vercel_connection_version=v.production_connection_version and e.vercel_project_id=v.vercel_project_id
  and e.version=v.runtime_environment_receipt_version and e.vercel_environment_ids=v.runtime_environment_ids
  and e.status='verified' and e.superseded_environment_ids is null and e.git_branch is null
  and e.operation_id=v.operation_id
 for update of v,e;
 if not found or v_row.version<>p_expected_promotion_version or v_row.status<>'claimed'
  or v_row.deployment_id<>p_deployment_id or v_row.source_commit_sha<>p_source_commit_sha
  or v_row.expected_aliases<>p_observed_aliases or p_live_url<>('https://'||p_observed_aliases[1])
  then raise exception 'Vercel promotion changed';end if;
 update private.website_infrastructure_connections set status='ready',
  permissions=array['deployment:promote','deployment:read','domain:read','project-env-vars:read','project:read','team:read','user:read'],
  verified_at=clock_timestamp(),operation_id=null,version=version+1,last_commit_id=p_commit_id,updated_at=clock_timestamp()
 where id=p_production_connection_id and project_id=p_project_id and owner_id=p_owner_id and provider='vercel'
  and environment='production' and version=v_row.production_connection_version and target_id=v_row.vercel_project_id
 returning version into v_connection;
 if v_connection is null then raise exception 'Vercel connection changed';end if;
 update private.website_vercel_integration_custody set connection_version=v_connection,updated_at=clock_timestamp()
 where connection_id=p_production_connection_id and connection_version=v_row.production_connection_version;
 if not found then raise exception 'Vercel custody changed';end if;
 update private.website_vercel_runtime_environment_receipts set vercel_connection_version=v_connection,
  updated_at=clock_timestamp() where project_id=p_project_id and environment='production'
  and owner_id=p_owner_id and version=v_row.runtime_environment_receipt_version
  and vercel_environment_ids=v_row.runtime_environment_ids
  and vercel_connection_id=p_production_connection_id and vercel_connection_version=v_row.production_connection_version;
 if not found then raise exception 'Production runtime environment changed';end if;
 v_version:=v_row.version+1;
 update private.website_vercel_promotions set status='ready',observed_aliases=p_observed_aliases,live_url=p_live_url,
  production_connection_version=v_connection,last_commit_id=p_commit_id,version=v_version,
  verified_at=clock_timestamp(),updated_at=clock_timestamp()
 where production_connection_id=p_production_connection_id;
 return jsonb_build_object('promotionVersion',v_version,'connectionVersion',v_connection);
end $$;

create or replace function public.website_reconcile_vercel_promotion(
 p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_promotion_version bigint,
 p_operation_id uuid,p_deployment_id text,p_source_commit_sha text,p_observed_aliases text[],p_live_url text,p_commit_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('promotionVersion',v.version,'connectionVersion',v.production_connection_version)
 from private.website_vercel_promotions v
 join private.website_vercel_runtime_environment_receipts e
  on e.project_id=v.project_id and e.environment='production'
 join public.projects p on p.id=v.project_id
 where v.production_connection_id=p_production_connection_id and v.project_id=p_project_id and v.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and v.version=p_expected_promotion_version+1 and v.operation_id=p_operation_id and v.status='ready'
  and v.deployment_id=p_deployment_id and v.source_commit_sha=p_source_commit_sha
  and v.observed_aliases=p_observed_aliases and v.live_url=p_live_url and v.last_commit_id=p_commit_id
  and e.owner_id=v.owner_id and e.vercel_connection_id=v.production_connection_id
  and e.vercel_connection_version=v.production_connection_version and e.vercel_project_id=v.vercel_project_id
  and e.version=v.runtime_environment_receipt_version and e.vercel_environment_ids=v.runtime_environment_ids
  and e.status='verified' and e.superseded_environment_ids is null and e.git_branch is null
  and e.operation_id=v.operation_id
$$;

create or replace function public.website_vercel_promotion_for_worker(
 p_production_connection_id uuid,p_project_id uuid,p_owner_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',v.version,'operationId',v.operation_id,'status',v.status,
  'deploymentId',v.deployment_id,'sourceCommitSha',v.source_commit_sha,'expectedAliases',v.expected_aliases,
  'observedAliases',v.observed_aliases,'liveUrl',v.live_url,
  'productionConnectionVersion',v.production_connection_version,
  'runtimeEnvironmentReceiptVersion',v.runtime_environment_receipt_version,
  'runtimeEnvironmentIds',v.runtime_environment_ids)
 from private.website_vercel_promotions v join public.projects p on p.id=v.project_id
 where v.production_connection_id=p_production_connection_id and v.project_id=p_project_id
  and v.owner_id=p_owner_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
$$;

-- Repair the Preview verifier's object cardinality check using supported
-- PostgreSQL jsonb primitives while this receipt table is being extended.
create or replace function public.website_verify_vercel_runtime_environment(
 p_project_id uuid,p_owner_id uuid,p_binding_version bigint,p_supabase_connection_id uuid,
 p_supabase_connection_version bigint,p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_vercel_project_id text,p_git_branch text,p_required_environment text[]
) returns boolean language sql stable security definer set search_path='' as $$
 select p_required_environment=array['SUPABASE_ANON_KEY','SUPABASE_URL'] and exists(
  select 1 from private.website_vercel_runtime_environment_receipts e
  join private.website_byo_runtime_bindings b on b.project_id=e.project_id and b.environment=e.environment
  join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
  join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
  join public.projects p on p.id=e.project_id
  where e.project_id=p_project_id and e.owner_id=p_owner_id and e.environment='preview' and e.status='verified'
   and e.superseded_environment_ids is null and e.binding_version=p_binding_version and b.version=e.binding_version
   and e.supabase_connection_id=p_supabase_connection_id and e.supabase_connection_version=p_supabase_connection_version
   and b.supabase_connection_id=e.supabase_connection_id and b.supabase_connection_version=e.supabase_connection_version
   and e.vercel_connection_id=p_vercel_connection_id and e.vercel_connection_version=p_vercel_connection_version
   and b.vercel_connection_id=e.vercel_connection_id and b.vercel_connection_version=e.vercel_connection_version
   and e.vercel_project_id=p_vercel_project_id and v.target_id=e.vercel_project_id
   and e.git_branch=p_git_branch and e.git_branch='tayar/'||p_project_id::text||'/preview'
   and e.value_digests=jsonb_build_object('SUPABASE_URL',encode(extensions.digest('https://'||s.target_id||'.supabase.co','sha256'),'hex'),
    'SUPABASE_ANON_KEY',encode(extensions.digest(b.publishable_key,'sha256'),'hex'))
   and(select count(*)from jsonb_object_keys(e.vercel_environment_ids))=2 and p.user_id=p_owner_id
   and p.type='website-builder' and p.deleted_at is null and s.version=b.supabase_connection_version
   and v.version=b.vercel_connection_version and s.status='ready'
   and v.status in('connected','setup-incomplete','deployment-failed','ready'))
$$;
