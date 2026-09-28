-- Platform metadata only. Customer source and GitHub tokens remain outside Tayar DB.
create table private.website_github_export_cursors (
  connection_id uuid primary key references private.website_infrastructure_connections(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  repository_id text not null check (repository_id ~ '^[1-9][0-9]{0,19}$'),
  environment text not null check (environment in ('preview','production')),
  branch text not null check (branch ~ '^tayar/[0-9a-f-]{36}/(preview|production)$'),
  connection_version bigint not null check (connection_version > 0),
  last_head_sha text check (last_head_sha ~ '^[0-9a-f]{40}$'),
  last_source_digest text check (last_source_digest ~ '^[0-9a-f]{64}$'),
  last_operation_id uuid,
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default clock_timestamp(),
  check ((last_head_sha is null) = (last_source_digest is null)),
  check ((last_head_sha is null) = (last_operation_id is null))
);
alter table private.website_github_export_cursors enable row level security;
revoke all on private.website_github_export_cursors from public, anon, authenticated;

create function public.website_initialize_github_export_cursor(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid,
  p_connection_version bigint, p_repository_id text, p_branch text
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_environment text;
begin
  select c.environment into v_environment from private.website_infrastructure_connections c
    join public.projects p on p.id=c.project_id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='github' and c.status in ('connected','ready')
    and c.version=p_connection_version and c.target_id=p_repository_id for update of c;
  if not found or p_branch is distinct from ('tayar/' || p_project_id::text || '/' || v_environment) then
    raise exception 'GitHub export target changed';
  end if;
  insert into private.website_github_export_cursors
    (connection_id,project_id,owner_id,repository_id,environment,branch,connection_version)
  values (p_connection_id,p_project_id,p_owner_id,p_repository_id,v_environment,p_branch,p_connection_version);
  return 1;
end $$;
revoke all on function public.website_initialize_github_export_cursor(uuid,uuid,uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.website_initialize_github_export_cursor(uuid,uuid,uuid,bigint,text,text) to service_role;

create function public.website_github_export_cursor_for_worker(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  select jsonb_build_object('projectId',c.project_id,'connectionVersion',c.connection_version,
    'repositoryId',c.repository_id,'environment',c.environment,'branch',c.branch,'lastHeadSha',c.last_head_sha,
    'lastSourceDigest',c.last_source_digest,'version',c.version)
  into v_result from private.website_github_export_cursors c
  join public.projects p on p.id=c.project_id
  where c.connection_id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null;
  return v_result;
end $$;
revoke all on function public.website_github_export_cursor_for_worker(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.website_github_export_cursor_for_worker(uuid,uuid,uuid) to service_role;

create function public.website_commit_github_export_cursor(
  p_connection_id uuid, p_project_id uuid, p_owner_id uuid, p_connection_version bigint,
  p_expected_version bigint, p_expected_head text, p_new_head text,
  p_source_digest text, p_operation_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_version bigint;
begin
  if p_operation_id is null or p_new_head is null or p_new_head !~ '^[0-9a-f]{40}$'
    or p_source_digest is null or p_source_digest !~ '^[0-9a-f]{64}$'
    or (p_expected_head is not null and p_expected_head !~ '^[0-9a-f]{40}$')
    or p_expected_version is null or p_expected_version < 1 then
    raise exception 'Invalid GitHub export cursor';
  end if;
  perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
    and type='website-builder' and deleted_at is null for update;
  if not found then raise exception 'Project access denied'; end if;
  update private.website_github_export_cursors cursor set last_head_sha=p_new_head,
    last_source_digest=p_source_digest,last_operation_id=p_operation_id,
    version=cursor.version+1,updated_at=clock_timestamp()
  from private.website_infrastructure_connections connection
  where cursor.connection_id=p_connection_id and cursor.project_id=p_project_id
    and cursor.owner_id=p_owner_id and cursor.connection_version=p_connection_version
    and cursor.version=p_expected_version and cursor.last_head_sha is not distinct from p_expected_head
    and connection.id=cursor.connection_id and connection.owner_id=p_owner_id
    and connection.project_id=p_project_id and connection.provider='github'
    and connection.environment=cursor.environment
    and connection.status in ('connected','ready') and connection.version=p_connection_version
    and connection.target_id=cursor.repository_id
  returning cursor.version into v_version;
  if v_version is null then raise exception 'GitHub export cursor changed'; end if;
  return v_version;
end $$;
revoke all on function public.website_commit_github_export_cursor(uuid,uuid,uuid,bigint,bigint,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.website_commit_github_export_cursor(uuid,uuid,uuid,bigint,bigint,text,text,text,uuid) to service_role;

create function public.website_reconcile_github_export_cursor(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_operation_id uuid,
  p_expected_version bigint,p_new_head text,p_source_digest text
) returns bigint language plpgsql stable security definer set search_path = '' as $$
declare v_version bigint;
begin
  select cursor.version into v_version from private.website_github_export_cursors cursor
    join public.projects p on p.id=cursor.project_id
  where cursor.connection_id=p_connection_id and cursor.project_id=p_project_id
    and cursor.owner_id=p_owner_id and p.user_id=p_owner_id and p.type='website-builder'
    and p.deleted_at is null and cursor.last_operation_id=p_operation_id
    and cursor.version=p_expected_version+1 and cursor.last_head_sha=p_new_head
    and cursor.last_source_digest=p_source_digest;
  return v_version;
end $$;
revoke all on function public.website_reconcile_github_export_cursor(uuid,uuid,uuid,uuid,bigint,text,text) from public, anon, authenticated;
grant execute on function public.website_reconcile_github_export_cursor(uuid,uuid,uuid,uuid,bigint,text,text) to service_role;
