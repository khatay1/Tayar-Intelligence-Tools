-- Private durable coordinator state. Credentials and secret values are absent.
create table private.website_byo_publish_operations (
 operation_id uuid primary key,project_id uuid not null references public.projects(id) on delete cascade,owner_id uuid not null,
 environment text not null check(environment in('preview','production')),
 stage text not null check(stage in('created','validated','exporting','exported','observing','blocked','ready')),
 version bigint not null check(version>0),source_digest text,required_environment text[] not null default '{}',head_sha text,
 attempt_version bigint,deployment_id text,live_url text,last_transition_key text not null,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),
 unique(project_id,environment,operation_id),
 check(source_digest is null or source_digest~'^[0-9a-f]{64}$'),check(head_sha is null or head_sha~'^[0-9a-f]{40}$'),
 check(attempt_version is null or attempt_version>0),check(deployment_id is null or deployment_id~'^dpl_[A-Za-z0-9]{8,128}$'),
 check(live_url is null or live_url~'^https://[a-z0-9-]+[.]vercel[.]app$'),check(cardinality(required_environment)<=64)
);
alter table private.website_byo_publish_operations enable row level security;
revoke all on private.website_byo_publish_operations from public,anon,authenticated;

create function private.website_byo_publish_json(v private.website_byo_publish_operations) returns jsonb
language sql stable security invoker set search_path='' as $$ select jsonb_build_object(
 'operationId',v.operation_id,'projectId',v.project_id,'ownerId',v.owner_id,'environment',v.environment,'stage',v.stage,
 'version',v.version,'sourceDigest',v.source_digest,'requiredEnvironment',v.required_environment,'headSha',v.head_sha,
 'attemptVersion',v.attempt_version,'deploymentId',v.deployment_id,'liveUrl',v.live_url); $$;
revoke all on function private.website_byo_publish_json(private.website_byo_publish_operations) from public,anon,authenticated;

create function public.website_initialize_byo_publish_operation(p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text)
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
  and o.required_environment='{}' and o.head_sha is null and o.attempt_version is null and o.deployment_id is null and o.live_url is null;
 if not found then raise exception 'BYO publish operation changed';end if;return private.website_byo_publish_json(v);
end $$;
revoke all on function public.website_initialize_byo_publish_operation(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.website_initialize_byo_publish_operation(uuid,uuid,uuid,text) to service_role;

create function public.website_read_byo_publish_operation(p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text)
returns jsonb language sql stable security definer set search_path='' as $$
 select private.website_byo_publish_json(o) from private.website_byo_publish_operations o join public.projects p on p.id=o.project_id
 where o.operation_id=p_operation_id and o.project_id=p_project_id and o.owner_id=p_owner_id and o.environment=p_environment
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null; $$;
revoke all on function public.website_read_byo_publish_operation(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.website_read_byo_publish_operation(uuid,uuid,uuid,text) to service_role;

create function public.website_transition_byo_publish_operation(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text,p_expected_version bigint,p_expected_stage text,p_next_stage text,
 p_source_digest text,p_required_environment text[],p_head_sha text,p_attempt_version bigint,p_deployment_id text,p_live_url text,p_transition_key text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.website_byo_publish_operations%rowtype;v_allowed boolean;v_valid boolean;
begin
 if p_expected_version is null or p_expected_version<1 or p_required_environment is null or cardinality(p_required_environment)>64
  or exists(select 1 from unnest(p_required_environment)x where x!~'^[A-Z][A-Z0-9_]{1,99}$')
  or cardinality(p_required_environment)<>(select count(distinct x)from unnest(p_required_environment)x)
  or p_required_environment<>(select coalesce(array_agg(x order by x),'{}')from unnest(p_required_environment)x)
  or p_transition_key<>p_operation_id::text||':'||p_expected_version::text||':'||p_next_stage then raise exception 'Invalid BYO publish transition';end if;
 v_allowed:=(p_expected_stage='created' and p_next_stage='validated')or(p_expected_stage='validated' and p_next_stage='exporting')
  or(p_expected_stage='exporting' and p_next_stage='exported')or(p_expected_stage='exported' and p_next_stage='observing')
  or(p_expected_stage='observing' and p_next_stage in('observing','blocked','ready'));
 v_valid:=case p_next_stage
  when 'validated' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha is null and p_attempt_version is null and p_deployment_id is null and p_live_url is null
  when 'exporting' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha is null and p_attempt_version is null and p_deployment_id is null and p_live_url is null
  when 'exported' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version is null and p_deployment_id is null and p_live_url is null
  when 'observing' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_live_url is null
  when 'blocked' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_deployment_id~'^dpl_[A-Za-z0-9]{8,128}$' and p_live_url is null
  when 'ready' then p_source_digest~'^[0-9a-f]{64}$' and p_head_sha~'^[0-9a-f]{40}$' and p_attempt_version>0 and p_deployment_id~'^dpl_[A-Za-z0-9]{8,128}$' and p_live_url~'^https://[a-z0-9-]+[.]vercel[.]app$'
  else false end;
 if not coalesce(v_allowed,false)or not coalesce(v_valid,false)then raise exception 'Invalid BYO publish transition';end if;
 select o.* into v from private.website_byo_publish_operations o join public.projects p on p.id=o.project_id
 where o.operation_id=p_operation_id and o.project_id=p_project_id and o.owner_id=p_owner_id and o.environment=p_environment
  and o.version=p_expected_version and o.stage=p_expected_stage and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null for update of o;
 if not found then raise exception 'BYO publish checkpoint changed';end if;
 update private.website_byo_publish_operations set stage=p_next_stage,version=p_expected_version+1,source_digest=p_source_digest,
  required_environment=p_required_environment,head_sha=p_head_sha,attempt_version=p_attempt_version,deployment_id=p_deployment_id,
  live_url=p_live_url,last_transition_key=p_transition_key,updated_at=clock_timestamp()where operation_id=p_operation_id returning*into v;
 return private.website_byo_publish_json(v);
end $$;
revoke all on function public.website_transition_byo_publish_operation(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.website_transition_byo_publish_operation(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,text) to service_role;

create function public.website_reconcile_byo_publish_transition(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_environment text,p_expected_version bigint,p_expected_stage text,p_next_stage text,
 p_source_digest text,p_required_environment text[],p_head_sha text,p_attempt_version bigint,p_deployment_id text,p_live_url text,p_transition_key text
) returns jsonb language sql stable security definer set search_path='' as $$
 select private.website_byo_publish_json(o)from private.website_byo_publish_operations o join public.projects p on p.id=o.project_id
 where o.operation_id=p_operation_id and o.project_id=p_project_id and o.owner_id=p_owner_id and o.environment=p_environment
  and o.version=p_expected_version+1 and o.stage=p_next_stage and o.last_transition_key=p_transition_key
  and o.source_digest is not distinct from p_source_digest and o.required_environment=p_required_environment
  and o.head_sha is not distinct from p_head_sha and o.attempt_version is not distinct from p_attempt_version
  and o.deployment_id is not distinct from p_deployment_id and o.live_url is not distinct from p_live_url
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null; $$;
revoke all on function public.website_reconcile_byo_publish_transition(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,text) from public,anon,authenticated;
grant execute on function public.website_reconcile_byo_publish_transition(uuid,uuid,uuid,text,bigint,text,text,text,text[],text,bigint,text,text,text) to service_role;
