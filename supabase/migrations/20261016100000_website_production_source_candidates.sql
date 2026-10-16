-- Immutable source-preparation handoff only. This grants no deployment,
-- environment mutation, domain activation or customer delivery permission.
create table private.website_production_source_candidates (
 operation_id uuid primary key,
 project_id uuid not null references public.projects(id) on delete cascade,
 owner_id uuid not null,
 preview_operation_id uuid not null references private.website_byo_publish_operations(operation_id) on delete cascade,
 github_connection_id uuid not null references private.website_infrastructure_connections(id) on delete cascade,
 snapshot_digest text not null check(snapshot_digest~'^[0-9a-f]{64}$'),
 runtime_digest text not null check(runtime_digest~'^[0-9a-f]{64}$'),
 source_digest text not null check(source_digest~'^[0-9a-f]{64}$'),
 head_sha text not null check(head_sha~'^[0-9a-f]{40}$'),
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 created_at timestamptz not null default clock_timestamp(),
 check(operation_id<>preview_operation_id)
);
create index website_production_source_candidates_project_idx
 on private.website_production_source_candidates(project_id,owner_id);
create index website_production_source_candidates_preview_idx
 on private.website_production_source_candidates(preview_operation_id);
create index website_production_source_candidates_github_idx
 on private.website_production_source_candidates(github_connection_id);
alter table private.website_production_source_candidates enable row level security;
revoke all on private.website_production_source_candidates from public,anon,authenticated,service_role;

-- Reuse existing connection, binding, export-cursor and Preview checkpoints.
-- Store only their immutable identity/version metadata, never provider grants,
-- public backend values, source files or another copy of the saved project.
create function private.website_production_source_scope(
 p_project_id uuid,p_owner_id uuid,p_preview_operation_id uuid,p_github_connection_id uuid
) returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object(
  'contentDigest',encode(sha256(convert_to(p.content::text,'UTF8')),'hex'),
  'preview',jsonb_build_array(o.operation_id,o.version,o.source_digest,o.head_sha,o.deployment_id,o.attempt_version,o.live_url),
  'previewExport',jsonb_build_array(pg.connection_id,pg.version,pg.last_head_sha,pg.last_source_digest),
  'productionExport',jsonb_build_array(g.connection_id,g.version,g.last_head_sha,g.last_source_digest),
  'bindings',jsonb_build_array(pb.version,b.version),
  'connections',(select jsonb_agg(jsonb_build_array(c.id,c.version,c.account_id,c.target_id,c.status,c.verified_at,c.permissions) order by c.id)
    from private.website_infrastructure_connections c where c.id in(gc.id,pgc.id,s.id,ps.id,v.id,pv.id)),
  'sourceDigest',g.last_source_digest,'headSha',g.last_head_sha,'previewSourceDigest',o.source_digest
 )
 from public.projects p
 join private.website_byo_publish_operations o on o.project_id=p.id and o.owner_id=p.user_id
 join private.website_github_export_cursors pg on pg.project_id=p.id and pg.owner_id=p.user_id and pg.environment='preview'
 join private.website_github_export_cursors g on g.project_id=p.id and g.owner_id=p.user_id and g.environment='production'
 join private.website_infrastructure_connections pgc on pgc.id=pg.connection_id
 join private.website_infrastructure_connections gc on gc.id=g.connection_id
 join private.website_byo_runtime_bindings pb on pb.project_id=p.id and pb.owner_id=p.user_id and pb.environment='preview'
 join private.website_byo_runtime_bindings b on b.project_id=p.id and b.owner_id=p.user_id and b.environment='production'
 join private.website_infrastructure_connections ps on ps.id=pb.supabase_connection_id
 join private.website_infrastructure_connections s on s.id=b.supabase_connection_id
 join private.website_infrastructure_connections pv on pv.id=pb.vercel_connection_id
 join private.website_infrastructure_connections v on v.id=b.vercel_connection_id
 where p.id=p_project_id and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and o.operation_id=p_preview_operation_id and o.environment='preview' and o.stage='ready'
  and o.source_digest=pg.last_source_digest and o.head_sha=pg.last_head_sha and o.deployment_id is not null and o.live_url is not null
  and g.connection_id=p_github_connection_id and g.last_head_sha is not null and g.last_source_digest is not null
  and g.branch='tayar/'||p.id::text||'/production' and pg.branch='tayar/'||p.id::text||'/preview'
  and g.last_source_digest<>pg.last_source_digest and g.repository_id=pg.repository_id
  and gc.provider='github' and gc.environment='production' and gc.version=g.connection_version
  and pgc.provider='github' and pgc.environment='preview' and pgc.version=pg.connection_version
  and gc.project_id=p.id and pgc.project_id=p.id and gc.owner_id=p.user_id and pgc.owner_id=p.user_id
  and gc.status in('connected','ready') and pgc.status in('connected','ready')
  and gc.target_id=g.repository_id and pgc.target_id=pg.repository_id and gc.account_id=pgc.account_id
  and b.application_definition=p.content->'application' and pb.application_definition=p.content->'application'
  and b.application_origin=pb.application_origin
  and s.provider='supabase' and s.environment='production' and ps.provider='supabase' and ps.environment='preview'
  and s.project_id=p.id and ps.project_id=p.id and s.owner_id=p.user_id and ps.owner_id=p.user_id
  and s.version=b.supabase_connection_version and ps.version=pb.supabase_connection_version
  and s.status='ready' and ps.status='ready' and s.target_id<>ps.target_id
  and v.provider='vercel' and v.environment='production' and pv.provider='vercel' and pv.environment='preview'
  and v.project_id=p.id and pv.project_id=p.id and v.owner_id=p.user_id and pv.owner_id=p.user_id
  and v.version=b.vercel_connection_version and pv.version=pb.vercel_connection_version
  and v.status in('connected','setup-incomplete','deployment-failed','ready')
  and pv.status in('connected','setup-incomplete','deployment-failed','ready')
  and v.account_id=pv.account_id and v.target_id=pv.target_id
  and gc.verified_at is not null and pgc.verified_at is not null and s.verified_at is not null
  and ps.verified_at is not null and v.verified_at is not null and pv.verified_at is not null;
$$;
revoke all on function private.website_production_source_scope(uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;

create function private.website_production_source_candidate_json(v private.website_production_source_candidates)
returns jsonb language sql stable security invoker set search_path='' as $$ select jsonb_build_object(
 'status','source-prepared','operationId',v.operation_id,'projectId',v.project_id,'ownerId',v.owner_id,
 'previewOperationId',v.preview_operation_id,'githubConnectionId',v.github_connection_id,
 'previewSourceDigest',v.scope->>'previewSourceDigest','snapshotDigest',v.snapshot_digest,'runtimeDigest',v.runtime_digest,'sourceDigest',v.source_digest,'headSha',v.head_sha); $$;
revoke all on function private.website_production_source_candidate_json(private.website_production_source_candidates) from public,anon,authenticated,service_role;

create function public.website_read_production_source_candidate(p_operation_id uuid,p_project_id uuid,p_owner_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select private.website_production_source_candidate_json(c) from private.website_production_source_candidates c
 where c.operation_id=p_operation_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and c.scope=private.website_production_source_scope(c.project_id,c.owner_id,c.preview_operation_id,c.github_connection_id); $$;
revoke all on function public.website_read_production_source_candidate(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_read_production_source_candidate(uuid,uuid,uuid) to service_role;

create function public.website_record_production_source_candidate(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_preview_operation_id uuid,p_github_connection_id uuid,
 p_preview_source_digest text,p_snapshot_digest text,p_runtime_digest text,p_source_digest text,p_head_sha text,p_snapshot jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_scope jsonb;v private.website_production_source_candidates%rowtype;
begin
 if p_operation_id is null or p_preview_operation_id is null or p_operation_id=p_preview_operation_id
  or p_snapshot_digest is null or p_snapshot_digest!~'^[0-9a-f]{64}$'
  or p_runtime_digest is null or p_runtime_digest!~'^[0-9a-f]{64}$'
  or p_source_digest is null or p_source_digest!~'^[0-9a-f]{64}$'
  or p_preview_source_digest is null or p_preview_source_digest!~'^[0-9a-f]{64}$'
  or p_head_sha is null or p_head_sha!~'^[0-9a-f]{40}$'
  then raise exception 'Production source candidate unavailable';end if;
 perform 1 from public.projects where id=p_project_id and user_id=p_owner_id
  and type='website-builder' and deleted_at is null and content=p_snapshot for share;
 if not found then raise exception 'Production source candidate changed';end if;
 perform c.id from private.website_infrastructure_connections c where c.project_id=p_project_id and c.owner_id=p_owner_id order by c.id for share;
 perform 1 from private.website_byo_runtime_bindings where project_id=p_project_id and owner_id=p_owner_id order by environment for share;
 perform 1 from private.website_github_export_cursors where project_id=p_project_id and owner_id=p_owner_id order by connection_id for share;
 perform 1 from private.website_byo_publish_operations where operation_id=p_preview_operation_id for share;
 v_scope:=private.website_production_source_scope(p_project_id,p_owner_id,p_preview_operation_id,p_github_connection_id);
 if v_scope is null or v_scope->>'sourceDigest' is distinct from p_source_digest
  or v_scope->>'headSha' is distinct from p_head_sha or v_scope->>'previewSourceDigest' is distinct from p_preview_source_digest
  then raise exception 'Production source candidate changed';end if;
 insert into private.website_production_source_candidates(operation_id,project_id,owner_id,preview_operation_id,
  github_connection_id,snapshot_digest,runtime_digest,source_digest,head_sha,scope)
 values(p_operation_id,p_project_id,p_owner_id,p_preview_operation_id,p_github_connection_id,
  p_snapshot_digest,p_runtime_digest,p_source_digest,p_head_sha,v_scope) on conflict(operation_id) do nothing;
 select * into v from private.website_production_source_candidates where operation_id=p_operation_id
  and project_id=p_project_id and owner_id=p_owner_id and preview_operation_id=p_preview_operation_id
  and github_connection_id=p_github_connection_id and snapshot_digest=p_snapshot_digest and runtime_digest=p_runtime_digest
  and source_digest=p_source_digest and head_sha=p_head_sha and scope=v_scope;
 if not found then raise exception 'Production source candidate changed';end if;
 return private.website_production_source_candidate_json(v);
end $$;
revoke all on function public.website_record_production_source_candidate(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.website_record_production_source_candidate(uuid,uuid,uuid,uuid,uuid,text,text,text,text,text,jsonb) to service_role;
