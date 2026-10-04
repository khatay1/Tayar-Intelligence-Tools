-- Stripe credentials remain user-owned. Persist only the account/key-type proof
-- tied to a preparing Vercel handoff; never store the Stripe key here.
create table private.website_stripe_secret_proofs (
  handoff_id uuid primary key references private.website_vercel_secret_handoffs(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null,
  environment text not null check (environment in ('preview','production')),
  account_id text not null check (account_id ~ '^acct_[a-zA-Z0-9]{8,64}$'),
  key_type text not null check (key_type in ('restricted','secret')),
  handoff_version bigint not null check (handoff_version>0),
  operation_id uuid not null unique,
  verified_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);
create index website_stripe_secret_proofs_project_idx
  on private.website_stripe_secret_proofs(project_id,owner_id);
alter table private.website_stripe_secret_proofs enable row level security;
revoke all on private.website_stripe_secret_proofs from public,anon,authenticated;

create function public.website_record_stripe_secret_proof(
  p_handoff_id uuid,p_project_id uuid,p_owner_id uuid,p_handoff_version bigint,
  p_account_id text,p_key_type text,p_operation_id uuid
) returns boolean language plpgsql security definer set search_path = '' as $$
declare v_handoff private.website_vercel_secret_handoffs%rowtype;
  v_existing private.website_stripe_secret_proofs%rowtype;
begin
  if p_handoff_id is null or p_operation_id is null or p_handoff_version is null or p_handoff_version<1
    or p_account_id is null or p_account_id !~ '^acct_[a-zA-Z0-9]{8,64}$'
    or p_key_type is null or p_key_type not in ('restricted','secret')
    then raise exception 'Stripe proof unavailable'; end if;
  select h.* into v_handoff from private.website_vercel_secret_handoffs h
  join public.projects p on p.id=h.project_id
  where h.id=p_handoff_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_handoff_version and h.operation_id=p_operation_id and h.status='preparing'
    and h.source_field='secretKey' and h.source_environment in ('preview','production')
    and h.target=h.source_environment and h.environment_key='STRIPE_SECRET_KEY'
    and exists(select 1 from private.website_project_secrets s
      where s.project_id=h.project_id and s.connection_id=h.source_connection_id
        and s.field=h.source_field and s.environment=h.source_environment and s.updated_at=h.source_updated_at)
  for update of h;
  if not found then raise exception 'Stripe proof unavailable'; end if;
  select * into v_existing from private.website_stripe_secret_proofs where handoff_id=p_handoff_id for update;
  if found then
    if v_existing.handoff_version=p_handoff_version and v_existing.operation_id=p_operation_id
      and v_existing.project_id=p_project_id and v_existing.owner_id=p_owner_id
      and v_existing.environment=v_handoff.target and v_existing.account_id=p_account_id
      and v_existing.key_type=p_key_type then return true; end if;
    if v_existing.handoff_version>=p_handoff_version then raise exception 'Stripe proof changed'; end if;
    update private.website_stripe_secret_proofs set project_id=p_project_id,owner_id=p_owner_id,
      environment=v_handoff.target,account_id=p_account_id,key_type=p_key_type,
      handoff_version=p_handoff_version,operation_id=p_operation_id,verified_at=clock_timestamp(),
      updated_at=clock_timestamp() where handoff_id=p_handoff_id;
  else
    insert into private.website_stripe_secret_proofs
      (handoff_id,project_id,owner_id,environment,account_id,key_type,handoff_version,operation_id)
    values(p_handoff_id,p_project_id,p_owner_id,v_handoff.target,p_account_id,p_key_type,p_handoff_version,p_operation_id);
  end if;
  return true;
end $$;
revoke all on function public.website_record_stripe_secret_proof(uuid,uuid,uuid,bigint,text,text,uuid)
  from public,anon,authenticated;
grant execute on function public.website_record_stripe_secret_proof(uuid,uuid,uuid,bigint,text,text,uuid)
  to service_role;

create function public.website_activate_stripe_runtime(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
  p_handoff_id uuid,p_expected_handoff_version bigint,p_commit_id uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare v_account_id text;v_key_type text;v_environment text;v_verified_at timestamptz;
begin
  if p_connection_id is null or p_handoff_id is null or p_commit_id is null
    or p_expected_connection_version is null or p_expected_connection_version<0
    or p_expected_handoff_version is null or p_expected_handoff_version<0
    then raise exception 'Stripe runtime unavailable'; end if;
  select sp.account_id,sp.key_type,sp.environment,h.verified_at
  into v_account_id,v_key_type,v_environment,v_verified_at
  from private.website_vercel_secret_handoffs h
  join private.website_stripe_secret_proofs sp on sp.handoff_id=h.id
  join public.projects p on p.id=h.project_id
  where h.id=p_handoff_id and h.project_id=p_project_id and h.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and h.version=p_expected_handoff_version+2 and h.status='verified' and h.verified_at is not null
    and h.vercel_environment_id is not null and h.source_field='secretKey'
    and h.environment_key='STRIPE_SECRET_KEY' and h.target=sp.environment
    and sp.project_id=h.project_id and sp.owner_id=h.owner_id
    and sp.handoff_version=p_expected_handoff_version+1 and sp.operation_id=h.operation_id;
  if not found then raise exception 'Stripe runtime unavailable'; end if;
  return public.website_record_infrastructure_connection(
    p_connection_id,p_project_id,p_owner_id,p_expected_connection_version,'stripe',v_environment,
    v_account_id,v_account_id,array['api:'||v_key_type]::text[],'ready',null,v_verified_at,p_commit_id
  );
end $$;
revoke all on function public.website_activate_stripe_runtime(uuid,uuid,uuid,bigint,uuid,bigint,uuid)
  from public,anon,authenticated;
grant execute on function public.website_activate_stripe_runtime(uuid,uuid,uuid,bigint,uuid,bigint,uuid)
  to service_role;

create function public.website_reconcile_stripe_runtime_binding(
  p_connection_id uuid,p_project_id uuid,p_owner_id uuid,p_expected_connection_version bigint,
  p_handoff_id uuid,p_expected_handoff_version bigint,p_commit_id uuid
) returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('connectionVersion',c.version,'handoffVersion',h.version,
    'accountId',sp.account_id,'keyType',sp.key_type,'environmentId',h.vercel_environment_id)
  from private.website_infrastructure_connections c
  join public.projects p on p.id=c.project_id
  join private.website_vercel_secret_handoffs h on h.project_id=c.project_id and h.owner_id=c.owner_id
  join private.website_stripe_secret_proofs sp on sp.handoff_id=h.id
  where c.id=p_connection_id and c.project_id=p_project_id and c.owner_id=p_owner_id
    and p.user_id=p_owner_id and p.type='website-builder' and p.deleted_at is null
    and c.provider='stripe' and c.version=p_expected_connection_version+1 and c.last_commit_id=p_commit_id
    and c.status='ready' and c.environment=sp.environment and c.account_id=sp.account_id and c.target_id=sp.account_id
    and c.permissions=array['api:'||sp.key_type]::text[]
    and h.id=p_handoff_id and h.version=p_expected_handoff_version+2 and h.status='verified'
    and h.vercel_environment_id is not null and h.source_field='secretKey'
    and h.environment_key='STRIPE_SECRET_KEY' and h.target=sp.environment
    and sp.project_id=c.project_id and sp.owner_id=c.owner_id
    and sp.handoff_version=p_expected_handoff_version+1 and sp.operation_id=h.operation_id;
$$;
revoke all on function public.website_reconcile_stripe_runtime_binding(uuid,uuid,uuid,bigint,uuid,bigint,uuid)
  from public,anon,authenticated;
grant execute on function public.website_reconcile_stripe_runtime_binding(uuid,uuid,uuid,bigint,uuid,bigint,uuid)
  to service_role;
