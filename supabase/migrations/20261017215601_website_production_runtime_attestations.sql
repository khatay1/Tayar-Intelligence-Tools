-- Immutable evidence that the exact unaliased Production deployment answered
-- the release-identity challenge. This is not activation, behavior or delivery approval.
create table private.website_production_runtime_attestations (
 operation_id uuid primary key references private.website_production_staging_claims(operation_id) on delete cascade,
 scope jsonb not null check(jsonb_typeof(scope)='object'),
 deployment_id text not null check(deployment_id~'^dpl_[A-Za-z0-9]{8,128}$'),
 live_url text not null check(live_url~'^https://[a-z0-9-]+\.vercel\.app$'),
 source_digest text not null check(source_digest~'^[a-f0-9]{64}$'),
 runtime_digest text not null check(runtime_digest~'^[a-f0-9]{64}$'),
 verified_at timestamptz not null default clock_timestamp()
);
alter table private.website_production_runtime_attestations enable row level security;
revoke all on private.website_production_runtime_attestations from public,anon,authenticated,service_role;

create function private.website_production_runtime_attestation_current(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,
 p_scope jsonb,p_deployment_id text,p_live_url text,p_source_digest text,p_runtime_digest text)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from private.website_production_staging_claims s
 join private.website_production_source_candidates c on c.operation_id=s.operation_id
 where s.operation_id=p_operation_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and s.scope=p_scope and s.deployment_id=p_deployment_id
  and private.website_production_staging_scope_current(p_operation_id,p_project_id,p_owner_id,p_scope)
  and c.source_digest=p_source_digest and c.runtime_digest=p_runtime_digest
  and p_live_url~'^https://[a-z0-9-]+\.vercel\.app$');
$$;
revoke all on function private.website_production_runtime_attestation_current(uuid,uuid,uuid,jsonb,text,text,text,text)
 from public,anon,authenticated,service_role;

create function public.website_record_production_runtime_attestation(
 p_operation_id uuid,p_project_id uuid,p_owner_id uuid,p_scope jsonb,p_deployment_id text,
 p_live_url text,p_source_digest text,p_runtime_digest text)
returns jsonb language plpgsql security definer set search_path='' set lock_timeout='5s' as $$
declare v private.website_production_runtime_attestations%rowtype;
begin
 if p_operation_id is null or p_project_id is null or p_owner_id is null or p_scope is null
  or jsonb_typeof(p_scope)<>'object' or octet_length(p_scope::text)>16384
  or p_deployment_id is null or p_deployment_id!~'^dpl_[A-Za-z0-9]{8,128}$'
  or p_live_url is null or p_live_url!~'^https://[a-z0-9-]+\.vercel\.app$'
  or p_source_digest is null or p_source_digest!~'^[a-f0-9]{64}$'
  or p_runtime_digest is null or p_runtime_digest!~'^[a-f0-9]{64}$'
  then raise exception 'Production runtime attestation unavailable';end if;
 perform private.website_lock_production_staging_scope(p_operation_id,p_project_id,p_owner_id);
 perform 1 from private.website_production_staging_claims where operation_id=p_operation_id for update;
 if not private.website_production_runtime_attestation_current(p_operation_id,p_project_id,p_owner_id,p_scope,
  p_deployment_id,p_live_url,p_source_digest,p_runtime_digest)
  then raise exception 'Production runtime attestation changed';end if;
 insert into private.website_production_runtime_attestations(operation_id,scope,deployment_id,live_url,source_digest,runtime_digest)
 values(p_operation_id,p_scope,p_deployment_id,p_live_url,p_source_digest,p_runtime_digest)
 on conflict(operation_id) do nothing;
 select * into v from private.website_production_runtime_attestations where operation_id=p_operation_id for update;
 if not found or v.scope<>p_scope or v.deployment_id<>p_deployment_id or v.live_url<>p_live_url
  or v.source_digest<>p_source_digest or v.runtime_digest<>p_runtime_digest
  then raise exception 'Production runtime attestation changed';end if;
 return jsonb_build_object('status','runtime-verified','operationId',v.operation_id,'deploymentId',v.deployment_id,
  'liveUrl',v.live_url,'sourceDigest',v.source_digest,'runtimeDigest',v.runtime_digest);
end $$;
revoke all on function public.website_record_production_runtime_attestation(uuid,uuid,uuid,jsonb,text,text,text,text)
 from public,anon,authenticated;
grant execute on function public.website_record_production_runtime_attestation(uuid,uuid,uuid,jsonb,text,text,text,text) to service_role;

create function public.website_read_production_runtime_attestation(p_operation_id uuid,p_project_id uuid,p_owner_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('status','runtime-verified','operationId',a.operation_id,'deploymentId',a.deployment_id,
  'liveUrl',a.live_url,'sourceDigest',a.source_digest,'runtimeDigest',a.runtime_digest)
 from private.website_production_runtime_attestations a
 where a.operation_id=p_operation_id
  and private.website_production_runtime_attestation_current(p_operation_id,p_project_id,p_owner_id,a.scope,
   a.deployment_id,a.live_url,a.source_digest,a.runtime_digest);
$$;
revoke all on function public.website_read_production_runtime_attestation(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_read_production_runtime_attestation(uuid,uuid,uuid) to service_role;
