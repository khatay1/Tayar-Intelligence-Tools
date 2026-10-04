-- Durable Stripe publish preparation. Browser secret writes receive the exact
-- database timestamp used by the later service-only handoff CAS, while the
-- publish worker receives metadata-only state and never raw credentials.
create function public.website_set_project_secret_v2(
 p_project_id uuid,p_connection_id text,p_field text,p_environment text,p_value text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ref text;v_updated_at timestamptz;
begin
 v_ref:=private.website_set_project_secret_impl(p_project_id,p_connection_id,p_field,p_environment,p_value);
 select s.updated_at into v_updated_at from private.website_project_secrets s
 where s.project_id=p_project_id and s.connection_id=p_connection_id
  and s.field=p_field and s.environment=p_environment;
 if v_updated_at is null then raise exception 'Project secret receipt unavailable';end if;
 return jsonb_build_object('ref',v_ref,'updatedAt',v_updated_at);
end $$;
revoke all on function public.website_set_project_secret_v2(uuid,text,text,text,text) from public,anon;
grant execute on function public.website_set_project_secret_v2(uuid,text,text,text,text) to authenticated;

create function public.website_stripe_runtime_state_for_worker(
 p_project_id uuid,p_owner_id uuid,p_vercel_connection_id uuid,p_vercel_connection_version bigint,
 p_source_connection_id text,p_source_updated_at timestamptz,p_environment text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_vercel private.website_infrastructure_connections%rowtype;
 v_stripe private.website_infrastructure_connections%rowtype;
 v_handoff private.website_vercel_secret_handoffs%rowtype;
 v_source_available boolean:=false;v_ready boolean:=false;v_branch text;
begin
 if p_project_id is null or p_owner_id is null or p_vercel_connection_id is null
  or p_vercel_connection_version is null or p_vercel_connection_version<1
  or p_source_connection_id is null or p_source_connection_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$'
  or p_source_updated_at is null or p_environment not in('preview','production')
  then raise exception 'Stripe runtime state unavailable';end if;
 v_branch:=case when p_environment='preview' then 'tayar/'||p_project_id::text||'/preview' else '' end;
 select c.* into v_vercel from private.website_infrastructure_connections c
 join public.projects p on p.id=c.project_id
 where c.id=p_vercel_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
  and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
  and c.provider='vercel' and c.environment=p_environment and c.version=p_vercel_connection_version
  and c.status in('connected','setup-incomplete','deployment-failed','ready') and c.target_id is not null;
 if not found then raise exception 'Stripe runtime state unavailable';end if;
 select c.* into v_stripe from private.website_infrastructure_connections c
 where c.project_id=p_project_id and c.owner_id=p_owner_id and c.provider='stripe' and c.environment=p_environment;
 select h.* into v_handoff from private.website_vercel_secret_handoffs h
 where h.connection_id=p_vercel_connection_id and h.project_id=p_project_id and h.owner_id=p_owner_id
  and h.source_connection_id=p_source_connection_id and h.source_field='secretKey'
  and h.source_environment=p_environment and h.environment_key='STRIPE_SECRET_KEY'
  and h.target=p_environment and h.git_branch=v_branch;
 select exists(select 1 from private.website_project_secrets s
  where s.project_id=p_project_id and s.connection_id=p_source_connection_id and s.field='secretKey'
   and s.environment=p_environment and s.updated_at=p_source_updated_at) into v_source_available;
 if v_stripe.id is not null and v_handoff.id is not null and v_handoff.status='verified'
  and v_handoff.source_updated_at=p_source_updated_at and v_handoff.vercel_project_id=v_vercel.target_id
  and v_handoff.vercel_environment_id is not null and not v_source_available then
  select exists(select 1 from private.website_stripe_secret_proofs sp
   where sp.handoff_id=v_handoff.id and sp.project_id=p_project_id and sp.owner_id=p_owner_id
    and sp.environment=p_environment and sp.handoff_version=v_handoff.version-1
    and sp.operation_id=v_handoff.operation_id and v_stripe.status='ready'
    and v_stripe.account_id=sp.account_id and v_stripe.target_id=sp.account_id
    and v_stripe.permissions=array['api:'||sp.key_type]::text[] and v_stripe.verified_at is not null)
  into v_ready;
 end if;
 return jsonb_build_object(
  'stripeConnectionId',v_stripe.id,'stripeConnectionVersion',coalesce(v_stripe.version,0),
  'handoffId',v_handoff.id,'handoffVersion',coalesce(v_handoff.version,0),
  'handoffStatus',v_handoff.status,'handoffOperationId',v_handoff.operation_id,
  'environmentId',v_handoff.vercel_environment_id,'sourceAvailable',v_source_available,'ready',v_ready);
end $$;
revoke all on function public.website_stripe_runtime_state_for_worker(uuid,uuid,uuid,bigint,text,timestamptz,text)
 from public,anon,authenticated;
grant execute on function public.website_stripe_runtime_state_for_worker(uuid,uuid,uuid,bigint,text,timestamptz,text)
 to service_role;
