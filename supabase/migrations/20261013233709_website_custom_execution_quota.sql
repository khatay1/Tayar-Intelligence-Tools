-- Reserve custom sandbox work under the existing atomic per-user tool meter.
-- Disabled until the authenticated published-operation route is implemented.
insert into public.tool_access_rules(tool_id, minimum_plan, enabled)
values ('website-custom-execution', 'pro', false)
on conflict (tool_id) do nothing;

insert into public.tool_plan_limits(tool_id, free_limit, pro_limit, business_limit, period)
values ('website-custom-execution', 0, 10, 50, 'monthly')
on conflict (tool_id) do nothing;
