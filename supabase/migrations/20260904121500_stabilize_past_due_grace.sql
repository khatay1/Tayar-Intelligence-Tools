-- Keep the payment-failure grace window anchored to the first past_due transition.
-- `subscriptions.updated_at` changes on every Stripe sync, so it must not be used
-- as the grace-window clock or retries can unintentionally extend paid access.

alter table public.subscriptions
  add column if not exists past_due_since timestamptz;

update public.subscriptions
set past_due_since = coalesce(past_due_since, updated_at, created_at, now())
where status = 'past_due'
  and past_due_since is null;

create or replace function public.sync_billing_subscription(
  p_user_id uuid,
  p_plan text,
  p_status text,
  p_stripe_customer_id text default null,
  p_stripe_subscription_id text default null,
  p_stripe_price_id text default null,
  p_current_period_end timestamptz default null,
  p_cancel_at_period_end boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan text := case lower(coalesce(p_plan, 'free'))
                   when 'pro' then 'pro'
                   when 'business' then 'business'
                   else 'free'
                 end;
  v_status text := left(lower(coalesce(p_status, 'active')), 40);
  v_effective_profile_plan text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Service role required';
  end if;

  insert into public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id,
    stripe_price_id, current_period_end, renewal_date, cancel_at_period_end,
    past_due_since, updated_at
  ) values (
    p_user_id, v_plan, v_status,
    nullif(p_stripe_customer_id, ''), nullif(p_stripe_subscription_id, ''),
    nullif(p_stripe_price_id, ''), p_current_period_end,
    case when p_current_period_end is not null then p_current_period_end::date else null end,
    coalesce(p_cancel_at_period_end, false),
    case when v_status = 'past_due' then now() else null end,
    now()
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
    updated_at = now();

  v_effective_profile_plan := case
    when v_plan in ('pro', 'business') and v_status in ('active', 'trialing') then v_plan
    else 'free'
  end;

  update public.profiles
  set plan = v_effective_profile_plan,
      updated_at = now()
  where id = p_user_id;
end;
$$;

create or replace function public.subscription_effective_paid_plan(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_subscription public.subscriptions%rowtype;
  v_grace_until timestamptz;
begin
  select * into v_subscription
  from public.subscriptions s
  where s.user_id = p_user_id
  order by
    case
      when s.status in ('active', 'trialing') then 0
      when s.status = 'past_due' then 1
      else 2
    end,
    coalesce(s.updated_at, s.created_at) desc
  limit 1;

  if not found or v_subscription.plan not in ('pro', 'business') then
    return 'free';
  end if;

  if v_subscription.status in ('active', 'trialing') then
    return v_subscription.plan;
  end if;

  if v_subscription.status = 'past_due' then
    v_grace_until := coalesce(
      v_subscription.past_due_since,
      v_subscription.updated_at,
      v_subscription.created_at,
      now()
    ) + interval '3 days';
    if now() < v_grace_until then
      return v_subscription.plan;
    end if;
  end if;

  return 'free';
end;
$$;
