revoke all on function public.team_effective_plan(uuid) from public, anon, authenticated;
grant execute on function public.team_effective_plan(uuid) to service_role;

revoke all on function public.subscription_effective_paid_plan(uuid) from public, anon, authenticated;
grant execute on function public.subscription_effective_paid_plan(uuid) to service_role;
