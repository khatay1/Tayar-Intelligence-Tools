-- Restore internal helpers required by tool_access_state().
-- These helpers are intentionally not callable by browser roles directly.

create or replace function public.tool_plan_rank(p_plan text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case lower(trim(coalesce(p_plan, '')))
    when 'business' then 2
    when 'pro' then 1
    else 0
  end;
$$;

create or replace function public.tool_usage_window_start(p_period text)
returns timestamptz
language sql
stable
set search_path = public
as $$
  select case lower(trim(coalesce(p_period, 'monthly')))
    when 'daily' then date_trunc('day', now())
    when 'monthly' then date_trunc('month', now())
    when 'lifetime' then null
    else date_trunc('month', now())
  end;
$$;

revoke all on function public.tool_plan_rank(text) from public, anon, authenticated;
revoke all on function public.tool_usage_window_start(text) from public, anon, authenticated;
grant execute on function public.tool_plan_rank(text) to service_role;
grant execute on function public.tool_usage_window_start(text) to service_role;

notify pgrst, 'reload schema';
