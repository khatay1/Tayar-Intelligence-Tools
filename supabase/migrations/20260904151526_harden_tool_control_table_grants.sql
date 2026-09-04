-- Keep tool-control configuration writable only through authenticated admin RLS.
-- Remove legacy broad grants, especially anon/TRUNCATE/DELETE privileges.

revoke all on table public.tool_access_rules from anon, authenticated;
revoke all on table public.tool_plan_limits from anon, authenticated;

grant select, insert, update on table public.tool_access_rules to authenticated;
grant select, insert, update on table public.tool_plan_limits to authenticated;

grant all on table public.tool_access_rules to service_role;
grant all on table public.tool_plan_limits to service_role;
