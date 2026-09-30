-- Extend the existing checkpoint without replacing Preview semantics. Production
-- consumes a ready Preview and can only reach ready through promotion evidence.
alter table private.website_byo_publish_operations
  add column preview_operation_id uuid references private.website_byo_publish_operations(operation_id),
  add column promotion_version bigint check(promotion_version is null or promotion_version>0),
  add column production_aliases text[] not null default '{}'::text[];
alter table private.website_byo_publish_operations drop constraint website_byo_publish_operations_stage_check;
alter table private.website_byo_publish_operations add constraint website_byo_publish_operations_stage_check
  check(stage in('created','validated','exporting','exported','observing','blocked','promoting','verifying-production','ready'));
alter table private.website_byo_publish_operations drop constraint website_byo_publish_operations_live_url_check;
alter table private.website_byo_publish_operations add constraint website_byo_publish_operations_live_url_check
  check(live_url is null or (length(live_url)<=261 and live_url~'^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z]{2,63}$'));
alter table private.website_byo_publish_operations add constraint website_byo_publish_operations_alias_count_check
  check(cardinality(production_aliases)<=100);

create or replace function private.website_byo_publish_json(v private.website_byo_publish_operations) returns jsonb
language sql stable security invoker set search_path='' as $$ select jsonb_build_object(
 'operationId',v.operation_id,'projectId',v.project_id,'ownerId',v.owner_id,'environment',v.environment,'stage',v.stage,
 'version',v.version,'sourceDigest',v.source_digest,'requiredEnvironment',v.required_environment,'headSha',v.head_sha,
 'attemptVersion',v.attempt_version,'deploymentId',v.deployment_id,'liveUrl',v.live_url,
 'previewOperationId',v.preview_operation_id,'promotionVersion',v.promotion_version,'productionAliases',v.production_aliases); $$;

create or replace function public.website_initialize_byo_publish_operation(p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.website_byo_publish_operations%rowtype;
begin
 if p_operation_id is null or p_environment not in('preview','production') then raise exception 'Invalid BYO publish operation';end if;
 perform 1 from public.projects p where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null for update;
 if not found then raise exception 'BYO publish scope changed';end if;
 insert into private.website_byo_publish_operations(operation_id,project_id,owner_id,environment,stage,version,last_transition_key)
 values(p_operation_id,p_project_id,p_owner_id,p_environment,'created',1,p_operation_id::text||':0:created') on conflict(operation_id) do nothing;
 select o.* into v from private.website_byo_publish_operations o where o.operation_id=p_operation_id and o.project_id=p_project_id
  and o.owner_id=p_owner_id and o.environment=p_environment and o.stage='created' and o.version=1 and o.source_digest is null
  and o.required_environment='{}' and o.head_sha is null and o.attempt_version is null and o.deployment_id is null
  and o.live_url is null and o.preview_operation_id is null and o.promotion_version is null and o.production_aliases='{}';
 if not found then raise exception 'BYO publish operation changed';end if;return private.website_byo_publish_json(v);
end $$;

drop function public.website_transition_byo_publish_operation(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,text);
create function public.website_transition_byo_publish_operation(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text,p_expected_version bigint,p_expected_stage text,p_next_stage text,
 p_source_digest text,p_required_environment text[],p_head_sha text,p_attempt_version bigint,p_deployment_id text,p_live_url text,
 p_preview_operation_id uuid,p_promotion_version bigint,p_production_aliases text[],p_transition_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.website_byo_publish_operations%rowtype;v_allowed boolean;v_valid boolean;
begin
 if p_expected_version is null or p_expected_version<1 or p_required_environment is null or cardinality(p_required_environment)>64
  or p_production_aliases is null or cardinality(p_production_aliases)>100
  or exists(select 1 from unnest(p_required_environment)x where x!~'^[A-Z][A-Z0-9_]{1,99}$')
  or cardinality(p_required_environment)<>(select count(distinct x)from unnest(p_required_environment)x)
  or p_required_environment<>(select coalesce(array_agg(x order by x),'{}')from unnest(p_required_environment)x)
  or exists(select 1 from unnest(p_production_aliases)x where length(x)>253 or x!~'^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+[a-z]{2,63}$')
  or cardinality(p_production_aliases)<>(select count(distinct x)from unnest(p_production_aliases)x)
  or p_production_aliases<>(select coalesce(array_agg(x order by x),'{}')from unnest(p_production_aliases)x)
  or p_transition_key<>p_operation_id::text||':'||p_expected_version::text||':'||p_next_stage then raise exception 'Invalid BYO publish transition';end if;
 v_allowed:=case when p_environment='preview' then
   (p_expected_stage='created' and p_next_stage='validated')or(p_expected_stage='validated' and p_next_stage='exporting')
   or(p_expected_stage='exporting' and p_next_stage='exported')or(p_expected_stage='exported' and p_next_stage='observing')
   or(p_expected_stage='observing' and p_next_stage in('observing','blocked','ready'))
  when p_environment='production' then (p_expected_stage='created' and p_next_stage='validated')
   or(p_expected_stage='validated' and p_next_stage='promoting')
   or(p_expected_stage='promoting' and p_next_stage='verifying-production')
   or(p_expected_stage='verifying-production' and p_next_stage='ready') else false end;
 v_valid:=case
  when p_environment='preview' and p_next_stage in('validated','exporting') then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha is null and p_attempt_version is null and p_deployment_id is null and p_live_url is null and p_preview_operation_id is null and p_promotion_version is null and cardinality(p_production_aliases)=0
  when p_environment='preview' and p_next_stage='exported' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version is null and p_deployment_id is null and p_live_url is null and p_preview_operation_id is null and p_promotion_version is null and cardinality(p_production_aliases)=0
  when p_environment='preview' and p_next_stage='observing' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_live_url is null and p_preview_operation_id is null and p_promotion_version is null and cardinality(p_production_aliases)=0
  when p_environment='preview' and p_next_stage='blocked' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_deployment_id~'^dpl_[A-Za-z0-9]{8,128}$' and p_live_url is null and p_preview_operation_id is null and p_promotion_version is null and cardinality(p_production_aliases)=0
  when p_environment='preview' and p_next_stage='ready' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_deployment_id~'^dpl_[A-Za-z0-9]{8,128}$' and p_live_url~'^https://[a-z0-9-]+[.]vercel[.]app$' and p_preview_operation_id is null and p_promotion_version is null and cardinality(p_production_aliases)=0
  when p_environment='production' and p_next_stage in('validated','promoting') then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_deployment_id~'^dpl_[A-Za-z0-9]{8,128}$' and p_live_url is null and p_preview_operation_id is not null and p_promotion_version is null and cardinality(p_production_aliases)=0
  when p_environment='production' and p_next_stage in('verifying-production','ready') then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_deployment_id~'^dpl_[A-Za-z0-9]{8,128}$' and p_live_url=('https://'||p_production_aliases[1]) and p_preview_operation_id is not null and p_promotion_version>0 and cardinality(p_production_aliases)>0
  else false end;
 if not coalesce(v_allowed,false)or not coalesce(v_valid,false)then raise exception 'Invalid BYO publish transition';end if;
 if p_environment='production' then
  perform 1 from private.website_byo_publish_operations q where q.operation_id=p_preview_operation_id
   and q.project_id=p_project_id and q.owner_id=p_owner_id and q.environment='preview' and q.stage='ready'
   and q.source_digest=p_source_digest and q.required_environment=p_required_environment and q.head_sha=p_head_sha
   and q.attempt_version=p_attempt_version and q.deployment_id=p_deployment_id;
  if not found then raise exception 'Preview publish changed';end if;
 end if;
 select o.* into v from private.website_byo_publish_operations o join public.projects p on p.id=o.project_id
 where o.operation_id=p_operation_id and o.project_id=p_project_id and o.owner_id=p_owner_id and o.environment=p_environment
  and o.version=p_expected_version and o.stage=p_expected_stage and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null for update of o;
 if not found then raise exception 'BYO publish checkpoint changed';end if;
 update private.website_byo_publish_operations set stage=p_next_stage,version=p_expected_version+1,source_digest=p_source_digest,
  required_environment=p_required_environment,head_sha=p_head_sha,attempt_version=p_attempt_version,deployment_id=p_deployment_id,
  live_url=p_live_url,preview_operation_id=p_preview_operation_id,promotion_version=p_promotion_version,
  production_aliases=p_production_aliases,last_transition_key=p_transition_key,updated_at=clock_timestamp()
 where operation_id=p_operation_id returning*into v;return private.website_byo_publish_json(v);
end $$;
revoke all on function public.website_transition_byo_publish_operation(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,uuid,bigint,text[],text) from public,anon,authenticated;
grant execute on function public.website_transition_byo_publish_operation(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,uuid,bigint,text[],text) to service_role;

drop function public.website_reconcile_byo_publish_transition(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,text);
create function public.website_reconcile_byo_publish_transition(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text,p_expected_version bigint,p_expected_stage text,p_next_stage text,
 p_source_digest text,p_required_environment text[],p_head_sha text,p_attempt_version bigint,p_deployment_id text,p_live_url text,
 p_preview_operation_id uuid,p_promotion_version bigint,p_production_aliases text[],p_transition_key text
) returns jsonb language sql stable security definer set search_path='' as $$
 select private.website_byo_publish_json(o)from private.website_byo_publish_operations o join public.projects p on p.id=o.project_id
 where o.operation_id=p_operation_id and o.project_id=p_project_id and o.owner_id=p_owner_id and o.environment=p_environment
  and o.version=p_expected_version+1 and o.stage=p_next_stage and o.last_transition_key=p_transition_key
  and o.source_digest is not distinct from p_source_digest and o.required_environment=p_required_environment
  and o.head_sha is not distinct from p_head_sha and o.attempt_version is not distinct from p_attempt_version
  and o.deployment_id is not distinct from p_deployment_id and o.live_url is not distinct from p_live_url
  and o.preview_operation_id is not distinct from p_preview_operation_id and o.promotion_version is not distinct from p_promotion_version
  and o.production_aliases=p_production_aliases and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null; $$;
revoke all on function public.website_reconcile_byo_publish_transition(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,uuid,bigint,text[],text) from public,anon,authenticated;
grant execute on function public.website_reconcile_byo_publish_transition(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,uuid,bigint,text[],text) to service_role;
