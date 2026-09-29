-- One resumable deployment observation per Vercel connection. Git push is the
-- trigger; retries observe the same source commit instead of creating a second deployment.
create table private.website_vercel_deployment_attempts (
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  connection_version bigint not null check (connection_version>0),
  vercel_project_id text not null,
  repository_id text not null,
  source_commit_sha text not null check (source_commit_sha ~ '^[0-9a-f]{40}$'),
  target text not null check (target in ('preview','production')),
  required_environment text[] not null,
  deployment_id text,
  status text not null check (status in ('connecting','setup-incomplete','deployment-failed','ready')),
  observed_state text,
  missing_environment text[] not null default '{}'::text[],
  live_url text,
  operation_id uuid not null unique,
  last_commit_id uuid,
  version bigint not null check (version>0),
  started_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
alter table private.website_vercel_deployment_attempts enable row level security;
revoke all on private.website_vercel_deployment_attempts from public, anon, authenticated;

create function public.website_begin_vercel_deployment_attempt(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_connection_version bigint,
  p_expected_attempt_version bigint,p_vercel_project_id text,p_repository_id text,
  p_source_commit_sha text,p_target text,p_required_environment text[],p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_attempt private.website_vercel_deployment_attempts%rowtype; v_item text; v_next bigint;
begin
  if p_operation_id is null or p_connection_version is null or p_connection_version<1
    or p_expected_attempt_version is null or p_expected_attempt_version<0
    or p_vercel_project_id is null or p_vercel_project_id !~ '^prj_[a-zA-Z0-9]{8,128}$'
    or p_repository_id is null or p_repository_id !~ '^[0-9]{1,30}$'
    or p_source_commit_sha is null or p_source_commit_sha !~ '^[0-9a-f]{40}$'
    or p_target is null or p_target not in ('preview','production') or p_required_environment is null
    or cardinality(p_required_environment)>64 then raise exception 'Invalid Vercel deployment attempt'; end if;
  foreach v_item in array p_required_environment loop
    if v_item !~ '^[A-Z][A-Z0-9_]{1,99}$' then raise exception 'Invalid environment name'; end if;
  end loop;
  if (select count(distinct item) from unnest(p_required_environment) item)<>cardinality(p_required_environment)
    then raise exception 'Duplicate environment name'; end if;
  perform 1 from private.website_infrastructure_connections c
    join private.website_vercel_integration_custody v on v.connection_id=c.id
    join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='vercel' and c.version=p_connection_version and c.target_id=p_vercel_project_id
    and c.environment=p_target and c.status in ('connected','setup-incomplete','deployment-failed','ready')
    and v.connection_version=c.version and v.vercel_project_id=c.target_id
    and v.repository_id=p_repository_id and v.custody_expires_at>clock_timestamp() for update of c;
  if not found then raise exception 'Vercel connection changed'; end if;
  select * into v_attempt from private.website_vercel_deployment_attempts
    where connection_id=p_connection_id for update;
  if found and v_attempt.operation_id=p_operation_id then
    if v_attempt.project_id<>p_project_id or v_attempt.owner_id<>p_owner_id
      or v_attempt.connection_version<>p_connection_version
      or v_attempt.vercel_project_id<>p_vercel_project_id or v_attempt.repository_id<>p_repository_id
      or v_attempt.source_commit_sha<>p_source_commit_sha or v_attempt.target<>p_target
      or v_attempt.required_environment<>p_required_environment then raise exception 'Deployment attempt changed'; end if;
    return v_attempt.version;
  end if;
  if p_expected_attempt_version=0 then
    if found then raise exception 'Deployment attempt changed'; end if;
    insert into private.website_vercel_deployment_attempts
      (connection_id,project_id,owner_id,connection_version,vercel_project_id,repository_id,
       source_commit_sha,target,required_environment,status,operation_id,version)
    values (p_connection_id,p_project_id,p_owner_id,p_connection_version,p_vercel_project_id,
      p_repository_id,p_source_commit_sha,p_target,p_required_environment,'connecting',p_operation_id,1);
    return 1;
  end if;
  if not found or v_attempt.version<>p_expected_attempt_version
    or v_attempt.status='connecting' then raise exception 'Deployment attempt changed'; end if;
  v_next:=v_attempt.version+1;
  update private.website_vercel_deployment_attempts set connection_version=p_connection_version,
    vercel_project_id=p_vercel_project_id,repository_id=p_repository_id,
    source_commit_sha=p_source_commit_sha,target=p_target,required_environment=p_required_environment,
    deployment_id=null,status='connecting',observed_state=null,missing_environment='{}'::text[],
    live_url=null,operation_id=p_operation_id,last_commit_id=null,version=v_next,
    started_at=clock_timestamp(),updated_at=clock_timestamp() where connection_id=p_connection_id;
  return v_next;
end $$;
revoke all on function public.website_begin_vercel_deployment_attempt(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text[],uuid) from public, anon, authenticated;
grant execute on function public.website_begin_vercel_deployment_attempt(uuid,uuid,uuid,bigint,bigint,text,text,text,text,text[],uuid) to service_role;

create function public.website_commit_vercel_deployment_observation(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,
  p_operation_id uuid,p_deployment_id text,p_status text,p_observed_state text,
  p_missing_environment text[],p_live_url text,p_commit_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_attempt private.website_vercel_deployment_attempts%rowtype; v_attempt_version bigint;
  v_connection_version bigint; v_item text;
begin
  if p_operation_id is null or p_commit_id is null or p_expected_attempt_version is null
    or p_expected_attempt_version<1
    or p_deployment_id is null or p_deployment_id !~ '^dpl_[a-zA-Z0-9]{8,128}$'
    or p_status is null or p_status not in ('connecting','setup-incomplete','deployment-failed','ready')
    or p_observed_state is null or p_observed_state !~ '^[A-Z_]{3,40}$'
    or p_missing_environment is null or cardinality(p_missing_environment)>64
    or (p_status='ready' and (cardinality(p_missing_environment)<>0
      or p_live_url is null or p_live_url !~ '^https://[a-z0-9-]+[.]vercel[.]app$'))
    or (p_status='setup-incomplete' and cardinality(p_missing_environment)=0)
    or (p_status<>'ready' and p_live_url is not null) then raise exception 'Invalid deployment observation'; end if;
  foreach v_item in array p_missing_environment loop
    if v_item !~ '^[A-Z][A-Z0-9_]{1,99}$' then raise exception 'Invalid environment name'; end if;
  end loop;
  if (select count(distinct item) from unnest(p_missing_environment) item)<>cardinality(p_missing_environment)
    then raise exception 'Duplicate environment name'; end if;
  select * into v_attempt from private.website_vercel_deployment_attempts
    where connection_id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id for update;
  if not found or v_attempt.version<>p_expected_attempt_version
    or v_attempt.operation_id<>p_operation_id then raise exception 'Deployment attempt changed'; end if;
  v_attempt_version:=v_attempt.version+1; v_connection_version:=v_attempt.connection_version;
  if p_status<>'connecting' then
    update private.website_infrastructure_connections set status=p_status,
      permissions=array['deployment:read','project-env-vars:read','project:read','team:read','user:read'],
      verified_at=clock_timestamp(),operation_id=null,version=version+1,
      last_commit_id=p_commit_id,updated_at=clock_timestamp()
    where id=p_connection_id and project_id=p_project_id and owner_id=p_owner_id
      and provider='vercel' and version=v_attempt.connection_version
      and target_id=v_attempt.vercel_project_id returning version into v_connection_version;
    if v_connection_version is null then raise exception 'Vercel connection changed'; end if;
    update private.website_vercel_integration_custody set connection_version=v_connection_version,
      updated_at=clock_timestamp() where connection_id=p_connection_id
      and connection_version=v_attempt.connection_version;
    if not found then raise exception 'Vercel custody changed'; end if;
  end if;
  update private.website_vercel_deployment_attempts set deployment_id=p_deployment_id,status=p_status,
    observed_state=p_observed_state,missing_environment=p_missing_environment,live_url=p_live_url,
    connection_version=v_connection_version,last_commit_id=p_commit_id,
    version=v_attempt_version,updated_at=clock_timestamp() where connection_id=p_connection_id;
  return jsonb_build_object('attemptVersion',v_attempt_version,'connectionVersion',v_connection_version);
end $$;
revoke all on function public.website_commit_vercel_deployment_observation(uuid,uuid,uuid,bigint,uuid,text,text,text,text[],text,uuid) from public, anon, authenticated;
grant execute on function public.website_commit_vercel_deployment_observation(uuid,uuid,uuid,bigint,uuid,text,text,text,text[],text,uuid) to service_role;

create function public.website_reconcile_vercel_deployment_observation(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_attempt_version bigint,
  p_operation_id uuid,p_deployment_id text,p_status text,p_observed_state text,
  p_missing_environment text[],p_live_url text,p_commit_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('attemptVersion',a.version,'connectionVersion',a.connection_version)
  from private.website_vercel_deployment_attempts a join public.projects p on p.id=a.project_id
  where a.connection_id=p_connection_id and a.project_id=p_project_id and a.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and a.version=p_expected_attempt_version+1 and a.operation_id=p_operation_id
    and a.deployment_id=p_deployment_id and a.status=p_status
    and a.observed_state=p_observed_state and a.missing_environment=p_missing_environment
    and a.live_url is not distinct from p_live_url and a.last_commit_id=p_commit_id;
$$;
revoke all on function public.website_reconcile_vercel_deployment_observation(uuid,uuid,uuid,bigint,uuid,text,text,text,text[],text,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_vercel_deployment_observation(uuid,uuid,uuid,bigint,uuid,text,text,text,text[],text,uuid) to service_role;
