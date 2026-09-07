alter table public.tool_plan_limits
  drop constraint if exists tool_plan_limits_updated_by_fkey;

alter table public.tool_plan_limits
  add constraint tool_plan_limits_updated_by_fkey
  foreign key (updated_by)
  references auth.users(id)
  on delete set null;
