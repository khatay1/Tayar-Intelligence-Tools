-- Customer-owned runtime metadata is separate from the legacy Tayar-managed
-- website_application_backends table. Publishable keys are public browser
-- configuration; service-role keys and provider grants are never stored here.
create table private.website_byo_runtime_bindings(
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check(environment in('preview','production')),
  supabase_connection_id uuid not null references private.website_infrastructure_connections(id) on delete restrict,
  supabase_connection_version bigint not null check(supabase_connection_version>0),
  vercel_connection_id uuid not null references private.website_infrastructure_connections(id) on delete restrict,
  vercel_connection_version bigint not null check(vercel_connection_version>0),
  application_origin text not null check(length(application_origin)<=2048),
  publishable_key text not null check(octet_length(publishable_key) between 20 and 4096),
  application_definition jsonb not null,
  version bigint not null check(version>0),
  last_commit_id uuid not null unique,
  verified_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key(project_id,environment),
  check(supabase_connection_id<>vercel_connection_id)
);
alter table private.website_byo_runtime_bindings enable row level security;
revoke all on private.website_byo_runtime_bindings from public,anon,authenticated;

create function public.website_record_byo_runtime_binding(
 p_project_id uuid,p_owner_id uuid,p_environment text,p_expected_version bigint,
 p_supabase_connection_id uuid,p_supabase_connection_version bigint,
 p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_application_origin text,p_publishable_key text,p_application_definition jsonb,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path='' as $$
declare v_current bigint;v_origin text;
begin
 select b.version into v_current from private.website_byo_runtime_bindings b
 where b.project_id=p_project_id and b.environment=p_environment for update;
 if p_expected_version is null or p_expected_version<0 or coalesce(v_current,0)<>p_expected_version
  or p_environment not in('preview','production')or p_commit_id is null
  or p_supabase_connection_id is null or p_vercel_connection_id is null
  or p_supabase_connection_id=p_vercel_connection_id
  or p_supabase_connection_version<1 or p_vercel_connection_version<1
  or p_application_origin is null or length(p_application_origin)>2048
  or p_application_origin!~'^https://([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?[.])+([a-z]{2,63}|vercel[.]app)$'
  or p_publishable_key is null or octet_length(p_publishable_key)not between 20 and 4096
  or p_publishable_key~'[[:space:]]' or p_application_definition is null then
   raise exception 'BYO runtime binding unavailable';end if;
 v_origin:=p_application_origin;
 perform 1 from public.projects p
 join private.website_infrastructure_connections s on s.project_id=p.id
 join private.website_infrastructure_connections v on v.project_id=p.id
 where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p.content->'application'=p_application_definition
  and s.id=p_supabase_connection_id and s.owner_id=p_owner_id and s.provider='supabase'
  and s.environment=p_environment and s.version=p_supabase_connection_version and s.status='ready'
  and s.target_id~'^[a-z0-9]{20}$' and s.verified_at is not null
  and v.id=p_vercel_connection_id and v.owner_id=p_owner_id and v.provider='vercel'
  and v.environment=p_environment and v.version=p_vercel_connection_version
  and v.status in('connected','setup-incomplete','deployment-failed','ready')and v.verified_at is not null
 for update of p;
 if not found then raise exception 'BYO runtime binding unavailable';end if;
 if p_expected_version=0 then
  insert into private.website_byo_runtime_bindings(project_id,owner_id,environment,
   supabase_connection_id,supabase_connection_version,vercel_connection_id,vercel_connection_version,
   application_origin,publishable_key,application_definition,version,last_commit_id,verified_at)
  values(p_project_id,p_owner_id,p_environment,p_supabase_connection_id,p_supabase_connection_version,
   p_vercel_connection_id,p_vercel_connection_version,v_origin,p_publishable_key,p_application_definition,
   1,p_commit_id,clock_timestamp());return 1;
 end if;
 update private.website_byo_runtime_bindings set owner_id=p_owner_id,
  supabase_connection_id=p_supabase_connection_id,supabase_connection_version=p_supabase_connection_version,
  vercel_connection_id=p_vercel_connection_id,vercel_connection_version=p_vercel_connection_version,
  application_origin=v_origin,publishable_key=p_publishable_key,application_definition=p_application_definition,
  version=version+1,last_commit_id=p_commit_id,verified_at=clock_timestamp(),updated_at=clock_timestamp()
 where project_id=p_project_id and environment=p_environment and version=p_expected_version
 returning version into v_current;
 if v_current is null then raise exception 'BYO runtime binding changed';end if;return v_current;
end $$;
revoke all on function public.website_record_byo_runtime_binding(uuid,uuid,text,bigint,uuid,bigint,uuid,bigint,text,text,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.website_record_byo_runtime_binding(uuid,uuid,text,bigint,uuid,bigint,uuid,bigint,text,text,jsonb,uuid) to service_role;

create function public.website_byo_saved_project(p_project_id uuid,p_owner_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('projectId',p.id,'ownerId',p.user_id,'snapshot',p.content)
 from public.projects p where p.id=p_project_id and p.user_id=p_owner_id
  and p.type='website-builder' and p.deleted_at is null
$$;
revoke all on function public.website_byo_saved_project(uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_byo_saved_project(uuid,uuid) to service_role;

create function public.website_byo_connection_for_worker(p_connection_id uuid,p_project_id uuid,p_owner_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',c.id,'ownerId',c.owner_id,'projectId',c.project_id,'provider',c.provider,
  'environment',c.environment,'accountId',c.account_id,'targetId',c.target_id,'permissions',c.permissions,
  'status',c.status,'version',c.version,'operationId',c.operation_id,'verifiedAt',c.verified_at,'updatedAt',c.updated_at)
 from private.website_infrastructure_connections c join public.projects p on p.id=c.project_id
 where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
$$;
revoke all on function public.website_byo_connection_for_worker(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_byo_connection_for_worker(uuid,uuid,uuid) to service_role;

create function public.website_byo_runtime_binding_for_worker(p_project_id uuid,p_owner_id uuid,p_environment text)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('projectId',b.project_id,'ownerId',b.owner_id,'environment',b.environment,
  'supabaseConnectionId',b.supabase_connection_id,'vercelConnectionId',b.vercel_connection_id,
  'applicationOrigin',b.application_origin,'backend',jsonb_build_object(
   'url','https://'||s.target_id||'.supabase.co','projectRef',s.target_id,'publishableKey',b.publishable_key))
 from private.website_byo_runtime_bindings b
 join public.projects p on p.id=b.project_id
 join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
 where b.project_id=p_project_id and b.owner_id=p_owner_id and b.environment=p_environment
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and p.content->'application'=b.application_definition
  and s.project_id=b.project_id and s.owner_id=b.owner_id and s.provider='supabase'
  and s.environment=b.environment and s.version=b.supabase_connection_version and s.status='ready'
  and s.target_id~'^[a-z0-9]{20}$' and s.verified_at is not null
  and v.project_id=b.project_id and v.owner_id=b.owner_id and v.provider='vercel'
  and v.environment=b.environment and v.version=b.vercel_connection_version
  and v.status in('connected','setup-incomplete','deployment-failed','ready')and v.verified_at is not null
$$;
revoke all on function public.website_byo_runtime_binding_for_worker(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.website_byo_runtime_binding_for_worker(uuid,uuid,text) to service_role;
