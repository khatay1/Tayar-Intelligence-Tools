-- Keep tool usage access/quotas consistent across legacy and current callers.

insert into public.tool_access_rules(tool_id, minimum_plan, enabled, updated_at)
values ('ai-chat','free',true,now())
on conflict (tool_id) do nothing;

insert into public.tool_plan_limits(tool_id, free_limit, pro_limit, business_limit, period, updated_at)
values ('ai-chat',25,250,1000,'monthly',now())
on conflict (tool_id) do nothing;

create or replace function public.check_tool_usage(p_tool_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_state jsonb;
begin
  v_state := public.tool_access_state(p_tool_id);
  return v_state || jsonb_build_object(
    'usage_allowed', coalesce((v_state->>'allowed')::boolean,false),
    'limit', case when v_state ? 'usage_limit' then (v_state->>'usage_limit')::integer else null end,
    'used', case when v_state ? 'usage_count' then (v_state->>'usage_count')::bigint else null end,
    'remaining', case when v_state ? 'usage_remaining' then (v_state->>'usage_remaining')::bigint else null end
  );
end;
$$;

revoke all on function public.check_tool_usage(text) from public, anon;
grant execute on function public.check_tool_usage(text) to authenticated, service_role;
