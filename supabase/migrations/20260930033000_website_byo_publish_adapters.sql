-- Read-only evidence used by the trusted Publish adapters. Neither function
-- returns provider grants, secret values, logs or editable project data.
create function public.website_vercel_deployment_attempt_for_worker(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid
) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',a.version,'operationId',a.operation_id,'status',a.status,
  'sourceCommitSha',a.source_commit_sha,'deploymentId',a.deployment_id)
 from private.website_vercel_deployment_attempts a
 join public.projects p on p.id=a.project_id
 join private.website_infrastructure_connections c on c.id=a.connection_id
 where a.connection_id=p_connection_id and a.project_id=p_project_id and a.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.project_id=a.project_id and c.owner_id=a.owner_id and c.provider='vercel';
$$;
revoke all on function public.website_vercel_deployment_attempt_for_worker(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.website_vercel_deployment_attempt_for_worker(uuid,uuid,uuid) to service_role;

create function public.website_verify_vercel_secret_receipts(
 p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_connection_version bigint,p_vercel_project_id text,
 p_target text,p_git_branch text,p_required_environment text[]
) returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_item text;v_count bigint;
begin
 if p_connection_version is null or p_connection_version<1 or p_vercel_project_id!~'^prj_[A-Za-z0-9]{8,128}$'
  or p_target not in('preview','production')or p_git_branch is null or length(p_git_branch)>200
  or p_git_branch~'\.\.' or p_required_environment is null or cardinality(p_required_environment)>64 then return false;end if;
 foreach v_item in array p_required_environment loop if v_item!~'^[A-Z][A-Z0-9_]{1,99}$' then return false;end if;end loop;
 if cardinality(p_required_environment)<>(select count(distinct x)from unnest(p_required_environment)x)
  or p_required_environment<>(select coalesce(array_agg(x order by x),'{}')from unnest(p_required_environment)x)then return false;end if;
 perform 1 from private.website_infrastructure_connections c
 join private.website_vercel_integration_custody v on v.connection_id=c.id
 join public.projects p on p.id=c.project_id
 where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id and c.provider='vercel'
  and c.version=p_connection_version and c.target_id=p_vercel_project_id and c.environment=p_target
  and c.status in('connected','setup-incomplete','deployment-failed','ready')
  and v.project_id=c.project_id and v.owner_id=c.owner_id and v.connection_version=c.version
  and v.vercel_project_id=c.target_id and v.production_branch=p_git_branch and v.custody_expires_at>clock_timestamp()
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null;
 if not found then return false;end if;
 select count(distinct h.environment_key)into v_count from private.website_vercel_secret_handoffs h
 where h.connection_id=p_connection_id and h.project_id=p_project_id and h.owner_id=p_owner_id
  and h.connection_version=p_connection_version and h.vercel_project_id=p_vercel_project_id
  and h.target=p_target and h.git_branch=p_git_branch and h.status='verified'
  and h.environment_key=any(p_required_environment)and h.vercel_environment_id is not null and h.verified_at is not null;
 return v_count=cardinality(p_required_environment);
end $$;
revoke all on function public.website_verify_vercel_secret_receipts(uuid,uuid,uuid,bigint,text,text,text,text[]) from public,anon,authenticated;
grant execute on function public.website_verify_vercel_secret_receipts(uuid,uuid,uuid,bigint,text,text,text,text[]) to service_role;
