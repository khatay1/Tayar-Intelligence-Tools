-- Removal is a separate resumable operation. Provider absence is proven before
-- the verified receipt stops satisfying the opaque project secret reference.
alter table private.website_vercel_secret_handoffs
  drop constraint website_vercel_secret_handoffs_status_check;
alter table private.website_vercel_secret_handoffs
  add constraint website_vercel_secret_handoffs_status_check
  check (status in ('preparing','verified','removing','removed'));
alter table private.website_vercel_secret_handoffs add column removed_at timestamptz;

-- This recovery read deliberately does not require live provider custody. A
-- commit that already erased the receipt must remain recoverable after revoke.
create function public.website_reconcile_completed_vercel_secret_removal(
  p_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_handoff_version bigint,
  p_operation_id uuid,p_commit_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select h.version from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  where h.id=p_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_expected_handoff_version+2 and h.operation_id=p_operation_id
    and h.status='removed' and h.last_commit_id=p_commit_id and h.removed_at is not null;
$$;
revoke all on function public.website_reconcile_completed_vercel_secret_removal(uuid,uuid,uuid,bigint,uuid,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_completed_vercel_secret_removal(uuid,uuid,uuid,bigint,uuid,uuid) to service_role;

create function public.website_begin_vercel_secret_removal(
  p_id uuid,p_project_id uuid,p_owner_id uuid,p_connection_version bigint,
  p_expected_handoff_version bigint,p_operation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_handoff private.website_vercel_secret_handoffs%rowtype;
  v_token text; v_user_id text; v_account_id text; v_project_id text; v_version bigint;
begin
  if p_id is null or p_operation_id is null or p_connection_version is null
    or p_connection_version<1 or p_expected_handoff_version is null
    or p_expected_handoff_version<1 then raise exception 'Invalid Vercel secret removal'; end if;
  select h.* into v_handoff
  from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  join private.website_infrastructure_connections c on c.id=h.connection_id
  join private.website_vercel_integration_custody v on v.connection_id=c.id
  where h.id=p_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.project_id=h.project_id and c.owner_id=h.owner_id and c.provider='vercel'
    and c.version=p_connection_version and h.connection_version=c.version
    and c.target_id=h.vercel_project_id and v.connection_version=c.version
    and v.vercel_project_id=c.target_id and v.custody_expires_at>clock_timestamp()
  for update of h,c;
  if not found then raise exception 'Vercel secret removal changed'; end if;
  select d.decrypted_secret,v.user_id,v.account_id,v.vercel_project_id
  into v_token,v_user_id,v_account_id,v_project_id
  from private.website_vercel_integration_custody v
  join vault.decrypted_secrets d on d.id=v.secret_id
  where v.connection_id=v_handoff.connection_id and v.project_id=v_handoff.project_id
    and v.owner_id=v_handoff.owner_id and v.connection_version=v_handoff.connection_version
    and v.vercel_project_id=v_handoff.vercel_project_id
    and v.custody_expires_at>clock_timestamp();
  if not found or v_token is null then raise exception 'Vercel secret removal changed'; end if;
  if v_handoff.status='removed' and v_handoff.operation_id=p_operation_id
    and v_handoff.version=p_expected_handoff_version+2 then
    return jsonb_build_object('alreadyRemoved',true,'handoffVersion',v_handoff.version);
  end if;
  if v_handoff.status='removing' and v_handoff.operation_id=p_operation_id
    and v_handoff.version=p_expected_handoff_version+1 then v_version:=v_handoff.version;
  elsif v_handoff.status='verified' and v_handoff.version=p_expected_handoff_version then
    if v_handoff.vercel_environment_id is null then raise exception 'Vercel secret destination missing'; end if;
    v_version:=v_handoff.version+1;
    update private.website_vercel_secret_handoffs set status='removing',operation_id=p_operation_id,
      last_commit_id=null,removed_at=null,version=v_version,updated_at=clock_timestamp()
      where id=p_id;
  else raise exception 'Vercel secret removal changed'; end if;
  return jsonb_build_object('alreadyRemoved',false,'handoffVersion',v_version,
    'accessToken',v_token,'userId',v_user_id,'accountId',v_account_id,
    'vercelProjectId',v_project_id,'environmentId',v_handoff.vercel_environment_id,
    'environmentKey',v_handoff.environment_key,'target',v_handoff.target,
    'gitBranch',v_handoff.git_branch);
end $$;
revoke all on function public.website_begin_vercel_secret_removal(uuid,uuid,uuid,bigint,bigint,uuid) from public, anon, authenticated;
grant execute on function public.website_begin_vercel_secret_removal(uuid,uuid,uuid,bigint,bigint,uuid) to service_role;

create function public.website_commit_vercel_secret_removal(
  p_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_removal_version bigint,
  p_operation_id uuid,p_vercel_environment_id text,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_next bigint;
begin
  if p_operation_id is null or p_commit_id is null or p_expected_removal_version is null
    or p_expected_removal_version<2 or p_vercel_environment_id is null
    or p_vercel_environment_id !~ '^[a-zA-Z0-9_-]{3,128}$'
    then raise exception 'Invalid Vercel secret removal commit'; end if;
  perform 1 from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  join private.website_infrastructure_connections c on c.id=h.connection_id
  join private.website_vercel_integration_custody v on v.connection_id=c.id
  where h.id=p_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_expected_removal_version and h.operation_id=p_operation_id
    and h.status='removing' and h.vercel_environment_id=p_vercel_environment_id
    and c.project_id=h.project_id and c.owner_id=h.owner_id and c.provider='vercel'
    and c.version=h.connection_version and c.target_id=h.vercel_project_id
    and v.connection_version=c.version and v.custody_expires_at>clock_timestamp()
  for update of h;
  if not found then raise exception 'Vercel secret removal changed'; end if;
  v_next:=p_expected_removal_version+1;
  update private.website_vercel_secret_handoffs set status='removed',last_commit_id=p_commit_id,
    version=v_next,removed_at=clock_timestamp(),updated_at=clock_timestamp() where id=p_id;
  return v_next;
end $$;
revoke all on function public.website_commit_vercel_secret_removal(uuid,uuid,uuid,bigint,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.website_commit_vercel_secret_removal(uuid,uuid,uuid,bigint,uuid,text,uuid) to service_role;

create function public.website_reconcile_vercel_secret_removal(
  p_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_removal_version bigint,
  p_operation_id uuid,p_vercel_environment_id text,p_commit_id uuid
) returns bigint language sql stable security definer set search_path = '' as $$
  select h.version from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  where h.id=p_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_expected_removal_version+1 and h.operation_id=p_operation_id
    and h.status='removed' and h.vercel_environment_id=p_vercel_environment_id
    and h.last_commit_id=p_commit_id and h.removed_at is not null;
$$;
revoke all on function public.website_reconcile_vercel_secret_removal(uuid,uuid,uuid,bigint,uuid,text,uuid) from public, anon, authenticated;
grant execute on function public.website_reconcile_vercel_secret_removal(uuid,uuid,uuid,bigint,uuid,text,uuid) to service_role;
