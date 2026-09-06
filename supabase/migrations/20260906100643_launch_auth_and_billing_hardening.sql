-- Pilot launch hardening for signup enforcement and Stripe subscription synchronization.

-- Enforce the same signup switch and email block list inside Supabase Auth.
-- Before-user-created hooks only run for new identities, so existing OAuth users
-- can still sign in while new registrations are paused.
create or replace function public.hook_enforce_tayar_signup_policy(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if not public.is_signup_enabled() then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'New account registration is temporarily unavailable'
      )
    );
  end if;

  if v_email <> '' and public.is_email_blocked(v_email) then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'This email address cannot create an account'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

revoke all on function public.hook_enforce_tayar_signup_policy(jsonb)
  from public, anon, authenticated;
grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_enforce_tayar_signup_policy(jsonb)
  to supabase_auth_admin;

-- Every Stripe Price that has represented a paid plan remains resolvable. This
-- is important after admins rotate the active Checkout Price: existing
-- subscriptions continue sending their original Price IDs in webhook events.
create table if not exists public.stripe_price_plan_map (
  price_id text primary key check (price_id ~ '^price_[A-Za-z0-9]+$'),
  plan text not null check (plan in ('pro', 'business')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.stripe_price_plan_map enable row level security;
revoke all on public.stripe_price_plan_map from public, anon, authenticated;
grant select, insert, update on public.stripe_price_plan_map to service_role;

-- These non-secret Price IDs were the legacy checkout defaults. Keep them only
-- for resolving existing subscriptions; new Checkout sessions never fall back
-- to them and require the current admin/environment configuration.
insert into public.stripe_price_plan_map (price_id, plan, active)
values
  ('price_1UBuNbPf8BnXUBSOvSHBpzC6', 'pro', true),
  ('price_1UBuNgPf8BnXUBSOLH3TM9ms', 'business', true)
on conflict (price_id) do update
set plan = excluded.plan,
    active = true,
    updated_at = now();

insert into public.stripe_price_plan_map (price_id, plan, active)
select
  trim(both '"' from value::text),
  case key
    when 'stripe_pro_price_id' then 'pro'
    else 'business'
  end,
  true
from public.admin_settings
where key in ('stripe_pro_price_id', 'stripe_business_price_id')
  and trim(both '"' from value::text) ~ '^price_[A-Za-z0-9]+$'
on conflict (price_id) do update
set plan = excluded.plan,
    active = true,
    updated_at = now();

-- Stripe may deliver an event more than once. Persist the event ID before
-- processing so retries are idempotent and concurrent duplicates are harmless.
create table if not exists public.stripe_webhook_events (
  event_id text primary key check (event_id ~ '^evt_[A-Za-z0-9]+$'),
  event_type text not null,
  object_id text,
  event_created bigint not null check (event_created >= 0),
  status text not null default 'processing'
    check (status in ('processing', 'processed', 'failed')),
  attempts integer not null default 1 check (attempts > 0),
  processing_started_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_stripe_webhook_events_created_at
  on public.stripe_webhook_events (created_at desc);

alter table public.stripe_webhook_events enable row level security;
revoke all on public.stripe_webhook_events from public, anon, authenticated;
grant select, insert, update, delete on public.stripe_webhook_events to service_role;

create or replace function public.claim_stripe_webhook_event(
  p_event_id text,
  p_event_type text,
  p_object_id text,
  p_event_created bigint
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, object_id, event_created
  ) values (
    p_event_id, left(p_event_type, 160), nullif(left(coalesce(p_object_id, ''), 255), ''), p_event_created
  )
  on conflict (event_id) do nothing;

  if found then
    return true;
  end if;

  -- Failed work is retryable. A processing claim can also be recovered after a
  -- timeout in case the previous function invocation stopped unexpectedly.
  update public.stripe_webhook_events
  set status = 'processing',
      attempts = attempts + 1,
      processing_started_at = now(),
      processed_at = null,
      last_error = null,
      updated_at = now()
  where event_id = p_event_id
    and (
      status = 'failed'
      or (status = 'processing' and processing_started_at < now() - interval '10 minutes')
    );

  return found;
end;
$$;

revoke all on function public.claim_stripe_webhook_event(text, text, text, bigint)
  from public, anon, authenticated;
grant execute on function public.claim_stripe_webhook_event(text, text, text, bigint)
  to service_role;

alter table public.subscriptions
  add column if not exists stripe_event_created bigint,
  add column if not exists stripe_event_id text;

-- Replace the older eight-argument overload. The two new optional arguments
-- preserve compatibility with trusted callers while allowing Stripe events to
-- reject stale state transitions.
drop function if exists public.sync_billing_subscription(
  uuid, text, text, text, text, text, timestamptz, boolean
);

create function public.sync_billing_subscription(
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_stripe_price_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false,
  p_event_created bigint default null,
  p_event_id text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan text := case lower(coalesce(p_plan, 'free'))
                   when 'pro' then 'pro'
                   when 'business' then 'business'
                   else 'free'
                 end;
  v_status text := left(lower(coalesce(p_status, 'active')), 40);
  v_applied_plan text;
  v_applied_status text;
  v_effective_profile_plan text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  insert into public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, current_period_end, renewal_date, cancel_at_period_end,
    past_due_since, stripe_event_created, stripe_event_id, updated_at
  ) values (
    p_user_id, v_plan, v_status,
    nullif(p_stripe_customer_id, ''), nullif(p_stripe_subscription_id, ''),
    nullif(p_stripe_price_id, ''), p_current_period_end,
    case when p_current_period_end is not null then p_current_period_end::date else null end,
    coalesce(p_cancel_at_period_end, false),
    case when v_status = 'past_due' then now() else null end,
    p_event_created, nullif(p_event_id, ''), now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, subscriptions.stripe_customer_id),
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    current_period_end = excluded.current_period_end,
    renewal_date = excluded.renewal_date,
    cancel_at_period_end = excluded.cancel_at_period_end,
    past_due_since = case
      when excluded.status = 'past_due' and subscriptions.status = 'past_due'
        then coalesce(subscriptions.past_due_since, subscriptions.updated_at, subscriptions.created_at, now())
      when excluded.status = 'past_due' then now()
      else null
    end,
    stripe_event_created = coalesce(excluded.stripe_event_created, subscriptions.stripe_event_created),
    stripe_event_id = coalesce(excluded.stripe_event_id, subscriptions.stripe_event_id),
    updated_at = now()
  where p_event_created is null
     or subscriptions.stripe_event_created is null
     or p_event_created >= subscriptions.stripe_event_created
  returning plan, status into v_applied_plan, v_applied_status;

  -- A newer Stripe event already won the race. Do not regress profiles.plan.
  if not found then
    return;
  end if;

  v_effective_profile_plan := case
    when v_applied_plan in ('pro', 'business')
      and v_applied_status in ('active', 'trialing') then v_applied_plan
    else 'free'
  end;

  update public.profiles
  set plan = v_effective_profile_plan,
      updated_at = now()
  where id = p_user_id;
end;
$$;

revoke all on function public.sync_billing_subscription(
  uuid, text, text, text, text, text, timestamptz, boolean, bigint, text
) from public, anon, authenticated;
grant execute on function public.sync_billing_subscription(
  uuid, text, text, text, text, text, timestamptz, boolean, bigint, text
) to service_role;

-- All administrator deletions now pass through the Edge Function so Stripe and
-- Storage are cleaned before the Auth user is removed. Keep the legacy database
-- functions installed for migration compatibility, but close their direct API.
revoke all on function public.admin_delete_user(uuid)
  from public, anon, authenticated;
revoke all on function public.admin_delete_user_and_block(uuid, text, timestamptz)
  from public, anon, authenticated;

-- Supabase API grants can leave SECURITY DEFINER RPCs executable by anon even
-- when the original migration only intended authenticated access. Close the
-- anonymous path for team/billing RPCs and for trigger/helper functions. The
-- explicitly public signup, form, lead and website-analytics RPCs remain
-- available because their bodies enforce their own bounded public contract.
revoke all on function public.accept_team_workspace_invite(text) from public, anon;
revoke all on function public.assign_project_to_team_workspace(uuid, uuid) from public, anon;
revoke all on function public.create_team_workspace(text) from public, anon;
revoke all on function public.create_team_workspace_invite(uuid, text, text) from public, anon;
revoke all on function public.delete_team_workspace(uuid) from public, anon;
revoke all on function public.get_project_team_access(uuid) from public, anon;
revoke all on function public.get_team_workspace_details(uuid) from public, anon;
revoke all on function public.get_website_builder_billing_state(uuid) from public, anon;
revoke all on function public.list_team_workspaces() from public, anon;
revoke all on function public.remove_project_from_team_workspace(uuid) from public, anon;
revoke all on function public.remove_team_workspace_member(uuid, uuid) from public, anon;
revoke all on function public.rename_team_workspace(uuid, text) from public, anon;
revoke all on function public.revoke_team_workspace_invite(uuid) from public, anon;
revoke all on function public.team_workspace_role(uuid) from public, anon;
revoke all on function public.transfer_team_workspace_ownership(uuid, uuid) from public, anon;
revoke all on function public.update_team_workspace_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.website_project_team_role(uuid) from public, anon;

-- These functions are invoked only by database triggers or by another trusted
-- SECURITY DEFINER function. Browser roles never need direct EXECUTE access.
revoke all on function public.enforce_published_website_ingestion()
  from public, anon, authenticated;
revoke all on function public.enforce_website_builder_plan_limits()
  from public, anon, authenticated;
revoke all on function public.enforce_website_public_rate_limit(uuid, text, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.handle_new_user()
  from public, anon, authenticated;
revoke all on function public.protect_profile_admin_fields()
  from public, anon, authenticated;
revoke all on function public.protect_shared_project_identity()
  from public, anon, authenticated;
revoke all on function public.website_public_ingestion_limit(uuid, text)
  from public, anon, authenticated;
