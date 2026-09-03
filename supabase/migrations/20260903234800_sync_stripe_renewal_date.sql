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
    stripe_price_id, current_period_end, renewal_date, cancel_at_period_end, updated_at
  ) values (
    p_user_id, v_plan, v_status,
    nullif(p_stripe_customer_id, ''), nullif(p_stripe_subscription_id, ''),
    nullif(p_stripe_price_id, ''), p_current_period_end,
    case when p_current_period_end is not null then p_current_period_end::date else null end,
    coalesce(p_cancel_at_period_end, false), now()
  )
  on conflict (user_id) do update set
    plan = excluded.plan,
    status = excluded.status,
    stripe_customer_id = coalesce(excluded.stripe_customer_id, public.subscriptions.stripe_customer_id),
    stripe_subscription_id = excluded.stripe_subscription_id,
    stripe_price_id = excluded.stripe_price_id,
    current_period_end = excluded.current_period_end,
    renewal_date = excluded.renewal_date,
    cancel_at_period_end = excluded.cancel_at_period_end,
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

revoke all on function public.sync_billing_subscription(uuid,text,text,text,text,text,timestamptz,boolean) from public, anon, authenticated;
grant execute on function public.sync_billing_subscription(uuid,text,text,text,text,text,timestamptz,boolean) to service_role;
