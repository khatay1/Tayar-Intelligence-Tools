-- A fully verified handoff remains recoverable after its source Vault value was
-- erased. This read exposes receipt metadata only and deliberately does not
-- require live provider custody or any secret row.
create function public.website_reconcile_completed_vercel_secret_handoff(
  p_id uuid,p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_connection_version bigint,
  p_expected_handoff_version bigint,p_source_connection_id text,p_source_field text,
  p_source_environment text,p_environment_key text,p_target text,p_git_branch text,p_operation_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('handoffVersion',h.version,'environmentId',h.vercel_environment_id)
  from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  where h.id=p_id and h.connection_id=p_connection_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.connection_version=p_connection_version and h.version=p_expected_handoff_version+2
    and h.source_connection_id=p_source_connection_id and h.source_field=p_source_field
    and h.source_environment=p_source_environment and h.environment_key=p_environment_key
    and h.target=p_target and h.git_branch=p_git_branch and h.operation_id=p_operation_id
    and h.status='verified' and h.vercel_environment_id is not null and h.verified_at is not null;
$$;
revoke all on function public.website_reconcile_completed_vercel_secret_handoff(
  uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text,text,text,uuid
) from public,anon,authenticated;
grant execute on function public.website_reconcile_completed_vercel_secret_handoff(
  uuid,uuid,uuid,uuid,bigint,bigint,text,text,text,text,text,text,uuid
) to service_role;
