-- Durable metadata proof for the exact Stripe endpoint observed while the
-- matching account credential is locked for handoff. No signing secret or API
-- credential is stored in this table.
create table private.website_stripe_webhook_endpoint_proofs (
  handoff_id uuid primary key references private.website_vercel_secret_handoffs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check (environment in ('preview','production')),
  account_id text not null check (account_id ~ '^acct_[a-zA-Z0-9]{8,64}$'),
  endpoint_id text not null check (endpoint_id ~ '^we_[a-zA-Z0-9]{8,128}$'),
  endpoint_url text not null check (endpoint_url ~ '^https://[^/[:space:]]+/api/stripe-webhook$'),
  api_version text not null check (api_version='2026-08-26.dahlia'),
  enabled_events text[] not null check (enabled_events=array[
    'checkout.session.completed','checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed','refund.created','refund.updated','charge.refunded']::text[]),
  handoff_version bigint not null check (handoff_version>0),
  operation_id uuid not null unique,
  verified_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index website_stripe_webhook_endpoint_proofs_project_idx
  on private.website_stripe_webhook_endpoint_proofs(project_id,owner_id);
alter table private.website_stripe_webhook_endpoint_proofs enable row level security;
revoke all on private.website_stripe_webhook_endpoint_proofs from public,anon,authenticated;

create function public.website_record_stripe_webhook_endpoint_proof(
  p_handoff_id uuid,p_project_id uuid,p_owner_id uuid,p_handoff_version bigint,
  p_account_id text,p_endpoint_id text,p_endpoint_url text,p_api_version text,
  p_enabled_events text[],p_operation_id uuid
) returns boolean language plpgsql security definer set search_path='' as $$
declare v_handoff private.website_vercel_secret_handoffs%rowtype;
  v_existing private.website_stripe_webhook_endpoint_proofs%rowtype;
begin
  if p_handoff_id is null or p_operation_id is null or p_handoff_version is null or p_handoff_version<1
    or p_account_id is null or p_account_id!~'^acct_[a-zA-Z0-9]{8,64}$'
    or p_endpoint_id is null or p_endpoint_id!~'^we_[a-zA-Z0-9]{8,128}$'
    or p_endpoint_url is null or p_endpoint_url!~'^https://[^/[:space:]]+/api/stripe-webhook$'
    or p_api_version<>'2026-08-26.dahlia'
    or p_enabled_events<>array['checkout.session.completed','checkout.session.async_payment_succeeded',
      'checkout.session.async_payment_failed','refund.created','refund.updated','charge.refunded']::text[]
    then raise exception 'Stripe webhook endpoint proof unavailable';end if;
  select h.* into v_handoff from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  where h.id=p_handoff_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_handoff_version and h.operation_id=p_operation_id and h.status='preparing'
    and h.source_field='secretKey' and h.source_environment in('preview','production')
    and h.target=h.source_environment and h.environment_key='STRIPE_SECRET_KEY'
    and exists(select 1 from private.website_project_secrets s
      where s.project_id=h.project_id and s.connection_id=h.source_connection_id
        and s.field=h.source_field and s.environment=h.source_environment and s.updated_at=h.source_updated_at)
  for update of h;
  if not found then raise exception 'Stripe webhook endpoint proof unavailable';end if;
  select * into v_existing from private.website_stripe_webhook_endpoint_proofs
    where handoff_id=p_handoff_id for update;
  if found then
    if v_existing.handoff_version=p_handoff_version and v_existing.operation_id=p_operation_id
      and v_existing.project_id=p_project_id and v_existing.owner_id=p_owner_id
      and v_existing.environment=v_handoff.target and v_existing.account_id=p_account_id
      and v_existing.endpoint_id=p_endpoint_id and v_existing.endpoint_url=p_endpoint_url
      and v_existing.api_version=p_api_version and v_existing.enabled_events=p_enabled_events then return true;end if;
    if v_existing.handoff_version>=p_handoff_version then raise exception 'Stripe webhook endpoint proof changed';end if;
    update private.website_stripe_webhook_endpoint_proofs set project_id=p_project_id,owner_id=p_owner_id,
      environment=v_handoff.target,account_id=p_account_id,endpoint_id=p_endpoint_id,endpoint_url=p_endpoint_url,
      api_version=p_api_version,enabled_events=p_enabled_events,handoff_version=p_handoff_version,
      operation_id=p_operation_id,verified_at=clock_timestamp(),updated_at=clock_timestamp()
    where handoff_id=p_handoff_id;
  else
    insert into private.website_stripe_webhook_endpoint_proofs
      (handoff_id,project_id,owner_id,environment,account_id,endpoint_id,endpoint_url,api_version,
       enabled_events,handoff_version,operation_id)
    values(p_handoff_id,p_project_id,p_owner_id,v_handoff.target,p_account_id,p_endpoint_id,p_endpoint_url,
      p_api_version,p_enabled_events,p_handoff_version,p_operation_id);
  end if;
  return true;
end $$;
revoke all on function public.website_record_stripe_webhook_endpoint_proof(uuid,uuid,uuid,bigint,text,text,text,text,text[],uuid)
  from public,anon,authenticated;
grant execute on function public.website_record_stripe_webhook_endpoint_proof(uuid,uuid,uuid,bigint,text,text,text,text,text[],uuid)
  to service_role;

-- Metadata-only state for the independent signing-secret handoff. Readiness is
-- impossible unless the matching account-key handoff retained an exact endpoint
-- proof for the same saved Stripe connection, environment, endpoint and origin.
create function public.website_stripe_webhook_runtime_state_for_worker(
  p_project_id uuid,p_owner_id uuid,p_vercel_connection_id uuid,p_vercel_connection_version bigint,
  p_source_connection_id text,p_stripe_source_updated_at timestamptz,p_webhook_source_updated_at timestamptz,
  p_endpoint_id text,p_application_origin text,p_environment text
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_vercel private.website_infrastructure_connections%rowtype;
  v_handoff private.website_vercel_secret_handoffs%rowtype;v_branch text;
  v_source_available boolean:=false;v_ready boolean:=false;v_endpoint_proof_verified boolean:=false;
begin
  if p_project_id is null or p_owner_id is null or p_vercel_connection_id is null
    or p_vercel_connection_version is null or p_vercel_connection_version<1
    or p_source_connection_id is null or p_source_connection_id!~'^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$'
    or p_stripe_source_updated_at is null or p_webhook_source_updated_at is null
    or p_endpoint_id is null or p_endpoint_id!~'^we_[A-Za-z0-9]{8,128}$'
    or p_application_origin is null or p_application_origin!~'^https://[^/[:space:]]+$'
    or p_environment not in('preview','production')
    then raise exception 'Stripe webhook runtime state unavailable';end if;
  v_branch:=case when p_environment='preview' then 'tayar/'||p_project_id::text||'/preview' else '' end;
  select c.* into v_vercel from private.website_infrastructure_connections c
  join public.projects p on p.id=c.project_id
  where c.id=p_vercel_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='vercel' and c.environment=p_environment and c.version=p_vercel_connection_version
    and c.status in('connected','setup-incomplete','deployment-failed','ready') and c.target_id is not null;
  if not found then raise exception 'Stripe webhook runtime state unavailable';end if;
  select exists(select 1 from private.website_vercel_secret_handoffs sh
    join private.website_stripe_secret_proofs sp on sp.handoff_id=sh.id
    join private.website_stripe_webhook_endpoint_proofs ep on ep.handoff_id=sh.id
    join private.website_infrastructure_connections sc on sc.project_id=sh.project_id and sc.owner_id=sh.owner_id
      and sc.provider='stripe' and sc.environment=p_environment
    where sh.connection_id=p_vercel_connection_id and sh.project_id=p_project_id and sh.owner_id=p_owner_id
      and sh.source_connection_id=p_source_connection_id and sh.source_field='secretKey'
      and sh.source_environment=p_environment and sh.source_updated_at=p_stripe_source_updated_at
      and sh.environment_key='STRIPE_SECRET_KEY' and sh.target=p_environment and sh.git_branch=v_branch
      and sh.status='verified' and sh.vercel_project_id=v_vercel.target_id and sh.vercel_environment_id is not null
      and sp.project_id=sh.project_id and sp.owner_id=sh.owner_id and sp.environment=p_environment
      and sp.handoff_version=sh.version-1 and sp.operation_id=sh.operation_id
      and ep.project_id=sh.project_id and ep.owner_id=sh.owner_id and ep.environment=p_environment
      and ep.account_id=sp.account_id and ep.endpoint_id=p_endpoint_id
      and ep.endpoint_url=p_application_origin||'/api/stripe-webhook'
      and ep.api_version='2026-08-26.dahlia' and ep.handoff_version=sp.handoff_version
      and ep.operation_id=sh.operation_id and sc.status='ready' and sc.account_id=sp.account_id
      and sc.target_id=sp.account_id and sc.permissions=array['api:'||sp.key_type]::text[]
      and not exists(select 1 from private.website_project_secrets s where s.project_id=sh.project_id
        and s.connection_id=sh.source_connection_id and s.field='secretKey'
        and s.environment=sh.source_environment and s.updated_at=sh.source_updated_at)) into v_endpoint_proof_verified;
  select h.* into v_handoff from private.website_vercel_secret_handoffs h
  where h.connection_id=p_vercel_connection_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and h.source_connection_id=p_source_connection_id and h.source_field='webhookSigningSecret'
    and h.source_environment=p_environment and h.environment_key='STRIPE_WEBHOOK_SECRET'
    and h.target=p_environment and h.git_branch=v_branch;
  select exists(select 1 from private.website_project_secrets s
    where s.project_id=p_project_id and s.connection_id=p_source_connection_id
      and s.field='webhookSigningSecret' and s.environment=p_environment
      and s.updated_at=p_webhook_source_updated_at) into v_source_available;
  v_ready:=v_endpoint_proof_verified and v_handoff.id is not null and v_handoff.status='verified'
    and v_handoff.source_updated_at=p_webhook_source_updated_at and v_handoff.vercel_project_id=v_vercel.target_id
    and v_handoff.vercel_environment_id is not null and not v_source_available;
  return jsonb_build_object('handoffId',v_handoff.id,'handoffVersion',coalesce(v_handoff.version,0),
    'handoffStatus',v_handoff.status,'handoffOperationId',v_handoff.operation_id,
    'environmentId',v_handoff.vercel_environment_id,'sourceAvailable',v_source_available,
    'endpointProofVerified',v_endpoint_proof_verified,'ready',v_ready);
end $$;
revoke all on function public.website_stripe_webhook_runtime_state_for_worker(uuid,uuid,uuid,bigint,text,timestamptz,timestamptz,text,text,text)
  from public,anon,authenticated;
grant execute on function public.website_stripe_webhook_runtime_state_for_worker(uuid,uuid,uuid,bigint,text,timestamptz,timestamptz,text,text,text)
  to service_role;
