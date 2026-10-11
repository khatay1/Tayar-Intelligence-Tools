-- Metadata-only readiness for customer-owned Resend keys. Raw values continue
-- through the generic Vault-to-Vercel handoff and never leave service_role RPCs.
create function public.website_email_runtime_state_for_worker(
 p_project_id uuid,p_owner_id uuid,p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_source_connection_id text,p_source_updated_at timestamptz,p_environment_key text,p_environment text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_vercel private.website_infrastructure_connections%rowtype;
 v_handoff private.website_vercel_secret_handoffs%rowtype;
 v_source_available boolean:=false;v_ready boolean:=false;v_branch text;
begin
 if p_project_id is null or p_owner_id is null or p_vercel_connection_id is null
  or p_vercel_connection_version is null or p_vercel_connection_version<1
  or p_source_connection_id is null or p_source_connection_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$'
  or p_source_updated_at is null
  or p_environment_key is null
  or p_environment_key!~'^TAYAR_RESEND_([0][1-9]|[1-9][0-9])_API_KEY$'
  or p_environment not in('preview','production')
  then raise exception 'Email runtime state unavailable';end if;
 v_branch:=case when p_environment='preview' then 'tayar/'||p_project_id::text||'/preview' else '' end;
 select c.* into v_vercel from private.website_infrastructure_connections c
 join public.projects p on p.id=c.project_id
 where c.id=p_vercel_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.provider='vercel' and c.environment=p_environment and c.version=p_vercel_connection_version
  and c.status in('connected','setup-incomplete','deployment-failed','ready') and c.target_id is not null;
 if not found then raise exception 'Email runtime state unavailable';end if;
 select h.* into v_handoff from private.website_vercel_secret_handoffs h
 where h.connection_id=p_vercel_connection_id and h.project_id=p_project_id and h.owner_id=p_owner_id
  and h.source_connection_id=p_source_connection_id and h.source_field='apiKey'
  and h.source_environment=p_environment and h.environment_key=p_environment_key
  and h.target=p_environment and h.git_branch=v_branch;
 select exists(select 1 from private.website_project_secrets s
  where s.project_id=p_project_id and s.connection_id=p_source_connection_id and s.field='apiKey'
   and s.environment=p_environment and s.updated_at=p_source_updated_at) into v_source_available;
 v_ready:=v_handoff.id is not null and v_handoff.status='verified'
  and v_handoff.source_updated_at=p_source_updated_at and v_handoff.vercel_project_id=v_vercel.target_id
  and v_handoff.vercel_environment_id is not null and not v_source_available;
 return jsonb_build_object(
  'handoffId',v_handoff.id,'handoffVersion',coalesce(v_handoff.version,0),
  'handoffStatus',v_handoff.status,'handoffOperationId',v_handoff.operation_id,
  'environmentId',v_handoff.vercel_environment_id,'sourceAvailable',v_source_available,'ready',v_ready);
end $$;
revoke all on function public.website_email_runtime_state_for_worker(uuid,uuid,uuid,bigint,text,timestamptz,text,text)
 from public,anon,authenticated;
grant execute on function public.website_email_runtime_state_for_worker(uuid,uuid,uuid,bigint,text,timestamptz,text,text)
 to service_role;

-- A verified receipt represents the same immutable source version after its
-- Vault row is erased. Preserve that original timestamp across later captures.
create or replace function private.website_project_secret_refs_impl(p_project_id uuid)
returns table(connection_id text,field text,environment text,ref text,updated_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from public.projects where id=p_project_id
  and user_id=(select auth.uid()) and type='website-builder' and deleted_at is null
  and (((select auth.jwt())->>'is_anonymous')::boolean) is not true)
  then raise exception 'Project access denied';end if;
 return query select distinct on(r.connection_id,r.field,r.environment)
  r.connection_id,r.field,r.environment,
  'secret://website/'||p_project_id::text||'/'||r.connection_id||'/'||r.field||'/'||r.environment,
  r.updated_at
 from(
  select s.connection_id,s.field,s.environment,s.updated_at,0 as priority
   from private.website_project_secrets s where s.project_id=p_project_id
    and s.connection_id not in('runtime-supabase','runtime-cron')
  union all
  select h.source_connection_id,h.source_field,h.source_environment,h.source_updated_at,1
   from private.website_vercel_secret_handoffs h where h.project_id=p_project_id and h.status='verified'
    and h.source_connection_id not in('runtime-supabase','runtime-cron')
 )r order by r.connection_id,r.field,r.environment,r.priority,r.updated_at desc;
end $$;
revoke all on function private.website_project_secret_refs_impl(uuid) from public;
grant execute on function private.website_project_secret_refs_impl(uuid) to authenticated;
